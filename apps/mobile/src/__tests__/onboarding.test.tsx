import { fireEvent, render, screen } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Onboarding from "../app/onboarding";
import { usePreferences } from "../store/preferences";

jest.mock("../features/garden/GardenScene", () => ({
  GardenScene: () => null,
}));
jest.mock("../features/mood/MoodPicker", () => ({
  MoodPicker: () => null,
}));

async function renderOnboarding() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Onboarding />
    </QueryClientProvider>,
  );
}

describe("onboarding navigation", () => {
  beforeEach(() => usePreferences.setState({ locale: "vi" }));

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
