import { act, render, screen } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PatternsScreen from "../app/patterns";
import { usePreferences } from "../store/preferences";
import { request } from "../services/api";

jest.mock("../services/api", () => ({ request: jest.fn() }));

test("all pattern types and evidence counts switch languages without rewriting observations", async () => {
  usePreferences.setState({ locale: "en" });
  const types = [
    "recurring_topic",
    "helpful_activity",
    "time_pattern",
    "recurring_thought",
    "mood_activity",
  ];
  jest.mocked(request).mockResolvedValue({
    patterns: types.map((type, i) => ({
      id: type,
      type,
      title: `Pattern ${i}`,
      observation: `Chỉnh sửa ${i}`,
      evidenceCount: 5,
    })),
    disclaimer: "Original disclaimer",
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const view = await render(
    <QueryClientProvider client={client}>
      <PatternsScreen />
    </QueryClientProvider>,
  );
  await screen.findByText("RECURRING TOPIC");
  for (const label of [
    "OFTEN CHOSEN ACTIVITY",
    "TIME PATTERN",
    "RECURRING PHRASE",
    "MOOD & ACTIVITY",
  ])
    expect(screen.getByText(label)).toBeTruthy();
  expect(screen.getAllByText("Based on 5 related entries")).toHaveLength(5);
  expect(screen.getByText("Chỉnh sửa 0")).toBeTruthy();
  expect(screen.queryByText("Original disclaimer")).toBeNull();
  expect(
    screen.getAllByText(
      "This is a pattern in your entries, not evidence of a cause or a diagnosis.",
    ),
  ).toHaveLength(1);
  await act(async () => usePreferences.setState({ locale: "vi" }));
  expect(screen.getByText("HOẠT ĐỘNG THƯỜNG CHỌN")).toBeTruthy();
  expect(screen.queryByText("OFTEN CHOSEN ACTIVITY")).toBeNull();
  expect(screen.getAllByText("Dựa trên 5 ghi chép liên quan")).toHaveLength(5);
  await view.unmount();
  client.clear();
});
