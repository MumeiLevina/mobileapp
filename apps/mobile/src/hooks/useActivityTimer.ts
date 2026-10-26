import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

// Count foreground practice time, not interval callbacks. Backgrounding pauses
// explicitly; returning never resumes practice or submits a completion request.
export function useActivityTimer(duration: number) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [interrupted, setInterrupted] = useState(false);
  const accumulated = useRef(0);
  const started = useRef<number | null>(null);
  const interruptions = useRef(0);
  const alive = useRef(true);
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
    if (AppState.currentState && AppState.currentState !== "active") {
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
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") interruptions.current += 1;
      if (state !== "active" && started.current !== null) {
        pause();
        setInterrupted(true);
      }
    });
    return () => {
      alive.current = false;
      started.current = null;
      subscription.remove();
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
