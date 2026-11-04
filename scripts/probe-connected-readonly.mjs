import { promises as dns } from "node:dns";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export async function probeConnectedReadOnly(io = {}) {
  const fetchPublic = io.fetch ?? fetch;
  const resolve4 = io.resolve4 ?? dns.resolve4;
  const host = "fzptgnoxbfnfgvhpkzsv.supabase.co";
  const targets = [
    ["google-dns", `https://dns.google/resolve?name=${host}&type=A`],
    [
      "cloudflare-dns",
      `https://cloudflare-dns.com/dns-query?name=${host}&type=A`,
    ],
    ["supabase-auth", `https://${host}/auth/v1/health`],
    ...[
      "/",
      "/health",
      "/api/health",
      "/profile",
      "/moods",
      "/journals",
      "/memories",
      "/conversations",
    ].map((path) => [
      `render${path}`,
      `https://mori-api-qygo.onrender.com${path}`,
    ]),
  ];
  const checks = await Promise.all(
    targets.map(async ([label, url]) => {
      try {
        const response = await fetchPublic(url, {
          method: "GET",
          redirect: "error",
          headers: {
            accept: label.endsWith("-dns")
              ? "application/dns-json"
              : "application/json",
          },
          signal: AbortSignal.timeout(25000),
        });
        let data;
        if (label.endsWith("-dns") || label === "render/health") {
          try {
            data = await response.json();
          } catch {
            /* Non-JSON is not expected health. */
          }
        } else {
          await response.body?.cancel();
        }
        return {
          label,
          status: response.status,
          ...(label.endsWith("-dns")
            ? { dnsStatus: Number.isInteger(data?.Status) ? data.Status : null }
            : {}),
          ...(label === "render/health"
            ? {
                expectedHealth:
                  response.status === 200 &&
                  data?.status === "ok" &&
                  Object.keys(data).length === 1,
              }
            : {}),
        };
      } catch (error) {
        return { label, error: error.cause?.code ?? error.name };
      }
    }),
  );
  try {
    checks.push({
      label: "system-dns",
      addressCount: (await resolve4(host)).length,
    });
  } catch (error) {
    checks.push({ label: "system-dns", error: error.code ?? error.name });
  }
  const get = (label) => checks.find((check) => check.label === label);
  const passed =
    ["google-dns", "cloudflare-dns"].every(
      (label) => get(label).dnsStatus === 0,
    ) &&
    get("system-dns").addressCount > 0 &&
    [200, 401].includes(get("supabase-auth").status) &&
    get("render/health").expectedHealth === true &&
    ["/profile", "/moods", "/journals", "/memories", "/conversations"].every(
      (path) => get(`render${path}`).status === 401,
    );
  return {
    checkedAtUtc: new Date().toISOString(),
    projectRef: "fzptgnoxbfnfgvhpkzsv",
    status: passed ? "PUBLIC_SMOKE_PASS" : "BLOCKED",
    checks,
    mutationsPerformed: false,
    authenticatedChecksPerformed: false,
    providerCalls: 0,
    limitations: [
      "Supabase 401 establishes gateway reachability only, not Auth health",
      "Public smoke does not verify project state, deployed SHA, DB/RLS or provider",
    ],
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const result = await probeConnectedReadOnly();
  if (process.argv[2]) {
    const output = resolve(process.argv[2]);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
  }
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.status === "BLOCKED" ? 1 : 0;
}
