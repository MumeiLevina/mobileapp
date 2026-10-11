import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createRequire } from "node:module";

const { PNG } = createRequire(import.meta.url)("pngjs");
const root = resolve(import.meta.dirname, "..");
const privateRoot = join(root, ".mori-live");
await mkdir(privateRoot, { recursive: true });
const temporary = await mkdtemp(join(privateRoot, "verify-python-"));
const processes = [];
const voiceMock = process.argv.includes("--voice-mock");
let browser;
async function freePort() {
  const server = createServer();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  await new Promise((r) => server.close(r));
  return port;
}
function launch(executable, args, env, event) {
  const child = spawn(executable, args, {
    cwd: root,
    env: { ...process.env, ...env },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  processes.push(child);
  return new Promise((resolveLaunch, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Startup timeout: ${event}`)),
      30000,
    );
    child.once("error", reject);
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Startup exit ${code}: ${event}`));
    });
    child.stdout.on("data", (data) => {
      if (data.toString().includes(event)) {
        clearTimeout(timer);
        resolveLaunch(child);
      }
    });
    child.stderr.on("data", (data) => process.stderr.write(data));
  });
}
try {
  const apiPort = await freePort();
  const desktopPort = await freePort();
  const apiToken = randomBytes(32).toString("hex");
  const operatorToken = randomBytes(32).toString("hex");
  const env = {
    MORI_TTS_PROVIDER: voiceMock ? "mock" : "disabled",
    MORI_LIVE_MODE: "MOCK",
    NODE_ENV: "test",
    MORI_LIVE_API_PORT: String(apiPort),
    MORI_LIVE_API_TOKEN: apiToken,
    MORI_LIVE_STORE_DIR: join(temporary, "store"),
  };
  await launch(
    process.execPath,
    ["apps/api/dist/apps/api/src/live.main.js"],
    env,
    "public_live_api_started",
  );
  await launch(
    join(
      root,
      ".mori-live/upstream/.venv",
      process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
    ),
    ["apps/live-desktop/python/launch.py"],
    {
      ...env,
      MORI_LIVE_API_URL: `http://127.0.0.1:${apiPort}/v1/live`,
      MORI_LIVE_OPERATOR_TOKEN: operatorToken,
      MORI_LIVE_DESKTOP_PORT: String(desktopPort),
    },
    "mori_python_started",
  );
  const url = `http://127.0.0.1:${desktopPort}`;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {
      /* binding after startup marker */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal((await fetch(`${url}/renderer/index.html`)).status, 401);
  assert.equal(
    (await fetch(url, { headers: { Origin: "https://untrusted.example" } }))
      .status,
    403,
  );
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.__events = [];
    window.__sent = [];
    window.__maxMouth = 0;
    window.__maxAppliedMouth = 0;
    const mouthFrame = () => {
      window.__maxMouth = Math.max(
        window.__maxMouth,
        window.__moriAudioMouth || 0,
      );
      window.__maxAppliedMouth = Math.max(window.__maxAppliedMouth, window.__moriAppliedMouth || 0);
      requestAnimationFrame(mouthFrame);
    };
    requestAnimationFrame(mouthFrame);
    window.__rendererEvents = [];
    window.addEventListener("mori-renderer-event", (e) =>
      window.__rendererEvents.push(JSON.parse(e.detail)),
    );
    const NativeSocket = window.WebSocket;
    window.WebSocket = class extends NativeSocket {
      constructor(...args) {
        super(...args);
        window.__socket = this;
        this.addEventListener("message", (e) =>
          window.__events.push(JSON.parse(e.data)),
        );
      }
      send(data) {
        window.__sent.push({
          ...JSON.parse(data),
          observedAt: performance.now(),
        });
        super.send(data);
      }
    };
  });
  await page.goto(url);
  await page.locator("#token").fill(operatorToken);
  await page.locator("#login button").click();
  await page.waitForFunction(
    () => document.getElementById("send").disabled === false,
    null,
    { timeout: 65000 },
  );
  const frame = page
    .frames()
    .find((f) => f.url().includes("/renderer/index.html"));
  assert.ok(frame);
  let turn = {
    version: 1,
    context: "PUBLIC_LIVE",
    type: "text",
    requestId: randomUUID(),
    eventId: randomUUID(),
    turnId: randomUUID(),
    text: "Hôm nay mình buồn một chút",
  };
  if (voiceMock) {
    await page.locator("#text").fill(turn.text);
    await page.locator("#send").click();
    turn = await page.evaluate(() => {
      const { observedAt, ...command } = window.__sent.find(
        (e) => e.type === "text",
      );
      return command;
    });
  } else
    await page.evaluate(
      (value) => window.__socket.send(JSON.stringify(value)),
      turn,
    );
  await page.waitForFunction(
    () => window.__events.some((e) => e.type === "response"),
    null,
    { timeout: 15000 },
  );
  const response = await page.evaluate(() =>
    window.__events.find((e) => e.type === "response"),
  );
  assert.equal(response.expression, "cry");
  let voiceEvidence;
  if (voiceMock) {
    await page.waitForFunction(
      () => window.__sent.some((e) => e.type === "voice.speech.finished"),
      null,
      { timeout: 15000 },
    );
    const sent = await page.evaluate(() => window.__sent);
    const start = sent.find((e) => e.type === "voice.speech.started");
    const finish = sent.find((e) => e.type === "voice.speech.finished");
    assert.ok(start && finish);
    const maxMouth = await frame.evaluate(() => window.__maxMouth);
    const maxAppliedMouth = await frame.evaluate(() => window.__maxAppliedMouth);
    assert.ok(maxMouth > 0.01, `Expected audio-driven mouth, got ${maxMouth}`);
    assert.ok(maxAppliedMouth > 0.01, `Expected actual Cubism mouth parameter, got ${maxAppliedMouth}`);
    assert.equal(await frame.evaluate(() => window.__moriAudioMouth), 0);
    voiceEvidence = {
      mockToneOnly: true,
      actualBrowserPlaybackEvents: true,
      speechVerified: false,
      maxMouth,
      maxAppliedMouth,
      duration: finish.position,
      textToPlaybackMs: Math.round(
        start.observedAt - sent.find((e) => e.type === "text").observedAt,
      ),
    };
  }
  await page.waitForFunction(() =>
    window.__events.some((e) => e.type === "state" && e.state === "idle"),
  );
  await page.evaluate(
    (value) => window.__socket.send(JSON.stringify(value)),
    turn,
  );
  await page.waitForFunction(() =>
    window.__events.some((e) => e.type === "deduplicated"),
  );
  assert.equal(
    await page.evaluate(
      () => window.__events.filter((e) => e.type === "response").length,
    ),
    1,
  );
  await page.locator("#cancel").click();
  await page.waitForTimeout(2500);
  assert.equal(await frame.evaluate(() => window.__moriState.state), "idle");
  const screenshot = await page
    .locator("#avatar")
    .screenshot({
      path: join(temporary, "snow-neko.png"),
      omitBackground: true,
    });
  const png = PNG.sync.read(screenshot);
  let visible = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    // Exclude flat warm page background; count character-colored pixels.
    if (
      png.data[i + 3] > 0 &&
      Math.max(png.data[i], png.data[i + 1], png.data[i + 2]) -
        Math.min(png.data[i], png.data[i + 1], png.data[i + 2]) >
        25
    )
      visible++;
  }
  assert.ok(visible > 10000, `Visible model pixels: ${visible}`);
  const rendererEvents = await frame.evaluate(() => window.__rendererEvents);
  assert.ok(rendererEvents.some((e) => e.type === "ready"));
  assert.equal(rendererEvents.filter((e) => e.type === "error").length, 0);
  assert.deepEqual(errors, []);
  if (voiceMock) {
    const operatorPage = await browser.newPage();
    await operatorPage.goto(`${url}/operator`);
    await operatorPage.locator("#token").fill(operatorToken);
    await operatorPage.locator("#login button").click();
    await operatorPage.waitForFunction(() => document.getElementById("budget").textContent.includes("$"));
    await operatorPage.locator("#text").fill("Xin chào mọi người");
    await operatorPage.locator("#test button").click();
    await page.waitForFunction(() => window.__sent.filter((e) => e.type === "voice.speech.started").length === 2);
    await operatorPage.locator('[data-action="mute"]').click();
    await page.waitForFunction(() => document.getElementById("avatar").contentWindow.__moriAudioMouth === 0);
    await page.waitForTimeout(250);
    assert.equal(await frame.evaluate(() => window.__moriAppliedMouth), 0);
    assert.equal(await page.evaluate(() => window.__sent.filter((e) => e.type === "voice.speech.finished").length), 1);
    await operatorPage.locator('[data-action="resume"]').click();
    await operatorPage.locator("#text").fill("Mình muốn biến mất");
    await operatorPage.locator("#test button").click();
    await page.waitForFunction(() => window.__sent.filter((e) => e.type === "voice.speech.finished").length === 2);
    await page.waitForTimeout(2200);
    assert.equal(await frame.evaluate(() => window.__moriState.crisis), true);
    assert.equal(await page.evaluate(() => window.__events.filter((e) => e.type === "response").at(-1).expression), null);
    voiceEvidence.emergencyMute = true;
    voiceEvidence.crisisAnimationSuppressed = true;
    await operatorPage.close();
    await page.goto(`${url}/avatar`);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.locator("#token").fill(operatorToken);
    await page.locator("#login button").click();
    await page.waitForFunction(() => document.body.classList.contains("avatar-ready"), null, { timeout: 65000 });
    await page.waitForTimeout(500);
    const transparent = PNG.sync.read(await page.screenshot({ path: join(temporary, "avatar-transparent.png"), omitBackground: true }));
    let clear = 0;
    for (let i = 3; i < transparent.data.length; i += 4) if (transparent.data[i] === 0) clear++;
    assert.ok(clear > 100000);
    assert.equal(await page.evaluate(() => window.__events.filter((e) => e.type === "voice.audio").length), 0);
    voiceEvidence.transparentAvatarPixels = clear;
    voiceEvidence.reconnectDidNotReplay = true;
    voiceEvidence.obsTested = false;
  }
  const store = JSON.parse(
    await readFile(join(temporary, "store/public-live.json"), "utf8"),
  );
  assert.equal(Object.keys(store.sessions).length, 1);
  assert.equal(Object.keys(Object.values(store.sessions)[0].turns).length, voiceMock ? 3 : 1);
  assert.equal(store.spentMicros, 0);
  const evidence = {
    verified: true,
    mode: "MOCK",
    upstreamPython: "3.11",
    actualNest: true,
    expression: response.expression,
    deduplicated: true,
    state: "idle",
    visiblePixels: visible,
    rendererEvents,
    voiceEvidence,
    pageErrors: errors,
    screenshot: join(temporary, "snow-neko.png"),
  };
  await writeFile(
    join(
      privateRoot,
      voiceMock ? "voice-mock-verification.json" : "python-verification.json",
    ),
    JSON.stringify(evidence, null, 2),
  );
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await browser?.close();
  for (const child of processes.reverse()) {
    child.kill();
    await Promise.race([
      new Promise((r) => child.once("exit", r)),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
  }
  // Only this test's freshly allocated synthetic public store, never operator data.
  await rm(join(temporary, "store"), { recursive: true, force: true });
}
