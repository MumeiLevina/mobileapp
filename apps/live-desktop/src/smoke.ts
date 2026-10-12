import assert from "node:assert/strict";
import { once } from "node:events";
import { randomBytes, randomUUID } from "node:crypto";
import { AddressInfo } from "node:net";
import { createMockBridge } from "./bridge/mock-server";
import { MoriLiveBridge, simulatedTurn } from "./bridge/client";

async function smoke() {
  const token = randomBytes(32).toString("hex");
  const server = createMockBridge({ token });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const bridge = new MoriLiveBridge({ url, token, expectedMode: "MOCK" });
    const session = await bridge.createSession();
    const request = simulatedTurn(session.sessionId, "Xin chào Mori");
    const reply = await bridge.turn(request);
    assert.equal(reply.status, "approved");
    assert.equal(reply.mode, "MOCK");
    const reconnected = new MoriLiveBridge({
      url,
      token,
      expectedMode: "MOCK",
    });
    const duplicate = await reconnected.turn({
      ...request,
      requestId: randomUUID(),
    });
    assert.equal(duplicate.eventId, reply.eventId);
    await reconnected.cancel(session.sessionId, request.turnId);
    assert.equal((await bridge.turn(request)).status, "cancelled");
    process.stdout.write(
      JSON.stringify({
        mode: "MOCK",
        roundtrip: "passed",
        replay: "passed",
        cancellation: "passed",
      }) + "\n",
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}
smoke().catch(() => {
  process.stderr.write("Mori Live mock smoke failed\n");
  process.exitCode = 1;
});
