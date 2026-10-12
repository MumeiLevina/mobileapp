/* global setTimeout */
import test from "node:test";
import assert from "node:assert/strict";
import { smoothMouth, VoicePlayer } from "../web/voice.mjs";

globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};
function fixture({ noDevice = false, delayed = false } = {}) {
  const events = [],
    mouths = [],
    speaking = [];
  let release;
  const audio = {
    volume: 1,
    paused: true,
    currentTime: 0,
    ended: false,
    async play() {
      if (delayed)
        await new Promise((r) => {
          release = r;
        });
      this.paused = false;
      this.onplaying?.();
    },
    pause() {
      this.paused = true;
    },
    removeAttribute() {},
    load() {},
    async setSinkId() {
      if (noDevice) throw new Error("NotFoundError");
    },
  };
  const context = {
    async resume() {},
    destination: {},
    createAnalyser() {
      return {
        fftSize: 512,
        connect() {},
        getFloatTimeDomainData(data) {
          data.fill(0.1);
        },
      };
    },
    createMediaElementSource() {
      return { connect() {} };
    },
  };
  const player = new VoicePlayer({
    emit: (e) => events.push(e),
    mouth: (v) => mouths.push(v),
    speaking: (v) => speaking.push(v),
    reduced: () => false,
    factory: () => ({ audio, context }),
  });
  return { player, audio, events, mouths, speaking, release: () => release() };
}
const payload = {
  turnId: "turn",
  speechId: "speech",
  audio: "AAAA",
  duration: 1.5,
};
test("RMS silence, smoothing, bounds, reduced motion, immediate stop", () => {
  assert.equal(smoothMouth([0, 0], 0, true), 0);
  assert.ok(smoothMouth([0, 0], 0.5, true) < 0.5);
  assert.equal(smoothMouth([1, 1], 0.5, false), 0);
  assert.ok(smoothMouth([1, 1], 0, true) <= 0.65);
  assert.ok(smoothMouth([1, 1], 0, true, true) <= 0.2);
  assert.equal(smoothMouth([NaN], 0, true), 0);
});
test("speaking only on playing; completion clears mouth; no replay", async () => {
  const f = fixture();
  await f.player.play(payload);
  assert.equal(f.events[0].type, "voice.speech.started");
  assert.ok(f.mouths.some((v) => v > 0));
  f.audio.currentTime = 1.5;
  f.audio.onended();
  assert.equal(f.events.at(-1).type, "voice.speech.finished");
  assert.equal(f.mouths.at(-1), 0);
  const count = f.events.length;
  await f.player.play(payload);
  assert.equal(f.events.length, count);
});
test("interruption cancels playback immediately", async () => {
  const f = fixture();
  await f.player.play(payload);
  f.player.stop();
  assert.equal(f.audio.paused, true);
  assert.equal(f.mouths.at(-1), 0);
  assert.equal(f.events.at(-1).type, "voice.speech.cancelled");
});
test("missing selected device never reports speaking", async () => {
  const f = fixture({ noDevice: true });
  f.player.device = "missing";
  await f.player.play(payload);
  assert.equal(f.events[0].type, "voice.speech.error");
  assert.ok(!f.speaking.includes(true));
});
test("delayed play after cancellation cannot revive mouth", async () => {
  const f = fixture({ delayed: true });
  const task = f.player.play(payload);
  await new Promise((r) => setTimeout(r, 0));
  f.player.stop();
  f.release();
  await task;
  assert.equal(f.audio.paused, true);
  assert.equal(f.mouths.at(-1), 0);
  assert.ok(!f.speaking.includes(true));
});
test("overlap rejected, long audio rejected, disconnect stays silent", async () => {
  const f = fixture();
  await f.player.play(payload);
  await assert.rejects(
    f.player.play({ ...payload, speechId: "second" }),
    /BUSY/,
  );
  f.player.stop("voice.speech.cancelled", false);
  await assert.rejects(
    f.player.play({ ...payload, speechId: "third", duration: 91 }),
    /INVALID/,
  );
  assert.equal(f.mouths.at(-1), 0);
});
