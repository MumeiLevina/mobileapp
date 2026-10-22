import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import JournalList from "../app/(tabs)/journal";
import { usePreferences } from "../store/preferences";
import { request } from "../services/api";

jest.mock("../services/api", () => ({ request: jest.fn() }));

test("calendar filters dates, clears a hidden filter and survives repeated toggles", async () => {
  usePreferences.setState({ locale: "vi" });
  const now = new Date();
  jest.mocked(request).mockResolvedValue(
    [1, 2].map((day) => ({
      id: `entry-${day}`,
      title: `Entry ${day}`,
      content: `Private ${day}`,
      source: "manual",
      created_at: new Date(
        now.getFullYear(),
        now.getMonth(),
        day,
        12,
      ).toISOString(),
    })),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const view = await render(
    <QueryClientProvider client={client}>
      <JournalList />
    </QueryClientProvider>,
  );
  await screen.findByText("Entry 1");
  await fireEvent.press(screen.getByLabelText("Lịch nhật ký"));
  await fireEvent.press(screen.getByLabelText("Ngày 1, có nhật ký"));
  expect(screen.queryByText("Entry 2")).toBeNull();
  await fireEvent.press(screen.getByLabelText("Ngày 2, có nhật ký"));
  expect(screen.queryByText("Entry 1")).toBeNull();
  await fireEvent.press(screen.getByLabelText("Lịch nhật ký"));
  expect(screen.getByText("Entry 1")).toBeTruthy();
  expect(screen.getByText("Entry 2")).toBeTruthy();
  for (let i = 0; i < 3; i++) {
    await fireEvent.press(screen.getByLabelText("Lịch nhật ký"));
    await fireEvent.press(screen.getByLabelText("Ngày 1, có nhật ký"));
    await fireEvent.press(screen.getByLabelText("Ngày 1, có nhật ký"));
    expect(screen.getByText("Entry 2")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Lịch nhật ký"));
  }
  await fireEvent.press(screen.getByLabelText("Lịch nhật ký"));
  await fireEvent.press(screen.getByLabelText("Ngày 1, có nhật ký"));
  await fireEvent.press(screen.getByLabelText("Tháng trước"));
  expect(screen.getByText("Entry 2")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Tháng sau"));
  expect(screen.getByLabelText("Ngày 1, có nhật ký")).toBeTruthy();
  await act(async () => usePreferences.setState({ locale: "en" }));
  expect(screen.getByText("YOUR JOURNAL")).toBeTruthy();
  expect(screen.getByText("Mon")).toBeTruthy();
  expect(
    screen.getByText(
      now.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    ),
  ).toBeTruthy();
  expect(screen.getByLabelText("Day 1, has entry")).toBeTruthy();
  expect(screen.getByLabelText("Previous month")).toBeTruthy();
  expect(screen.getByText("Private 1")).toBeTruthy();
  await view.unmount();
  client.clear();
  usePreferences.setState({ locale: "vi" });
});
