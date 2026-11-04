import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import { GardenScene } from "../features/garden/GardenScene";
import { usePreferences } from "../store/preferences";

jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: {
    View: jest.requireActual<typeof import("react-native")>("react-native")
      .View,
  },
  useReducedMotion: () => true,
  useSharedValue: () => ({ value: 0 }),
  useAnimatedStyle: () => ({}),
  cancelAnimation: jest.fn(),
}));
afterEach(() => usePreferences.setState({ locale: "vi" }));

test("Garden exposes each unlocked destination with a localized button name and retains routing", async () => {
  usePreferences.setState({ locale: "en" });
  await render(
    <GardenScene
      interactive
      areas={[
        "letter_tree",
        "quiet_cottage",
        "reflection_lake",
        "memory_garden",
        "path_stones",
        "wind_chimes",
      ]}
    />,
  );
  expect(screen.getAllByRole("button")).toHaveLength(6);
  expect(screen.getByLabelText("Letter Tree, Open area")).toBeTruthy();
  expect(screen.getByLabelText("Path Stones, Open area")).toBeTruthy();
  for (const button of screen.getAllByRole("button")) {
    expect(button.props.accessibilityLabel).toMatch(/, Open area$/);
    expect(button.props.accessibilityLabel).not.toMatch(/mở khu vực/);
  }
  await fireEvent.press(screen.getByTestId("garden-hotspot-soft-goals"));
  expect(router.push).toHaveBeenCalledWith("/soft-goals");
});

test("locked destinations and decorative-only scenes do not create navigable targets", async () => {
  const view = await render(
    <GardenScene interactive areas={["letter_tree"]} />,
  );
  expect(screen.getAllByRole("button")).toHaveLength(1);
  expect(screen.queryByTestId("garden-hotspot-memories")).toBeNull();
  await view.rerender(<GardenScene areas={["letter_tree", "memory_garden"]} />);
  expect(screen.queryAllByRole("button")).toHaveLength(0);
});
