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
import { Memory } from "@mori/shared";
import { MemoryEditor } from "../features/memories/MemoryEditor";
import Memories from "../app/memories";
import { request } from "../services/api";
import { usePreferences } from "../store/preferences";
import { useSession } from "../store/session";
import { privateStorage } from "../lib/storage";

let mockBlocked = false;
let mockPrevent: (event: { data: { action: { type: string } } }) => void;
const mockDispatch = jest.fn();
jest.mock("expo-router", () => ({
  useNavigation: () => ({ dispatch: mockDispatch }),
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
}));
jest.mock("expo-router/react-navigation", () => ({
  usePreventRemove: (blocked: boolean, callback: typeof mockPrevent) => {
    mockBlocked = blocked;
    mockPrevent = callback;
  },
}));
jest.mock("../services/api", () => ({
  request: jest.fn(),
  refresh: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../lib/storage", () => ({ privateStorage: { setItem: jest.fn() } }));
const memory: Memory = {
  id: "memory-1",
  user_id: "memory-owner",
  created_at: "2026-10-01",
  content: "Nội dung gốc",
  category: "preference",
  approved_by_user: false,
  confidence: 1,
};
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(request).mockReset();
  mockBlocked = false;
  usePreferences.setState({ locale: "en" });
  useSession.setState({ userId: "memory-owner" });
});
afterEach(() => {
  onlineManager.setOnline(true);
  usePreferences.setState({ locale: "vi" });
});
async function setup(component: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  const view = await render(
    <QueryClientProvider client={client}>{component}</QueryClientProvider>,
  );
  return async () => {
    await view.unmount();
    client.clear();
  };
}
const saveButton = () =>
  screen.getByRole("button", { name: "Save and allow Mori to remember" });

test("dismissing dirty edits requires continue/discard choice and never writes a private draft", async () => {
  const close = jest.fn();
  const cleanup = await setup(<MemoryEditor memory={memory} onClose={close} />);
  await fireEvent.changeText(
    screen.getByLabelText("Memory content"),
    "Chỉnh sửa riêng tư",
  );
  await fireEvent.press(
    screen.getByLabelText("Close", { includeHiddenElements: true }),
  );
  await screen.findByText("You have edits in progress.");
  expect(close).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("Continue editing"));
  expect(screen.getByLabelText("Memory content").props.value).toBe(
    "Chỉnh sửa riêng tư",
  );
  await fireEvent.press(screen.getByText("Close editor"));
  await fireEvent.press(screen.getByText("Discard edits"));
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  expect(request).not.toHaveBeenCalled();
  expect(privateStorage.setItem).not.toHaveBeenCalled();
  await cleanup();
});

test("a slow save blocks duplicate presses/dismissal and approval follows the acknowledged update", async () => {
  let finish!: (value: unknown) => void;
  jest
    .mocked(request)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce({});
  const close = jest.fn();
  const cleanup = await setup(<MemoryEditor memory={memory} onClose={close} />);
  await fireEvent.changeText(
    screen.getByLabelText("Memory content"),
    "Updated words",
  );
  await fireEvent.press(saveButton());
  await fireEvent.press(saveButton());
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  await fireEvent.press(
    screen.getByLabelText("Close", { includeHiddenElements: true }),
  );
  expect(close).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(screen.getByLabelText("Memory content").props.editable).toBe(false),
  );
  await act(async () => finish({ ...memory, content: "Updated words" }));
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  expect(
    jest.mocked(request).mock.calls.map((call) => [call[0], call[1]]),
  ).toEqual([
    ["/memories/memory-1", "PATCH"],
    ["/memories/memory-1/approve", "POST"],
  ]);
  await cleanup();
});

test("a partial update/approval failure is explicit and retry submits only approval", async () => {
  jest
    .mocked(request)
    .mockResolvedValueOnce(memory)
    .mockRejectedValueOnce(new Error("Approval unavailable"))
    .mockResolvedValueOnce(memory);
  const close = jest.fn();
  const cleanup = await setup(<MemoryEditor memory={memory} onClose={close} />);
  await fireEvent.changeText(
    screen.getByLabelText("Memory content"),
    "Updated words",
  );
  await fireEvent.press(saveButton());
  await screen.findByText("Approval unavailable");
  await screen.findByText(
    "The server confirmed the content update. The approval step is not confirmed; previously granted permission has not been revoked.",
  );
  expect(close).not.toHaveBeenCalled();
  await fireEvent.press(saveButton());
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  expect(
    jest.mocked(request).mock.calls.filter((call) => call[1] === "PATCH"),
  ).toHaveLength(1);
  expect(
    jest
      .mocked(request)
      .mock.calls.filter((call) => call[0].endsWith("/approve")),
  ).toHaveLength(2);
  await cleanup();
});

