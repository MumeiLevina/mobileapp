import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MoodPicker } from "../features/mood/MoodPicker";
import { request } from "../services/api";
import { usePreferences } from "../store/preferences";

jest.mock("../services/api", () => ({
  request: jest.fn().mockResolvedValue({}),
  refresh: jest.fn().mockResolvedValue(undefined),
}));

test("quick mood save omits tags and note", async () => {
  usePreferences.setState({ locale: "vi" });
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: Infinity } },
  });
  const view = await render(
    <QueryClientProvider client={queryClient}>
      <MoodPicker />
    </QueryClientProvider>,
  );

  await fireEvent.press(screen.getByLabelText("Rạng rỡ"));
  await fireEvent.press(screen.getByLabelText("Công việc"));
  await fireEvent.changeText(
    screen.getByLabelText("Ghi chú cảm xúc"),
    "Một ghi chú riêng",
  );
  await fireEvent.press(screen.getByText("Chỉ lưu cảm xúc"));

  await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  expect(request).toHaveBeenCalledWith(
    "/moods",
    "POST",
    expect.objectContaining({
      mood: "joyful",
      tags: [],
      optional_note: "",
    }),
  );
  await view.unmount();
  queryClient.clear();
});
