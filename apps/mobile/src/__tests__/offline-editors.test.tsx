import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router } from "expo-router";
import JournalEditor from "../app/journal/[id]";
import ConversationScreen from "../app/conversation/[id]";
import GuidedJournalSession from "../app/guided-journal/[id]";
import { getGuidedJournalTemplate } from "@mori/shared";
import { createGuidedJournalDraft } from "../features/journal/guided-draft";
import { privateStorage } from "../lib/storage";
import {
  clearUserDeviceData,
  readDraft,
  writeDraft,
  createDraftIfEmptyWriter,
} from "../services/cleanup";
import { request } from "../services/api";
import { usePreferences } from "../store/preferences";
import { useSession } from "../store/session";
import { readChatDraft } from "../features/conversation/chat-draft";

let mockRouteId = "new";
const mockStored = new Map<string, string>();
jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: jest.fn(),
  },
  useLocalSearchParams: () => ({ id: mockRouteId }),
}));
jest.mock("../services/api", () => ({
  request: jest.fn(),
  refresh: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../services/notifications", () => ({
  cancelAllMoriNotifications: jest.fn(),
}));
jest.mock("../lib/storage", () => ({
  privateStorage: {
    getItem: jest.fn(async (key: string) => mockStored.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockStored.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      mockStored.delete(key);
    }),
  },
}));

const clientId = "77777777-7777-4777-a777-777777777777";

test("a late conversation send cannot publish a reply or clear the next owner's draft", async () => {
  mockRouteId = "conversation-1";
  mockStored.set("mori.next-owner.chat.conversation-1", "Next owner's draft");
  let finish!: (value: unknown) => void;
  jest.mocked(request).mockImplementation(async (_path, method) => {
    if (method === "POST")
      return new Promise((resolve) => {
        finish = resolve;
      });
    return {
      conversation: { id: mockRouteId, mode: "listen" },
      messages: [],
    } as never;
  });
  const cleanup = await setup(<ConversationScreen />);
  await waitFor(() =>
    expect(screen.getByLabelText("Message").props.editable).toBe(true),
  );
  await fireEvent.changeText(
    screen.getByLabelText("Message"),
    "Synthetic old message",
  );
  await fireEvent.press(screen.getByLabelText("Send"));
  await waitFor(() => expect(finish).toBeDefined());
  expect(request).toHaveBeenCalledWith(
    "/conversations/conversation-1/messages",
    "POST",
    expect.objectContaining({ content: "Synthetic old message" }),
    { owner: "offline-user" },
  );
  await act(async () => useSession.setState({ userId: "next-owner" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Message").props.value).toBe(
      "Next owner's draft",
    ),
  );
  await act(async () =>
    finish({
      message: { content: "Late reply" },
      safetyLevel: "crisis",
      memory: { id: "old-memory", content: "Old private candidate" },
    }),
  );
  expect(screen.getByLabelText("Message").props.value).toBe(
    "Next owner's draft",
  );
  expect(screen.queryByText("Old private candidate")).toBeNull();
  expect(mockStored.get("mori.next-owner.chat.conversation-1")).toBe(
    "Next owner's draft",
  );
  expect(router.push).not.toHaveBeenCalled();
  await cleanup();
});
beforeEach(() => {
  jest.clearAllMocks();
  mockStored.clear();
  mockRouteId = "new";
  useSession.setState({ userId: "offline-user" });
  usePreferences.setState({ locale: "en" });
});
afterEach(() => usePreferences.setState({ locale: "vi" }));

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

test("legacy plain-text chat drafts keep their original Vietnamese content", () => {
  expect(readChatDraft("Mình vẫn chưa gửi câu này 💚").content).toBe(
    "Mình vẫn chưa gửi câu này 💚",
  );
});

test("an existing journal draft opens while its server list is unavailable; retry retains its ID", async () => {
  mockRouteId = "existing-entry";
  mockStored.set(
    "mori.offline-user.journal.existing-entry",
    JSON.stringify({
      title: "",
      content: "Nội dung còn dang dở",
      source: "manual",
      client_id: clientId,
    }),
  );
  jest.mocked(request).mockImplementation(async (_path, method) => {
    if (!method || method === "GET") return new Promise(() => undefined);
    throw new Error("Disconnected");
  });
  const cleanup = await setup(<JournalEditor />);
  expect((await screen.findByLabelText("Journal content")).props.value).toBe(
    "Nội dung còn dang dở",
  );
  await fireEvent.changeText(
    screen.getByLabelText("Journal title"),
    "Trang đang viết",
  );
  await fireEvent.press(screen.getByText("Save"));
  await screen.findByText("Disconnected");
  expect(router.replace).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("Save"));
  await waitFor(() =>
    expect(
      jest.mocked(request).mock.calls.filter((call) => call[1] === "PATCH"),
    ).toHaveLength(2),
  );
  const saves = jest
    .mocked(request)
    .mock.calls.filter((call) => call[1] === "PATCH");
  expect(saves[0][2]).toEqual(saves[1][2]);
  expect(saves[0][2]).toMatchObject({ client_id: clientId });
  await cleanup();
});

