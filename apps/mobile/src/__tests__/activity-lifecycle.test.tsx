import { act, renderHook } from "@testing-library/react-native";
import { AppState, AppStateStatus } from "react-native";
import { useActivityTimer } from "../hooks/useActivityTimer";

let change: (state: AppStateStatus) => void;
let now = 0;
const remove = jest.fn();
beforeEach(() => {
  AppState.currentState = "active";
  jest.useFakeTimers();
  now = 0;
  jest.spyOn(performance, "now").mockImplementation(() => now);
  jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((_event, listener) => {
      change = listener;
      return { remove };
    });
  remove.mockClear();
});
afterEach(() => {
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
  expect(remove).toHaveBeenCalledTimes(1);
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
