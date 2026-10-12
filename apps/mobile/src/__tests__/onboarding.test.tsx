import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Onboarding from "../app/onboarding";
import { usePreferences } from "../store/preferences";

const mockDraftSetText = jest.fn();
const mockDraftClear = jest.fn().mockResolvedValue(undefined);
let mockDraftText = "";

jest.mock("../features/garden/GardenScene", () => ({
  GardenScene: () => null,
}));
jest.mock("../features/mood/MoodPicker", () => ({
  MoodPicker: () => null,
}));
jest.mock("../hooks/useDraft", () => ({
  useDraft: () => ({
    text: mockDraftText,
    setText: mockDraftSetText,
    ready: true,
    error: "",
    clear: mockDraftClear,
  }),
}));

async function renderOnboarding() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <Onboarding />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByText("Bắt đầu")).toBeTruthy());
  return result;
}

describe("onboarding navigation", () => {
  beforeEach(() => {
    mockDraftText = "";
    mockDraftSetText.mockClear();
    mockDraftClear.mockClear();
    usePreferences.setState({ locale: "vi" });
  });

  test("restores the last completed onboarding step", async () => {
    mockDraftText = JSON.stringify({
      version: 1,
      step: 4,
      name: "An",
      selected: ["Một nơi để tâm sự"],
      style: "calm",
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    await render(
      <QueryClientProvider client={queryClient}>
        <Onboarding />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Khoảng riêng của bạn.")).toBeTruthy();
  });

  test("back returns to the previous step without losing selections", async () => {
    await renderOnboarding();
    await fireEvent.press(screen.getByText("Bắt đầu"));

    const goal = screen.getByLabelText("Một nơi để tâm sự");
    await fireEvent.press(goal);
    await fireEvent.press(screen.getByText("Tiếp tục"));
    await fireEvent.press(screen.getByLabelText("Quay lại bước trước"));

    expect(
      screen.getByLabelText("Một nơi để tâm sự").props.accessibilityState,
    ).toMatchObject({ checked: true, disabled: false });
  });

  test("AI boundary copy renders as natural text", async () => {
    await renderOnboarding();
    await fireEvent.press(screen.getByText("Bắt đầu"));
    await fireEvent.press(screen.getByText("Tiếp tục"));
    await fireEvent.press(screen.getByText("Tiếp tục"));

    const boundary = screen.getByText(
      "Một người bạn đồng hành AI, với những giới hạn rõ ràng.",
    );
    expect(boundary).toBeTruthy();
    expect(boundary.props.children).not.toContain("\\n");
  });
});
