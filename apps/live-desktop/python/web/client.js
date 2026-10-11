/* Local prototype harness. No browser backend bearer or provider keys. */
/* global document, clearTimeout, fetch, WebSocket, location, setInterval, setTimeout, clearInterval, crypto, navigator, URLSearchParams */
import { VoicePlayer } from "/voice.mjs";
const element = (id) => document.getElementById(id);
let socket;
let idleTimer;
let heartbeat;
let rendererReady = false;
let safeFallback = false;
let voiceEnabled = false;
let suppressVoice = false;
let operatorPaused = false;
const seen = new Set();
const expressions = new Set(["blushing", "cry", "sullen_face"]);
const frame = element("avatar");
if (location.pathname === "/avatar") {
  document.body.classList.add("avatar-only");
  const params = new URLSearchParams(location.search);
  const bounded = (name, fallback, min, max) => {
    const n = Number(params.get(name) ?? fallback);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  };
  frame.style.transform = `translate(${bounded("x", 0, -50, 50)}%, ${bounded("y", 0, -50, 50)}%) scale(${bounded("scale", 1, 0.25, 2)})`;
}
const player = new VoicePlayer({
  emit: (event) => {
    if (socket?.readyState === 1) socket.send(JSON.stringify(event));
  },
  mouth: (value) => {
    if (frame.contentWindow) frame.contentWindow.__moriAudioMouth = value;
  },
  speaking: (active) => {
    command({ type: "audioSpeaking", active });
    element("status").textContent = active ? "Đang phát âm thanh" : "idle";
  },
  reduced: () => element("reduced").checked || safeFallback,
});
function command(value) {
  frame.contentWindow?.__moriReceive?.({ version: 1, ...value });
}
function state(value, crisis = false) {
  command({
    type: "setState",
    state: value,
    crisis,
    reducedMotion: element("reduced").checked,
  });
}
function stop() {
  clearTimeout(idleTimer);
  state("idle", safeFallback);
}
element("login").addEventListener("submit", async (event) => {
  event.preventDefault();
  // Explicit user gesture unlocks output; never requests microphone permissions.
  await player.unlock().catch(() => {});
  const token = element("token").value;
  element("token").value = "";
  try {
    const response = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Mori-Local": "1" },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) throw new Error();
    const configuration = await response.json();
    element("mode").textContent = configuration.mode;
    element("voice-mode").textContent =
      configuration.voice === "MockTTS"
        ? "MOCK — âm thử, không phải giọng nói"
        : configuration.voice;
    voiceEnabled = configuration.voice !== "disabled";
    element("runtime").hidden = false;
    element("login").hidden = true;
    socket = new WebSocket(`ws://${location.host}/ws`);
    socket.onopen = () => {
      frame.src = "/renderer/index.html";
      heartbeat = setInterval(
        () =>
          socket.readyState === 1 &&
          socket.send(JSON.stringify({ version: 1, type: "ping" })),
        20000,
      );
    };
    socket.onmessage = (message) => {
      let value;
      try {
        value = JSON.parse(message.data);
      } catch {
        return;
      }
      if (value.version !== 1) return;
      if (
        value.type === "state" &&
        ["thinking", "idle"].includes(value.state)
      ) {
        if (value.state === "thinking") {
          safeFallback = false;
          // A newly accepted server turn is an explicit new playback attempt,
          // including turns submitted from the separate operator dashboard.
          suppressVoice = operatorPaused || document.hidden;
          stop();
          state("thinking");
        }
        element("status").textContent = value.state;
      } else if (
        value.type === "response" &&
        typeof value.text === "string" &&
        value.text.length <= 4000 &&
        typeof value.eventId === "string" &&
        !seen.has(value.eventId)
      ) {
        if (seen.size >= 100) {
          socket.close();
          return;
        }
        seen.add(value.eventId);
        safeFallback = value.safeFallback === true;
        element("reply").textContent = value.text; // never HTML/actions/URLs
        state("idle", value.safeFallback === true);
        if (expressions.has(value.expression) && value.safeFallback === false)
          command({ type: "playExpression", expression: value.expression });
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          if (player.current) command({ type: "clearExpression" });
          else stop();
        }, 2000);
      } else if (
        value.type === "operator" &&
        ["pause", "stop", "mute", "start", "resume"].includes(value.action)
      ) {
        operatorPaused = ["pause", "stop", "mute"].includes(value.action);
        suppressVoice = operatorPaused;
        if (operatorPaused) {
          player.stop();
          stop();
        }
        command({ type: "pause", paused: operatorPaused || document.hidden });
        element("send").disabled = operatorPaused || !rendererReady;
        element("status").textContent = value.action;
      } else if (value.type === "voice.audio") {
        if (suppressVoice) {
          socket.send(
            JSON.stringify({
              version: 1,
              type: "voice.speech.cancelled",
              turnId: value.turnId,
              speechId: value.speechId,
              position: 0,
            }),
          );
          return;
        }
        player.play(value).catch(() => {
          player.stop("voice.speech.error");
        });
      } else if (
        ["voice.speech.cancelled", "voice.speech.error"].includes(value.type)
      ) {
        player.stop(value.type, false);
        stop();
      } else if (value.type === "error") {
        stop();
        element("status").textContent =
          "Lượt thất bại; kiểm tra API/session, không tự thử lại.";
      }
    };
    socket.onclose = () => {
      clearInterval(heartbeat);
      player.stop("voice.speech.cancelled", false);
      stop();
      command({ type: "pause", paused: true });
      element("send").disabled = true;
      element("status").textContent =
        "Mất kết nối. Tải lại trang để kết nối lại; không phát lại lượt cũ.";
    };
  } catch {
    element("status").textContent =
      "Không kết nối được. Kiểm tra mã operator và runtime.";
  }
});
frame.addEventListener("load", () => {
  if (!frame.getAttribute("src")) return;
  const timeout = setTimeout(() => {
    if (!rendererReady) {
      element("status").textContent = "Renderer không tải được trong 60 giây.";
      socket?.close();
    }
  }, 60000);
  frame.contentWindow.addEventListener("mori-renderer-event", (event) => {
    const value = JSON.parse(event.detail);
    if (value.type === "ready") {
      clearTimeout(timeout);
      rendererReady = true;
      socket.send(JSON.stringify({ version: 1, type: "ready" }));
      state("idle");
      command({ type: "pause", paused: operatorPaused || document.hidden });
      document.body.classList.add("avatar-ready");
      element("send").disabled = operatorPaused;
      element("status").textContent = "Snow Neko sẵn sàng";
    } else if (value.type === "error") {
      element("status").textContent = "Renderer lỗi; dừng lượt.";
      socket?.close();
    }
  });
});
element("chat").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!rendererReady || socket?.readyState !== 1) return;
  if (voiceEnabled) {
    try {
      await player.unlock();
    } catch {
      element("status").textContent = "Không mở được thiết bị âm thanh.";
      return;
    }
  }
  socket.send(
    JSON.stringify({
      version: 1,
      context: "PUBLIC_LIVE",
      type: "text",
      requestId: crypto.randomUUID(),
      eventId: crypto.randomUUID(),
      turnId: crypto.randomUUID(),
      text: element("text").value,
    }),
  );
  suppressVoice = false;
  element("text").value = "";
});
element("cancel").addEventListener("click", () => {
  suppressVoice = true;
  player.stop();
  stop();
  if (socket?.readyState === 1)
    socket.send(JSON.stringify({ version: 1, type: "cancel" }));
});
element("reduced").addEventListener("change", stop);
element("volume").addEventListener("input", () =>
  player.setVolume(Number(element("volume").value)),
);
element("device").addEventListener("change", () => {
  player.stop();
  player.device = element("device").value;
});
// Enumeration only: no getUserMedia, no microphone/camera permission request.
navigator.mediaDevices
  ?.enumerateDevices()
  .then((devices) => {
    for (const device of devices.filter(
      (item) => item.kind === "audiooutput" && item.deviceId,
    )) {
      const option = document.createElement("option");
      option.value = device.deviceId;
      option.textContent = device.label || "Thiết bị đầu ra";
      element("device").append(option);
    }
  })
  .catch(() => {
    element("device").disabled = true;
  });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    suppressVoice = true;
    player.stop();
  }
  command({ type: "pause", paused: document.hidden || operatorPaused });
});
