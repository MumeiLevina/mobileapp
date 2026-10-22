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

jest.mock("../services/api", () => ({
  request: jest.fn(),
  refresh: jest.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  jest.clearAllMocks();
  usePreferences.setState({ locale: "en" });
  jest
    .mocked(request)
    .mockResolvedValue({
      message: { id: "reply", role: "assistant", content: "A private reply" },
      safetyLevel: "normal",
    });
});
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
  );
  await act(async () => finish({ id: "saved-private" }));
  await waitFor(() =>
    expect(router.replace).toHaveBeenCalledWith("/conversation/saved-private"),
  );
  await cleanup();
});
