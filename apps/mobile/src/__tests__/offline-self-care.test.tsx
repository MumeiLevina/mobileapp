import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "@tanstack/react-query";
import ActivityScreen from "../app/activity/[id]";
import SelfCare from "../app/self-care";
import { request } from "../services/api";
import { usePreferences } from "../store/preferences";
import { useSession } from "../store/session";

let mockId = "water";
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: mockId }),
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
}));
jest.mock("../services/api", () => ({
  request: jest.fn(),
  refresh: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../lib/config", () => ({ config: { demo: false } }));
jest.mock("../features/garden/GardenScene", () => ({
  GardenScene: () => null,
}));
jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: {
    View: jest.requireActual<typeof import("react-native")>("react-native")
      .View,
  },
  useReducedMotion: () => true,
  useSharedValue: () => ({ value: 1 }),
  useAnimatedStyle: () => ({}),
  cancelAnimation: jest.fn(),
}));
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(request).mockReset();
  mockId = "water";
  useSession.setState({ userId: "connected-offline-owner" });
  usePreferences.setState({ locale: "en" });
});
afterEach(() => {
  onlineManager.setOnline(true);
  usePreferences.setState({ locale: "vi" });
});
async function setup(component: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: Infinity } },
  });
  const view = await render(
    <QueryClientProvider client={client}>{component}</QueryClientProvider>,
  );
  return async () => {
    await view.unmount();
    client.clear();
  };
}

test("the bundled curated library is browsable without any API request and durations follow locale", async () => {
  jest.mocked(request).mockRejectedValue(new Error("Render unavailable"));
  const cleanup = await setup(<SelfCare />);
  expect(screen.getByText("Two-minute breathing")).toBeTruthy();
  expect(screen.getAllByText(/min ·/).length).toBeGreaterThan(0);
  expect(request).not.toHaveBeenCalled();
  await cleanup();
});

test("local practice can pause, resume and finish without completion/sync/growth requests", async () => {
  const cleanup = await setup(<ActivityScreen />);
  await fireEvent.press(screen.getByText("Practise without saving"));
  expect(
    screen.getByText(
      "Practising on this device. No data is sent to your account.",
    ),
  ).toBeTruthy();
  await fireEvent.press(screen.getByText("Pause"));
  await fireEvent.press(screen.getByText("Continue"));
  await fireEvent.press(screen.getByText("I have finished"));
  await screen.findByText(
    "This break stayed on your device. It was not sent to your account or recorded as Garden progress.",
  );
  expect(request).not.toHaveBeenCalled();
  await cleanup();
});

test("a failed server start remains explicit; choosing local practice does not retry it", async () => {
  onlineManager.setOnline(false);
  jest.mocked(request).mockRejectedValue(new Error("Disconnected"));
  const cleanup = await setup(<ActivityScreen />);
  await fireEvent.press(screen.getByText("Begin when you are ready"));
  await screen.findByText("Disconnected");
  await fireEvent.press(screen.getByText("Practise without saving"));
  expect(screen.queryByText("Disconnected")).toBeNull();
  await fireEvent.press(screen.getByText("I have finished"));
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith("/self-care/water/start", "POST", undefined, { owner: "connected-offline-owner" });
  expect(
    screen.queryByText(
      "The server confirmed completion. You can return to your day.",
    ),
  ).toBeNull();
  await cleanup();
});

test("completion failure does not claim confirmation and manual retry keeps the server session", async () => {
  let finish!: (value: unknown) => void;
  jest
    .mocked(request)
    .mockResolvedValueOnce({ id: "server-session" })
    .mockRejectedValueOnce(new Error("Completion lost"))
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
  const cleanup = await setup(<ActivityScreen />);
  await fireEvent.press(screen.getByText("Begin when you are ready"));
  await fireEvent.press(await screen.findByText("I have finished"));
  await screen.findByText("Completion lost");
  expect(
    screen.queryByText(
      "The server confirmed completion. You can return to your day.",
    ),
  ).toBeNull();
  await fireEvent.press(screen.getByText("I have finished"));
  await fireEvent.press(
    screen.getByRole("button", { name: "I have finished" }),
  );
  await waitFor(() => expect(request).toHaveBeenCalledTimes(3));
  expect(jest.mocked(request).mock.calls[1]).toEqual(
    jest.mocked(request).mock.calls[2],
  );
  await act(async () => finish({ ok: true }));
  await screen.findByText(
    "The server confirmed completion. You can return to your day.",
  );
  await cleanup();
});

test("an unknown local activity has a clear error without fetching a substitute", async () => {
  mockId = "unknown-activity";
  const cleanup = await setup(<ActivityScreen />);
  expect(screen.getByText("Activity not found.")).toBeTruthy();
  expect(request).not.toHaveBeenCalled();
  await cleanup();
});

test("self-care start uses the initiating owner and ignores a late response after account switch", async () => {
  let resolveStart!: (value: { id: string }) => void;
  jest.mocked(request).mockImplementationOnce(
    () => new Promise((resolve) => { resolveStart = resolve; }),
  );
  const cleanup = await setup(<ActivityScreen />);
  await fireEvent.press(screen.getByText("Begin when you are ready"));
  expect(request).toHaveBeenCalledWith(
    "/self-care/water/start", "POST", undefined, { owner: "connected-offline-owner" },
  );
  useSession.setState({ userId: "second-account" });
  await act(async () => resolveStart({ id: "previous-owner-session" }));
  expect(screen.queryByText("I have finished")).toBeNull();
  expect(request).toHaveBeenCalledTimes(1);
  await cleanup();
});

test("self-care completion retains its owner even when the session changes before acknowledgement", async () => {
  let resolveComplete!: (value: unknown) => void;
  jest.mocked(request)
    .mockResolvedValueOnce({ id: "first-owner-session" })
    .mockImplementationOnce(() => new Promise((resolve) => { resolveComplete = resolve; }));
  const cleanup = await setup(<ActivityScreen />);
  await fireEvent.press(screen.getByText("Begin when you are ready"));
  await fireEvent.press(await screen.findByText("I have finished"));
  expect(jest.mocked(request).mock.calls[1]).toEqual([
    "/self-care/water/complete", "POST",
    { session_id: "first-owner-session" },
    { owner: "connected-offline-owner" },
  ]);
  useSession.setState({ userId: "second-account" });
  await act(async () => resolveComplete({ ok: true }));
  expect(screen.queryByText("The server confirmed completion. You can return to your day.")).toBeNull();
  await cleanup();
});