test("a failed update retains edits, does not approve, and can be retried", async () => {
  jest
    .mocked(request)
    .mockRejectedValueOnce(new Error("Disconnected"))
    .mockResolvedValue({});
  const close = jest.fn();
  const cleanup = await setup(<MemoryEditor memory={memory} onClose={close} />);
  await fireEvent.changeText(
    screen.getByLabelText("Memory content"),
    "New words",
  );
  await fireEvent.press(saveButton());
  await screen.findByText("Disconnected");
  expect(screen.getByLabelText("Memory content").props.value).toBe("New words");
  expect(request).toHaveBeenCalledTimes(1);
  expect(close).not.toHaveBeenCalled();
  await fireEvent.press(saveButton());
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  expect(jest.mocked(request).mock.calls[0][2]).toEqual(
    jest.mocked(request).mock.calls[1][2],
  );
  await cleanup();
});

test("offline save fails visibly and reconnecting does not replay it", async () => {
  onlineManager.setOnline(false);
  jest.mocked(request).mockRejectedValue(new Error("Offline now"));
  const close = jest.fn();
  const cleanup = await setup(<MemoryEditor memory={memory} onClose={close} />);
  await fireEvent.changeText(
    screen.getByLabelText("Memory content"),
    "Keep offline edits",
  );
  await fireEvent.press(saveButton());
  await screen.findByText("Offline now");
  expect(request).toHaveBeenCalledTimes(1);
  await act(async () => onlineManager.setOnline(true));
  expect(request).toHaveBeenCalledTimes(1);
  expect(close).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Memory content").props.value).toBe(
    "Keep offline edits",
  );
  await cleanup();
});

test("an ambiguous create retries the frozen payload and UUID, with explicit consent and no fuzzy matching", async () => {
  jest
    .mocked(request)
    .mockRejectedValueOnce(new Error("Response lost"))
    .mockResolvedValueOnce({ ...memory, id: "created-1" });
  const close = jest.fn();
  const cleanup = await setup(<MemoryEditor memory={null} onClose={close} />);
  await fireEvent.changeText(
    screen.getByLabelText("Memory content"),
    "New private words",
  );
  await fireEvent.press(saveButton());
  await screen.findByText("Response lost");
  expect(close).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Memory content").props.editable).toBe(false);
  expect(request).toHaveBeenCalledTimes(1);
  await fireEvent.press(saveButton());
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  expect(request).toHaveBeenCalledTimes(2);
  expect(jest.mocked(request).mock.calls[0]).toEqual(
    jest.mocked(request).mock.calls[1],
  );
  expect(request).toHaveBeenCalledWith(
    "/memories",
    "POST",
    {
      content: "New private words",
      category: "preference",
      client_id: expect.any(String),
    },
    { owner: "memory-owner" },
  );
  expect(privateStorage.setItem).not.toHaveBeenCalled();
  await cleanup();
});

test("route removal waits for explicit discard; continuing cancels the queued navigation", async () => {
  const close = jest.fn();
  const cleanup = await setup(<MemoryEditor memory={memory} onClose={close} />);
  await fireEvent.changeText(
    screen.getByLabelText("Memory content"),
    "Unsaved",
  );
  expect(mockBlocked).toBe(true);
  await act(async () => mockPrevent({ data: { action: { type: "GO_BACK" } } }));
  await fireEvent.press(screen.getByText("Continue editing"));
  expect(mockDispatch).not.toHaveBeenCalled();
  await act(async () => mockPrevent({ data: { action: { type: "GO_BACK" } } }));
  await fireEvent.press(screen.getByText("Discard edits"));
  await waitFor(() =>
    expect(mockDispatch).toHaveBeenCalledWith({ type: "GO_BACK" }),
  );
  await cleanup();
});

test("switching account destroys ephemeral edits and a late update cannot approve for the next account", async () => {
  let finish!: (value: unknown) => void;
  jest.mocked(request).mockImplementation(async (_path, method) => {
    if (!method || method === "GET") return [memory] as never;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const cleanup = await setup(<Memories />);
  await fireEvent.press(await screen.findByText("Edit"));
  await fireEvent.changeText(
    screen.getByLabelText("Memory content"),
    "Private unsent changes",
  );
  await fireEvent.press(saveButton());
  await waitFor(() =>
    expect(
      jest.mocked(request).mock.calls.some((call) => call[1] === "PATCH"),
    ).toBe(true),
  );
  await act(async () => useSession.setState({ userId: "next-owner" }));
  expect(screen.queryByLabelText("Memory content")).toBeNull();
  await act(async () => finish(memory));
  expect(
    jest
      .mocked(request)
      .mock.calls.some((call) => call[0].endsWith("/approve")),
  ).toBe(false);
  expect(privateStorage.setItem).not.toHaveBeenCalled();
  await cleanup();
});