test("a journal read failure has a retry and cannot expose a blank editable entry", async () => {
  mockRouteId = "missing-entry";
  jest.mocked(request).mockRejectedValueOnce(new Error("Disconnected"));
  const cleanup = await setup(<JournalEditor />);
  await screen.findByText("Disconnected");
  expect(screen.queryByLabelText("Journal content")).toBeNull();
  jest.mocked(request).mockResolvedValueOnce([]);
  await fireEvent.press(screen.getByText("Try again"));
  await screen.findByText("This journal entry could not be found.");
  expect(screen.queryByText("Save")).toBeNull();
  await cleanup();
});

test("a chat retry after remount reuses its committed ID; editing creates a new ID", async () => {
  mockRouteId = "conversation-1";
  jest.mocked(request).mockImplementation(async (_path, method) => {
    if (!method || method === "GET")
      return {
        conversation: { id: mockRouteId, mode: "listen" },
        messages: [],
      } as never;
    throw new Error("Response lost");
  });
  let cleanup = await setup(<ConversationScreen />);
  const input = await screen.findByLabelText("Message");
  await waitFor(() => expect(input.props.editable).toBe(true));
  await fireEvent.changeText(input, "Mình muốn giữ câu này");
  await fireEvent.press(screen.getByLabelText("Send"));
  await screen.findByText("Response lost");
  const first = jest
    .mocked(request)
    .mock.calls.find((call) => call[1] === "POST")![2];
  expect(
    JSON.parse(mockStored.get("mori.offline-user.chat.conversation-1")!),
  ).toMatchObject({ content: "Mình muốn giữ câu này" });
  await cleanup();
  cleanup = await setup(<ConversationScreen />);
  await waitFor(() =>
    expect(screen.getByLabelText("Message").props.value).toBe(
      "Mình muốn giữ câu này",
    ),
  );
  await fireEvent.press(screen.getByLabelText("Send"));
  await screen.findByText("Response lost");
  let posts = jest
    .mocked(request)
    .mock.calls.filter((call) => call[1] === "POST");
  expect(posts[1][2]).toEqual(first);
  await fireEvent.press(screen.getByText("Try again"));
  await waitFor(() =>
    expect(
      jest.mocked(request).mock.calls.filter((call) => call[1] === "POST"),
    ).toHaveLength(3),
  );
  expect(
    jest.mocked(request).mock.calls.filter((call) => call[1] === "POST")[2][2],
  ).toEqual(first);
  await fireEvent.changeText(screen.getByLabelText("Message"), "Nội dung khác");
  await fireEvent.press(screen.getByLabelText("Send"));
  await screen.findByText("Response lost");
  posts = jest.mocked(request).mock.calls.filter((call) => call[1] === "POST");
  expect(posts[3][2]).not.toMatchObject({
    client_id: (first as { client_id: string }).client_id,
  });
  await cleanup();
});

