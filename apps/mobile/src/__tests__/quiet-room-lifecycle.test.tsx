import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AppState, AppStateStatus } from "react-native";
import QuietRoom from "../app/quiet-room";
import { usePreferences } from "../store/preferences";
import { request } from "../services/api";

jest.mock("../services/api", () => ({ request: jest.fn() }));
let change: (state: AppStateStatus) => void;
let now = 0;
const remove = jest.fn();
beforeEach(() => {
  jest.useFakeTimers();
  now = 0;
  AppState.currentState = "active";
  usePreferences.setState({ locale: "en" });
  jest.spyOn(performance, "now").mockImplementation(() => now);
  jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((_event, listener) => {
      change = listener;
      return { remove };
    });
  jest.clearAllMocks();
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  usePreferences.setState({ locale: "vi" });
});

test("Quiet Room counts delayed foreground time, pauses through background and resumes only on explicit consent", async () => {
  const view = await render(<QuietRoom />);
  await fireEvent.press(screen.getByText("2 min"));
  await fireEvent.press(screen.getByText("Enter Quiet Room"));
  now = 5600;
  await act(() => jest.advanceTimersByTime(250));
  expect(screen.getByText("01:55")).toBeTruthy();
  await act(() => change("background"));
  now = 300000;
  await act(() => {
    change("active");
    jest.advanceTimersByTime(1000);
  });
  expect(screen.getByText("01:55")).toBeTruthy();
  expect(screen.getByText("Continue")).toBeTruthy();
  await fireEvent.press(screen.getByText("Continue"));
  now += 114400;
  await act(() => jest.advanceTimersByTime(250));
  expect(screen.getByText("Your pause has ended.")).toBeTruthy();
  await fireEvent.press(screen.getByText("Stay a little longer"));
  expect(screen.queryByText("Your pause has ended.")).toBeNull();
  expect(request).not.toHaveBeenCalled();
  await view.unmount();
  expect(remove).toHaveBeenCalled();
});

test("untimed Quiet Room has no countdown or automatic completion", async () => {
  const interval = jest.spyOn(global, "setInterval");
  const view = await render(<QuietRoom />);
  await fireEvent.press(screen.getByText("Enter Quiet Room"));
  await act(() => {
    change("background");
    change("active");
    jest.advanceTimersByTime(600000);
  });
  expect(screen.queryByText("Your pause has ended.")).toBeNull();
  expect(interval).not.toHaveBeenCalled();
  expect(request).not.toHaveBeenCalled();
  await view.unmount();
});
