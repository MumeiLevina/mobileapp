import { fireEvent, render, screen } from "@testing-library/react-native";
import {
  Choice,
  MoriButton,
  MoriConfirmSheet,
  MoriIconButton,
} from "../components/ui";

describe("shared interaction primitives", () => {
  test("a loading button communicates progress and blocks repeated actions", async () => {
    const onPress = jest.fn();
    await render(
      <MoriButton onPress={onPress} loading loadingLabel="Đang lưu…">
        Lưu thay đổi
      </MoriButton>,
    );

    const button = screen.getByRole("button");
    expect(button.props.accessibilityState).toEqual({
      disabled: true,
      busy: true,
    });
    expect(screen.getByText("Đang lưu…")).toBeTruthy();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  test("the central short guard ignores an accidental double tap", async () => {
    const onPress = jest.fn();
    await render(<MoriButton onPress={onPress}>Tiếp tục</MoriButton>);

    const button = screen.getByRole("button");
    await fireEvent.press(button);
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test("choice exposes selection state and performs its action", async () => {
    const onPress = jest.fn();
    await render(<Choice title="Chỉ lắng nghe" selected onPress={onPress} />);

    const choice = screen.getByRole("radio");
    expect(choice.props.accessibilityState).toMatchObject({
      checked: true,
      disabled: false,
    });
    await fireEvent.press(choice);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test("icon-only actions require an accessible name", async () => {
    await render(
      <MoriIconButton
        icon="send"
        accessibilityLabel="Gửi tin nhắn"
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByLabelText("Gửi tin nhắn")).toBeTruthy();
  });

  test("confirmation remains separate from the destructive trigger", async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    await render(
      <MoriConfirmSheet
        visible
        title="Xóa cuộc trò chuyện?"
        description="Hành động này không thể hoàn tác."
        confirmLabel="Xóa cuộc trò chuyện"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(onConfirm).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Giữ lại"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
