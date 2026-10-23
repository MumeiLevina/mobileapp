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
import { getGuidedJournalTemplate } from "@mori/shared";
import JournalEditor from "../app/journal/[id]";
import GuidedJournalSession from "../app/guided-journal/[id]";
import LetterEditor from "../app/letter/[id]";
import { readJournalDraft } from "../features/journal/journal-draft";
import {
  createGuidedJournalDraft,
  readGuidedJournalDraft,
} from "../features/journal/guided-draft";
import {
  createLetterDraft,
  readLetterDraft,
} from "../features/letters/letter-draft";
import { useSession } from "../store/session";
import { usePreferences } from "../store/preferences";
import { privateStorage } from "../lib/storage";
import { clearUserDeviceData, writeDraft } from "../services/cleanup";
import { request } from "../services/api";

let mockId = "new";
const mockItems = new Map<string, string>();
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: mockId }),
  router: {
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    canGoBack: () => true,
  },
}));
jest.mock("../lib/storage", () => ({
  privateStorage: {
    getItem: jest.fn(async (key: string) => mockItems.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockItems.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      mockItems.delete(key);
    }),
  },
}));
jest.mock("../services/api", () => ({
  request: jest.fn(),
  refresh: jest.fn(),
}));
jest.mock("../services/notifications", () => ({
  cancelAllMoriNotifications: jest.fn(),
  cancelLetterNotification: jest.fn(),
  scheduleLetterNotification: jest.fn(),
}));
const template = getGuidedJournalTemplate("khi-minh-thay-mat-phuong-huong")!;
const journal = {
  version: 1,
  title: "Chưa xong",
  content: "Giữ nguyên tiếng Việt 💚",
  source: "manual",
  client_id: "77777777-7777-4777-a777-777777777777",
};
const flows = [
  {
    name: "journal",
    id: "new",
    key: "journal.new",
    component: <JournalEditor />,
    valid: journal,
  },
  {
    name: "guided",
    id: template.id,
    key: `guided-journal.${template.id}`,
    component: <GuidedJournalSession />,
    valid: createGuidedJournalDraft(template),
  },
  {
    name: "letter",
    id: "new",
    key: "letter.new",
    component: <LetterEditor />,
    valid: createLetterDraft(),
  },
];
beforeEach(() => {
  jest.clearAllMocks();
  mockItems.clear();
  useSession.setState({ userId: "recovery-owner" });
  usePreferences.setState({ locale: "en" });
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
  return {
    ...view,
    close: async () => {
      await view.unmount();
      client.clear();
    },
  };
}

test.each(flows)(
  "$name preserves malformed text through view, retry and remount",
  async (flow) => {
    mockId = flow.id;
    const key = `mori.recovery-owner.${flow.key}`;
    const raw = '{unfinished: "Nội dung riêng chưa được khôi phục 💚"';
    await writeDraft("recovery-owner", key, raw);
    jest.clearAllMocks();
    let view = await setup(flow.component);
    await screen.findByText("Keep what you have written.");
    await fireEvent.press(screen.getByText("View original to copy"));
    expect(screen.getByText(raw).props.selectable).toBe(true);
    await fireEvent.press(screen.getByText("Read draft again"));
    await waitFor(() => expect(mockItems.get(key)).toBe(raw));
    expect(privateStorage.setItem).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
    await view.close();
    view = await setup(flow.component);
    await screen.findByText("Keep what you have written.");
    expect(mockItems.get(key)).toBe(raw);
    await view.close();
  },
);

test.each(flows)(
  "$name requires discard confirmation and preserves the original when deletion fails",
  async (flow) => {
    mockId = flow.id;
    const key = `mori.recovery-owner.${flow.key}`;
    const raw = JSON.stringify({ ...flow.valid, version: 99 });
    await writeDraft("recovery-owner", key, raw);
    const view = await setup(flow.component);
    await screen.findByText(
      "This draft uses an unsupported version or prompt set. The original is unchanged.",
    );
    await fireEvent.press(screen.getByText("Discard unreadable draft"));
    await fireEvent.press(screen.getByText("Keep original"));
    expect(mockItems.get(key)).toBe(raw);
    await fireEvent.press(screen.getByText("Discard unreadable draft"));
    jest
      .mocked(privateStorage.removeItem)
      .mockRejectedValueOnce(new Error("Device locked"));
    await fireEvent.press(screen.getByText("Delete draft from this device"));
    await screen.findByText("Device locked");
    expect(mockItems.get(key)).toBe(raw);
    await fireEvent.press(screen.getByText("Delete draft from this device"));
    await waitFor(() => expect(mockItems.has(key)).toBe(false));
    const label =
      flow.name === "journal"
        ? "Journal content"
        : flow.name === "guided"
          ? "Answer 1"
          : "Letter content";
    expect((await screen.findByLabelText(label)).props.value).toBe("");
    expect(request).not.toHaveBeenCalled();
    await view.close();
  },
);

test("retry can recover a readable journal and owner switches never expose another owner's content", async () => {
  mockId = "new";
  const key = "mori.recovery-owner.journal.new";
  await writeDraft("recovery-owner", key, "Unreadable original");
  const view = await setup(<JournalEditor />);
  await screen.findByText("Keep what you have written.");
  mockItems.set(key, JSON.stringify(journal));
  await fireEvent.press(screen.getByText("Read draft again"));
  await waitFor(() =>
    expect(screen.getByLabelText("Journal content").props.value).toBe(
      journal.content,
    ),
  );
  await act(async () => useSession.setState({ userId: "another-owner" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Journal content").props.value).toBe(""),
  );
  expect(mockItems.get(key)).toBe(JSON.stringify(journal));
  await clearUserDeviceData("recovery-owner");
  expect(mockItems.has(key)).toBe(false);
  await view.close();
});

test("mismatched prompt sets and malformed structures fail without manufacturing a replacement", () => {
  expect(() =>
    readGuidedJournalDraft(
      JSON.stringify({
        ...createGuidedJournalDraft(template),
        templateId: "old-template",
      }),
      template,
    ),
  ).toThrow("chưa tương thích");
  expect(() =>
    readGuidedJournalDraft(
      JSON.stringify({
        ...createGuidedJournalDraft(template),
        answers: ["Only one"],
      }),
      template,
    ),
  ).toThrow();
  expect(() =>
    readLetterDraft(JSON.stringify({ title: "Private", content: "Keep this" })),
  ).toThrow();
  expect(() =>
    readJournalDraft(JSON.stringify({ ...journal, content: 123 })),
  ).toThrow();
  const { version: _version, ...legacy } = journal;
  expect(readJournalDraft(JSON.stringify(legacy))).toEqual(legacy);
});

test("an existing journal's cached server content is not reused for another owner", async () => {
  mockId = "owner-entry";
  jest
    .mocked(request)
    .mockImplementation(
      async () =>
        (useSession.getState().userId === "recovery-owner"
          ? [{ ...journal, id: mockId }]
          : []) as never,
    );
  const view = await setup(<JournalEditor />);
  await waitFor(() =>
    expect(screen.getByLabelText("Journal content").props.value).toBe(
      journal.content,
    ),
  );
  await act(async () => useSession.setState({ userId: "another-owner" }));
  await screen.findByText("This journal entry could not be found.");
  expect(screen.queryByLabelText("Journal content")).toBeNull();
  await view.close();
});

test("local reread and confirmed discard work while the query manager is offline", async () => {
  onlineManager.setOnline(false);
  mockId = "new";
  const key = "mori.recovery-owner.journal.new";
  await writeDraft("recovery-owner", key, "Unreadable offline draft");
  const view = await setup(<JournalEditor />);
  await fireEvent.press(await screen.findByText("Read draft again"));
  await waitFor(() => expect(privateStorage.getItem).toHaveBeenCalledTimes(2));
  await fireEvent.press(screen.getByText("Discard unreadable draft"));
  await fireEvent.press(screen.getByText("Delete draft from this device"));
  await screen.findByLabelText("Journal content");
  expect(mockItems.has(key)).toBe(false);
  expect(request).not.toHaveBeenCalled();
  await view.close();
});

test.each(flows)(
  "$name hides original recovery content immediately on an owner change",
  async (flow) => {
    mockId = flow.id;
    const key = `mori.recovery-owner.${flow.key}`;
    const raw = JSON.stringify({
      ...flow.valid,
      version: 99,
      privateText: "Only the first owner",
    });
    await writeDraft("recovery-owner", key, raw);
    const view = await setup(flow.component);
    await fireEvent.press(await screen.findByText("View original to copy"));
    expect(screen.getByText(raw)).toBeTruthy();
    await act(async () => useSession.setState({ userId: "other-owner" }));
    expect(screen.queryByText(raw)).toBeNull();
    expect(mockItems.get(key)).toBe(raw);
    await clearUserDeviceData("recovery-owner");
    expect(mockItems.has(key)).toBe(false);
    await view.close();
  },
);
