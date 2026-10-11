/* global Audio, AudioContext, URL, Blob, atob, performance, requestAnimationFrame, cancelAnimationFrame, setInterval, clearInterval */
export function smoothMouth(samples, previous, active, reduced = false) {
  if (!active || !samples.length) return 0;
  let energy = 0;
  for (const sample of samples) energy += sample * sample;
  const rms = Math.sqrt(energy / samples.length);
  if (!Number.isFinite(rms) || rms < 0.012)
    return previous < 0.01 ? 0 : previous * 0.55;
  const target = Math.min(reduced ? 0.2 : 0.65, (rms - 0.012) * 8);
  return Math.max(
    0,
    Math.min(
      0.65,
      previous + (target - previous) * (target > previous ? 0.45 : 0.25),
    ),
  );
}

export class VoicePlayer {
  constructor({ emit, mouth, speaking, reduced, factory }) {
    this.emit = emit;
    this.mouth = mouth;
    this.speaking = speaking;
    this.reduced = reduced;
    this.factory =
      factory || (() => ({ audio: new Audio(), context: new AudioContext() }));
    this.seen = new Set();
    this.current = null;
    this.volume = 0.6;
    this.device = "";
  }
  async unlock() {
    if (!this.media) {
      this.media = this.factory();
      const { audio, context } = this.media;
      this.analyser = context.createAnalyser();
      this.analyser.fftSize = 512;
      context.createMediaElementSource(audio).connect(this.analyser);
      this.analyser.connect(context.destination);
    }
    await this.media.context.resume();
  }
  async play(payload) {
    if (this.seen.has(payload.speechId)) return;
    if (this.current || this.seen.size >= 100) throw new Error("VOICE_BUSY");
    if (
      typeof payload.audio !== "string" ||
      payload.audio.length > 6000000 ||
      !Number.isFinite(payload.duration) ||
      payload.duration <= 0 ||
      payload.duration > 90
    )
      throw new Error("AUDIO_INVALID");
    this.seen.add(payload.speechId);
    const current = {
      turnId: payload.turnId,
      speechId: payload.speechId,
      position: 0,
      started: false,
      start: performance.now(),
      lastProgress: performance.now(),
    };
    this.current = current;
    const event = (type) =>
      this.emit({
        version: 1,
        type,
        turnId: current.turnId,
        speechId: current.speechId,
        position: current.position,
      });
    current.event = event;
    try {
      await this.unlock();
      if (this.current !== current) return;
      const { audio } = this.media;
      if (this.device) {
        if (typeof audio.setSinkId !== "function")
          throw new Error("DEVICE_UNSUPPORTED");
        await audio.setSinkId(this.device);
        if (this.current !== current) return;
      }
      const data = Uint8Array.from(atob(payload.audio), (c) => c.charCodeAt(0));
      current.url = URL.createObjectURL(
        new Blob([data], { type: "audio/wav" }),
      );
      audio.volume = this.volume;
      audio.src = current.url;
      audio.onplaying = () => {
        if (this.current !== current || current.started) return;
        current.started = true;
        event("voice.speech.started");
        this.speaking(true);
        const samples = new Float32Array(this.analyser.fftSize);
        let previous = 0;
        const tick = () => {
          if (this.current !== current) return;
          this.analyser.getFloatTimeDomainData(samples);
          previous = smoothMouth(
            samples,
            previous,
            !audio.paused && !audio.ended && audio.volume > 0,
            this.reduced(),
          );
          this.mouth(previous);
          current.frame = requestAnimationFrame(tick);
        };
        tick();
      };
      audio.ontimeupdate = () => {
        if (this.current !== current || !current.started) return;
        current.position = Math.max(
          current.position,
          Math.min(payload.duration, audio.currentTime),
        );
        current.lastProgress = performance.now();
        event("voice.speech.progress");
      };
      audio.onended = () => {
        if (this.current !== current || !current.started) return;
        current.position = Math.min(payload.duration, audio.currentTime);
        this.stop("voice.speech.finished");
      };
      audio.onerror = () =>
        this.current === current && this.stop("voice.speech.error");
      current.watchdog = setInterval(() => {
        if (
          performance.now() - current.lastProgress > 15000 ||
          performance.now() - current.start > (payload.duration + 20) * 1000
        )
          this.stop("voice.speech.error");
      }, 1000);
      await audio.play(); // 'playing', not this promise alone, sets speaking
      if (this.current !== current && !this.current) audio.pause();
    } catch {
      if (this.current === current) this.stop("voice.speech.error");
    }
  }
  stop(reason = "voice.speech.cancelled", notify = true) {
    const current = this.current;
    this.current = null;
    if (current) {
      cancelAnimationFrame(current.frame);
      clearInterval(current.watchdog);
      const audio = this.media?.audio;
      if (audio) {
        audio.onplaying =
          audio.ontimeupdate =
          audio.onended =
          audio.onerror =
            null;
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
      if (current.url) URL.revokeObjectURL(current.url);
      if (notify) current.event(reason);
    }
    this.mouth(0);
    this.speaking(false);
  }
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.media) this.media.audio.volume = this.volume;
  }
}
