import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router } from "expo-router";
import PrivateConversation from "../app/private-conversation";
import { request } from "../services/api";
import { usePreferences } from "../store/preferences";
import { privateStorage } from "../lib/storage";
import { useSession } from "../store/session";

let mockBlocked = false;
let mockPrevent: () => void;
jest.mock("expo-router/react-navigation", () => ({
  usePreventRemove: (blocked: boolean, callback: () => void) => {
    mockBlocked = blocked;
    mockPrevent = callback;
  },
}));
jest.mock("../lib/storage", () => ({ privateStorage: { setItem: jest.fn() } }));

jest.mock("../services/api", () => ({
  request: jest.fn(),
  refresh: jest.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  useSession.setState({ userId: "demo" });
  jest.clearAllMocks();
  mockBlocked = false;
  usePreferences.setState({ locale: "en" });
  jest.mocked(request).mockResolvedValue({
    message: { id: "reply", role: "assistant", content: "A private reply" },
    safetyLevel: "normal",
  });
});

test.each(["send", "save"])(
  "account switching during private %s clears ephemeral state and ignores the late acknowledgement",
  async (operation) => {
    const cleanup = await setup();
    if (operation === "save") await sendMessage();
    let finish!: (value: unknown) => void;
    jest.mocked(request).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    if (operation === "send") {
      await fireEvent.changeText(
        screen.getByLabelText("Private message"),
        "Synthetic old private words",
      );
      await fireEvent.press(screen.getByLabelText("Send"));
    } else {
      await fireEvent.press(
        screen.getByLabelText("Leave private conversation"),
      );
      await fireEvent.press(screen.getByText("Save"));
    }
    await waitFor(() => expect(finish).toBeDefined());
    await act(async () => useSession.setState({ userId: "next-owner" }));
    expect(screen.getByLabelText("Private message").props.value).toBe("");
    await act(async () =>
      finish(
        operation === "save"
          ? { id: "old-private" }
          : {
              message: {
                id: "late",
                role: "assistant",
                content: "Late old reply",
              },
              safetyLevel: "normal",
            },
      ),
    );
    expect(screen.queryByText("Late old reply")).toBeNull();
    expect(screen.queryByText("A private reply")).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
    expect(privateStorage.setItem).not.toHaveBeenCalled();
    expect(
      jest
        .mocked(request)
        .mock.calls.every((call) => call[3]?.owner === "demo"),
    ).toBe(true);
    await cleanup();
  },
);
afterEach(() => usePreferences.setState({ locale: "vi" }));

async function setup() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: Infinity } },
  });
  const view = await render(
    <QueryClientProvider client={client}>
      <PrivateConversation />
    </QueryClientProvider>,
  );
  return async () => {
    await view.unmount();
    client.clear();
  };
}
async function sendMessage() {
  await fireEvent.changeText(
    screen.getByLabelText("Private message"),
    "Chỉnh sửa",
  );
  await fireEvent.press(screen.getByLabelText("Send"));
  await screen.findByText("A private reply");
}

test("private content is unchanged in English; cancel resumes and discard never saves", async () => {
  const cleanup = await setup();
  expect(screen.getByText("Private")).toBeTruthy();
  await sendMessage();
  expect(screen.getByText("Chỉnh sửa")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Leave private conversation"));
  await fireEvent.press(screen.getByText("Keep chatting"));
  expect(screen.getByText("A private reply")).toBeTruthy();
  expect(router.replace).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText("Leave private conversation"));
  await fireEvent.press(screen.getByText("Leave without saving"));
  expect(router.replace).toHaveBeenCalledWith("/(tabs)/talk");
  expect(screen.queryByText("A private reply")).toBeNull();
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith(
    "/private-conversations/messages",
    "POST",
    expect.objectContaining({ history: [], content: "Chỉnh sửa" }),
    { owner: "demo" },
  );
  await cleanup();
});

