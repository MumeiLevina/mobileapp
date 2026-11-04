import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

test.each(["pass", "nxdomain", "stale-api", "redirect"])(
  "public smoke uses credential-free GET and reports %s without leaking bodies",
  (mode) => {
    const program = `import { probeConnectedReadOnly } from ${JSON.stringify(pathToFileURL(resolve("scripts/probe-connected-readonly.mjs")).href)};
    const mode=process.argv[1];const calls=[];
    const result=await probeConnectedReadOnly({resolve4:async()=>['synthetic-address'],fetch:async(url,options)=>{
      calls.push(options);
      const isDns=url.includes('dns.google')||url.includes('cloudflare-dns.com');
      if(mode==='redirect'&&url.endsWith('/health'))throw Object.assign(Error('private-response-body'),{name:'TypeError'});
      const health=url==='https://mori-api-qygo.onrender.com/health';
      return {status:isDns?200:health?(mode==='stale-api'?404:200):401,
        json:async()=>isDns?{Status:mode==='nxdomain'?3:0}:{status:'ok'},
        body:{cancel:async()=>{}}};
    }});
    console.log(JSON.stringify({result,calls}));`;
    const run = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", program, mode],
      { encoding: "utf8" },
    );
    expect(run.status).toBe(0);
    expect(`${run.stdout}${run.stderr}`).not.toContain("private-response-body");
    const { result, calls } = JSON.parse(run.stdout);
    expect(result.status).toBe(
      mode === "pass" ? "PUBLIC_SMOKE_PASS" : "BLOCKED",
    );
    expect(result).toMatchObject({
      mutationsPerformed: false,
      authenticatedChecksPerformed: false,
      providerCalls: 0,
    });
    expect(calls).toHaveLength(11);
    for (const call of calls) {
      expect(call.method).toBe("GET");
      expect(call.redirect).toBe("error");
      expect(Object.keys(call.headers)).toEqual(["accept"]);
      expect(call).not.toHaveProperty("body");
    }
  },
);