test("a storage failure prevents sending a message whose retry identity is not durable", async () => {
  mockRouteId = "conversation-2";
  jest.mocked(request).mockResolvedValue({
    conversation: { id: mockRouteId, mode: "listen" },
    messages: [],
  });
  const cleanup = await setup(<ConversationScreen />);
  await waitFor(() =>
    expect(screen.getByLabelText("Message").props.editable).toBe(true),
  );
  await fireEvent.changeText(screen.getByLabelText("Message"), "Keep this");
  await screen.findByText(
    "Draft saved on this device. Not saved to your account yet.",
  );
  jest
    .mocked(privateStorage.setItem)
    .mockRejectedValueOnce(new Error("Storage full"));
  await fireEvent.press(screen.getByLabelText("Send"));
  await screen.findByText(
    "Could not save the draft on this device. Keep this screen open.",
  );
  expect(
    jest.mocked(request).mock.calls.some((call) => call[1] === "POST"),
  ).toBe(false);
  await cleanup();
});

test("guided journal failure preserves reviewed answers and client ID across remount", async () => {
  const template = getGuidedJournalTemplate("khi-minh-thay-mat-phuong-huong")!;
  mockRouteId = template.id;
  const draft = {
    ...createGuidedJournalDraft(template),
    answers: template.prompts.map((_, i) => `Câu ${i + 1}`),
    step: template.prompts.length,
  };
  const key = `mori.offline-user.guided-journal.${template.id}`;
  mockStored.set(key, JSON.stringify(draft));
  jest.mocked(request).mockRejectedValue(new Error("Offline save"));
  let cleanup = await setup(<GuidedJournalSession />);
  await fireEvent.press(await screen.findByText("Save to journal"));
  await screen.findByText("Offline save");
  expect(router.replace).not.toHaveBeenCalled();
  const first = jest.mocked(request).mock.calls[0][2];
  await cleanup();
  cleanup = await setup(<GuidedJournalSession />);
  await fireEvent.press(await screen.findByText("Save to journal"));
  await screen.findByText("Offline save");
  expect(jest.mocked(request).mock.calls[1][2]).toEqual(first);
  expect(mockStored.get(key)).toBe(JSON.stringify(draft));
  await cleanup();
});

test("conversation reflection cannot overwrite a draft created while generation is pending", async () => {
  const key = "mori.offline-user.journal.new";
  // Both complete operations use the same production queue.
  await act(async () => {
    await writeDraft("offline-user", key, "Original unfinished journal");
    await expect(
      createDraftIfEmptyWriter("offline-user", key)("Generated reflection"),
    ).rejects.toThrow("bản nháp");
  });
  expect(await readDraft(key)).toBe("Original unfinished journal");
});

test("a reflection arriving after account cleanup cannot resurrect a journal draft", async () => {
  mockRouteId = "late-reflection";
  let finish!: (value: unknown) => void;
  jest.mocked(request).mockImplementation(async (_path, method) => {
    if (!method || method === "GET")
      return {
        conversation: { id: mockRouteId, mode: "listen" },
        messages: [
          {
            id: "synthetic-message",
            role: "user",
            content: "Synthetic reflection input",
          },
        ],
      } as never;
    return await new Promise((resolve) => {
      finish = resolve;
    });
  });
  const cleanup = await setup(<ConversationScreen />);
  await screen.findByText("Synthetic reflection input");
  await fireEvent.press(screen.getByLabelText("Conversation options"));
  await fireEvent.press(screen.getByText("Create a journal draft"));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  // Account cleanup can finish while an already-sent generation request is pending.
  await clearUserDeviceData("offline-user");
  await act(async () =>
    finish({ title: "Late result", content: "Synthetic generated text" }),
  );
  await waitFor(() =>
    expect(screen.queryByText("Creating a draft…")).toBeNull(),
  );
  expect(await readDraft("mori.offline-user.journal.new")).toBeNull();
  expect(router.push).not.toHaveBeenCalledWith("/journal/new");
  await cleanup();
});
