import { Platform } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { SnowNekoAvatar } from "../features/avatar/SnowNekoAvatar";
import { usePreferences } from "../store/preferences";

describe("Snow Neko avatar surface", () => {
  const originalPlatform = Platform.OS;

  beforeAll(() => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "android",
    });
  });

  afterAll(() => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalPlatform,
    });
  });

  beforeEach(() => {
    usePreferences.setState({ showAvatar: true, reducedAvatarMotion: false });
  });

  test("show/hide setting preserves a text-only alternative", async () => {
    await render(<SnowNekoAvatar state="idle" crisis={false} />);
    await fireEvent.press(screen.getByText("Ẩn avatar"));
    expect(usePreferences.getState().showAvatar).toBe(false);
    expect(
      screen.getByText("Avatar đang ẩn. Chế độ văn bản vẫn đầy đủ."),
    ).toBeTruthy();
    await fireEvent.press(screen.getByText("Hiện Snow Neko"));
    expect(usePreferences.getState().showAvatar).toBe(true);
  });

  test("reduced-motion preference is stored", async () => {
    await render(<SnowNekoAvatar state="speaking" crisis={false} />);
    await fireEvent.press(screen.getByText("Giảm chuyển động (hệ thống)"));
    expect(usePreferences.getState().reducedAvatarMotion).toBe(true);
  });

  test("loading failure falls back without removing chat controls", async () => {
    await render(<SnowNekoAvatar state="idle" crisis={false} />);
    await fireEvent(screen.getByTestId("snow-neko-webview"), "error", {
      nativeEvent: { description: "Private renderer missing" },
    });
    expect(screen.getByLabelText("Snow Neko không thể hiển thị")).toBeTruthy();
    expect(
      screen.getByText(/Trò chuyện vẫn hoạt động bình thường/),
    ).toBeTruthy();
  });

  test("loads private assets from the Android asset origin without file access", async () => {
    await render(<SnowNekoAvatar state="idle" crisis={false} />);
    const renderer = screen.getByTestId("snow-neko-webview");
    expect(renderer.props.source).toEqual({
      uri: "https://appassets.androidplatform.net/assets/live2d/index.html",
    });
    expect(renderer.props.allowFileAccess).toBe(false);
    expect(renderer.props.allowFileAccessFromFileURLs).toBe(false);
  });

  test("crisis mode announces quiet behavior", async () => {
    await render(<SnowNekoAvatar state="resting" crisis />);
    expect(
      screen.getByText("Snow Neko đang yên lặng để ưu tiên hỗ trợ an toàn."),
    ).toBeTruthy();
  });
});
