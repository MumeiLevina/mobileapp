import { act, render, screen } from "@testing-library/react-native";
import { MoriText } from "../components/ui";
import { usePreferences } from "../store/preferences";
test("English interface never rewrites private user content", async () => {
  usePreferences.setState({ locale: "en" });
  await render(
    <>
      <MoriText>Chỉnh sửa</MoriText>
      <MoriText translate={false}>Chỉnh sửa</MoriText>
    </>,
  );
  expect(screen.getByText("Edit")).toBeTruthy();
  expect(screen.getByText("Chỉnh sửa")).toBeTruthy();
  await act(async () => usePreferences.setState({ locale: "vi" }));
});
