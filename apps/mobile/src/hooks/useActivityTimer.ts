import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

// Count foreground practice time, not interval callbacks. Backgrounding and
// Android focus loss (e.g. notification shade) pause explicitly; returning never
// resumes practice or submits a completion request.
export function useActivityTimer(duration: number) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [interrupted, setInterrupted] = useState(false);
  const accumulated = useRef(0);
  const started = useRef<number | null>(null);
  const interruptions = useRef(0);
  const alive = useRef(true);
  // Android can emit blur without changing AppState.currentState from "active".
  const focused = useRef(true);
  const limit = Math.max(0, duration * 1000);
  function read() {
    return Math.min(
      limit,
      accumulated.current +
        (started.current === null
          ? 0
          : Math.max(0, performance.now() - started.current)),
    );
  }
  function pause() {
    accumulated.current = read();
    started.current = null;
    setElapsed(Math.floor(accumulated.current / 1000));
    setRunning(false);
  }
  function start() {
    if (
      !alive.current ||
      started.current !== null ||
      accumulated.current >= limit
    )
      return;
    if (
      !focused.current ||
      (AppState.currentState && AppState.currentState !== "active")
    ) {
      setInterrupted(true);
      return;
    }
    started.current = performance.now();
    setInterrupted(false);
    setRunning(true);
  }
  function prepareStart() {
    const checkpoint = interruptions.current;
    return () => {
      if (!alive.current) return;
      if (checkpoint !== interruptions.current) {
        setInterrupted(true);
        return;
      }
      start();
    };
  }
  useEffect(() => {
    alive.current = true;
    const interrupt = () => {
      interruptions.current += 1;
      if (started.current !== null) {
        pause();
        setInterrupted(true);
      }
    };
    const stateSubscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") interrupt();
    });
    const focusSubscriptions: { remove: () => void }[] = [];
    // Android focus/blur events are native-only. react-native-web rejects any
    // event type other than "change"/"memoryWarning" and throws on "blur"/
    // "focus", which would break every screen that mounts this timer (quiet
    // room, breathing activity) on web. On web, visibility changes already
    // arrive via "change", so focus tracking is redundant there. Subscribe to
    // each event individually and guard each: a platform that lacks one keeps
    // the other instead of crashing the screen.
    if (Platform.OS !== "web") {
      try {
        focusSubscriptions.push(
          AppState.addEventListener("blur", () => {
            focused.current = false;
            interrupt();
          }),
        );
      } catch {
        // A platform without blur events keeps the AppState-only behaviour.
      }
      try {
        focusSubscriptions.push(
          AppState.addEventListener("focus", () => {
            // Focus returning is not permission to resume the timer.
            focused.current = true;
          }),
        );
      } catch {
        // A platform without focus events keeps the AppState-only behaviour.
      }
    }
    return () => {
      alive.current = false;
      started.current = null;
      stateSubscription.remove();
      for (const subscription of focusSubscriptions) subscription.remove();
    };
  }, [limit]);
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      const value = read();
      setElapsed(Math.floor(value / 1000));
      if (value >= limit) pause();
    }, 250);
    return () => clearInterval(interval);
  }, [running, limit]);
  return { elapsed, running, interrupted, start, pause, prepareStart };
}