test("saving cannot dismiss the sheet and saves the complete session once", async () => {
  const cleanup = await setup();
  await sendMessage();
  let finish!: (value: unknown) => void;
  jest.mocked(request).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await fireEvent.press(screen.getByLabelText("Leave private conversation"));
  await fireEvent.press(screen.getByText("Save"));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  // Wait until the saving UI is committed before attempting to dismiss the sheet.
  // Otherwise the close event can race with the mutation's pending state in CI.
  await screen.findByText("Saving conversation…");
  expect(mockBlocked).toBe(true);
  await act(() => mockPrevent());
  expect(router.replace).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByLabelText("Close", { includeHiddenElements: true }),
  );
  expect(screen.getByText("Keep this conversation?")).toBeTruthy();
  await fireEvent.press(screen.getByText("Keep chatting"));
  expect(screen.getByText("Keep this conversation?")).toBeTruthy();
  await fireEvent.press(screen.getByText("Leave without saving"));
  expect(router.replace).not.toHaveBeenCalled();
  expect(request).toHaveBeenLastCalledWith(
    "/private-conversations/save",
    "POST",
    expect.objectContaining({
      messages: [
        expect.objectContaining({ role: "user", content: "Chỉnh sửa" }),
        expect.objectContaining({ role: "assistant" }),
      ],
    }),
    { owner: "demo" },
  );
  await act(async () => finish({ id: "saved-private" }));
  await waitFor(() =>
    expect(router.replace).toHaveBeenCalledWith("/conversation/saved-private"),
  );
  expect(mockBlocked).toBe(false);
  await cleanup();
});

test("route removal with unsent private text opens the same explicit choice and never persists it", async () => {
  const cleanup = await setup();
  expect(mockBlocked).toBe(false);
  await fireEvent.changeText(
    screen.getByLabelText("Private message"),
    "Synthetic unsent text",
  );
  expect(mockBlocked).toBe(true);
  await act(() => mockPrevent());
  await screen.findByText("Keep this conversation?");
  expect(router.replace).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("Keep chatting"));
  expect(screen.getByLabelText("Private message").props.value).toBe(
    "Synthetic unsent text",
  );
  expect(mockBlocked).toBe(true);
  await act(() => mockPrevent());
  await fireEvent.press(screen.getByText("Leave without saving"));
  await waitFor(() => expect(mockBlocked).toBe(false));
  expect(router.replace).toHaveBeenCalledWith("/(tabs)/talk");
  expect(privateStorage.setItem).not.toHaveBeenCalled();
  expect(request).not.toHaveBeenCalled();
  await cleanup();
});

test("an unsent message blocks explicit save and remains available when resuming", async () => {
  const cleanup = await setup();
  await sendMessage();
  await fireEvent.changeText(
    screen.getByLabelText("Private message"),
    "Chưa gửi",
  );
  await fireEvent.press(screen.getByLabelText("Leave private conversation"));
  await screen.findByText(
    "You have an unsent message. Keep chatting to send or clear it before saving.",
  );
  await fireEvent.press(screen.getByText("Save"));
  expect(request).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByText("Keep chatting"));
  expect(screen.getByLabelText("Private message").props.value).toBe("Chưa gửi");
  await cleanup();
});

test("a private send failure offers manual retry without a persisted draft", async () => {
  jest.mocked(request).mockRejectedValueOnce(new Error("Disconnected"));
  const cleanup = await setup();
  await fireEvent.changeText(
    screen.getByLabelText("Private message"),
    "Chưa gửi",
  );
  await fireEvent.press(screen.getByLabelText("Send"));
  await screen.findByText("Disconnected");
  expect(screen.getByLabelText("Private message").props.value).toBe("Chưa gửi");
  await fireEvent.press(screen.getByText("Try again"));
  await screen.findByText("A private reply");
  expect(request).toHaveBeenCalledTimes(2);
  expect(screen.getAllByText("Chưa gửi")).toHaveLength(1);
  await cleanup();
});
