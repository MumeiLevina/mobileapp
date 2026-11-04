import { act, renderHook } from "@testing-library/react-native";
import { AppState, AppStateStatus, Platform } from "react-native";
import { useActivityTimer } from "../hooks/useActivityTimer";

let change: (state: AppStateStatus) => void;
let blur: () => void;
let focus: () => void;
let now = 0;
const remove = jest.fn();
let subscribedEvents: string[] = [];
const originalPlatform = Platform.OS;
beforeEach(() => {
  Platform.OS = "android";
  AppState.currentState = "active";
  jest.useFakeTimers();
  now = 0;
  subscribedEvents = [];
  jest.spyOn(performance, "now").mockImplementation(() => now);
  jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((event, listener) => {
      subscribedEvents.push(event);
      // react-native-web only accepts "change"/"memoryWarning" and throws for
      // any other type. Mirror that so the web path is exercised for real.
      if (Platform.OS === "web" && event !== "change") {
        throw new Error(`Trying to subscribe to unknown event: "${event}"`);
      }
      if (event === "change") change = listener as (state: AppStateStatus) => void;
      if (event === "blur") blur = listener as () => void;
      if (event === "focus") focus = listener as () => void;
      return { remove };
    });
  remove.mockClear();
});
afterEach(() => {
  Platform.OS = originalPlatform;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test("a delayed tick measures foreground time rather than counting callbacks", async () => {
  const interval = jest.spyOn(global, "setInterval");
  const clear = jest.spyOn(global, "clearInterval");
  const view = await renderHook(() => useActivityTimer(120));
  await act(() => view.result.current.start());
  now = 5600;
  await act(() => jest.advanceTimersByTime(250));
  expect(view.result.current.elapsed).toBe(5);
  expect(view.result.current.running).toBe(true);
  await view.unmount();
  expect(remove).toHaveBeenCalledTimes(3);
  expect(clear).toHaveBeenCalledWith(interval.mock.results[0].value);
});

test.each(["inactive", "background"] as AppStateStatus[])(
  "%s pauses and returning requires explicit resume, retaining fractional time",
  async (state) => {
    const view = await renderHook(() => useActivityTimer(120));
    await act(() => view.result.current.start());
    now = 2450;
    await act(() => change(state));
    expect(view.result.current).toMatchObject({
      elapsed: 2,
      running: false,
      interrupted: true,
    });
    now = 120000;
    await act(() => {
      change("active");
      jest.advanceTimersByTime(5000);
    });
    expect(view.result.current).toMatchObject({ elapsed: 2, running: false });
    await act(() => view.result.current.start());
    now += 550;
    await act(() => jest.advanceTimersByTime(250));
    expect(view.result.current).toMatchObject({
      elapsed: 3,
      running: true,
      interrupted: false,
    });
    await view.unmount();
  },
);

test("manual pause excludes paused time, repeated start does not reset, and duration clamps without automatic completion", async () => {
  const view = await renderHook(() => useActivityTimer(3));
  await act(() => view.result.current.start());
  now = 1250;
  await act(() => {
    view.result.current.start();
    view.result.current.pause();
  });
  now = 50000;
  await act(() => view.result.current.start());
  now = 52000;
  await act(() => jest.advanceTimersByTime(250));
  expect(view.result.current).toMatchObject({ elapsed: 3, running: false });
  await act(() => view.result.current.start());
  expect(view.result.current.running).toBe(false);
  await view.unmount();
});

test("a delayed start acknowledgement after background/foreground stays paused", async () => {
  const view = await renderHook(() => useActivityTimer(120));
  const acknowledge = view.result.current.prepareStart();
  await act(() => {
    change("background");
    change("active");
  });
  await act(() => acknowledge());
  expect(view.result.current).toMatchObject({
    elapsed: 0,
    running: false,
    interrupted: true,
  });
  await act(() => view.result.current.start());
  expect(view.result.current.running).toBe(true);
  await view.unmount();
  await act(() => acknowledge());
});

test("Android blur pauses the timer even while AppState remains active; focus never resumes", async () => {
  const view = await renderHook(() => useActivityTimer(120));
  await act(() => view.result.current.start());
  now = 3450;
  await act(() => blur());
  expect(view.result.current).toMatchObject({
    elapsed: 3,
    running: false,
    interrupted: true,
  });
  now = 100000;
  await act(() => {
    focus();
    jest.advanceTimersByTime(1000);
  });
  expect(view.result.current).toMatchObject({ elapsed: 3, running: false });
  await act(() => view.result.current.start());
  now += 550;
  await act(() => jest.advanceTimersByTime(250));
  expect(view.result.current).toMatchObject({
    elapsed: 4,
    running: true,
    interrupted: false,
  });
  await view.unmount();
});

test("web never subscribes to blur/focus and cannot crash on unknown events", async () => {
  Platform.OS = "web";
  const view = await renderHook(() => useActivityTimer(120));
  await act(() => view.result.current.start());
  expect(view.result.current.running).toBe(true);
  now = 2600;
  await act(() => jest.advanceTimersByTime(250));
  expect(view.result.current.elapsed).toBe(2);
  await act(() => change("background"));
  expect(view.result.current).toMatchObject({ running: false, interrupted: true });
  await act(() => change("active"));
  await act(() => view.result.current.start());
  expect(view.result.current.running).toBe(true);
  expect(subscribedEvents).toEqual(["change"]);
  await view.unmount();
});

test("native platforms still subscribe to blur and focus", async () => {
  const view = await renderHook(() => useActivityTimer(120));
  expect(subscribedEvents).toEqual(["change", "blur", "focus"]);
  await view.unmount();
  expect(remove).toHaveBeenCalledTimes(3);
});

test("Android blur prevents starting until focus returns and invalidates delayed starts", async () => {
  const view = await renderHook(() => useActivityTimer(120));
  const acknowledge = view.result.current.prepareStart();
  await act(() => blur());
  await act(() => {
    acknowledge();
    view.result.current.start();
  });
  expect(view.result.current).toMatchObject({
    elapsed: 0,
    running: false,
    interrupted: true,
  });
  await act(() => focus());
  await act(() => acknowledge());
  expect(view.result.current.running).toBe(false);
  await act(() => view.result.current.start());
  expect(view.result.current.running).toBe(true);
  await view.unmount();
});
