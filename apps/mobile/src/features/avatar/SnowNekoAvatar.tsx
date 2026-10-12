import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { MoriButton, MoriText } from "../../components/ui";
import { useTheme } from "../../theme";
import { usePreferences } from "../../store/preferences";
import {
  AvatarCommand,
  AvatarState,
  parseRendererEvent,
  serializeCommand,
} from "./protocol";

const rendererOrigin = "https://appassets.androidplatform.net";
const rendererUri = `${rendererOrigin}/assets/live2d/index.html`;
// Four 4096x4096 textures can take noticeably longer to decode and upload on
// an Android emulator than in desktop Chromium. Keep this bounded, but do not
// abort a healthy first load while the GPU is still preparing those textures.
const rendererLoadTimeoutMs = 60_000;

type RendererStatus = "loading" | "ready" | "failed";

function StaticAlternative({ failed = false }: { failed?: boolean }) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        failed ? "Snow Neko không thể hiển thị" : "Snow Neko đang đồng hành"
      }
      style={[
        avatarStyles.fallback,
        { backgroundColor: theme.soft, borderColor: theme.line },
      ]}
    >
      <MoriText style={avatarStyles.snowflake} translate={false}>
        ❄
      </MoriText>
      <MoriText variant="small" muted>
        {failed
          ? "Snow Neko đang nghỉ. Trò chuyện vẫn hoạt động bình thường."
          : "Snow Neko"}
      </MoriText>
    </View>
  );
}

export function SnowNekoAvatar({
  state,
  crisis,
}: {
  state: AvatarState;
  crisis: boolean;
}) {
  const theme = useTheme();
  const webView = useRef<WebView>(null);
  const systemReducedMotion = useReducedMotion();
  const showAvatar = usePreferences((value) => value.showAvatar);
  const setShowAvatar = usePreferences((value) => value.setShowAvatar);
  const reducedAvatarMotion = usePreferences(
    (value) => value.reducedAvatarMotion,
  );
  const setReducedAvatarMotion = usePreferences(
    (value) => value.setReducedAvatarMotion,
  );
  const [status, setStatus] = useState<RendererStatus>("loading");
  const [detail, setDetail] = useState("Đang chuẩn bị Snow Neko…");
  const reducedMotion = Boolean(systemReducedMotion || reducedAvatarMotion);
  const stateCommand = useMemo<AvatarCommand>(
    () => ({ version: 1, type: "setState", state, reducedMotion, crisis }),
    [crisis, reducedMotion, state],
  );

  const send = (command: AvatarCommand) => {
    if (status !== "ready") return;
    webView.current?.injectJavaScript(
      `window.__moriReceive?.(${serializeCommand(command)});true;`,
    );
  };

  useEffect(() => send(stateCommand), [stateCommand, status]);
  useEffect(() => {
    if (status !== "loading" || Platform.OS !== "android") return;
    const timeout = setTimeout(() => {
      setStatus("failed");
      setDetail("Snow Neko không phản hồi sau 60 giây.");
    }, rendererLoadTimeoutMs);
    return () => clearTimeout(timeout);
  }, [status]);
  useEffect(() => {
    send({
      version: 1,
      type: "pause",
      paused: AppState.currentState !== "active",
    });
    const subscription = AppState.addEventListener("change", (next) => {
      send({ version: 1, type: "pause", paused: next !== "active" });
    });
    return () => subscription.remove();
  }, [status]);

  const onMessage = (event: WebViewMessageEvent) => {
    const message = parseRendererEvent(event.nativeEvent.data);
    if (!message) return;
    if (message.type === "ready") {
      setStatus("ready");
      setDetail(`Snow Neko sẵn sàng sau ${message.loadMs} ms`);
    } else if (message.type === "error") {
      setStatus("failed");
      setDetail(message.message);
    }
  };

  if (!showAvatar) {
    return (
      <View style={avatarStyles.hiddenRow}>
        <MoriText variant="small" muted>
          Avatar đang ẩn. Chế độ văn bản vẫn đầy đủ.
        </MoriText>
        <MoriButton
          size="medium"
          variant="ghost"
          onPress={() => setShowAvatar(true)}
        >
          Hiện Snow Neko
        </MoriButton>
      </View>
    );
  }

  return (
    <View
      style={[
        avatarStyles.shell,
        crisis && avatarStyles.crisisShell,
        { borderColor: theme.line, backgroundColor: theme.surface },
      ]}
    >
      <View style={avatarStyles.toolbar}>
        <MoriText variant="small" muted accessibilityLiveRegion="polite">
          {crisis
            ? "Snow Neko đang yên lặng để ưu tiên hỗ trợ an toàn."
            : detail}
        </MoriText>
        <View style={avatarStyles.actions}>
          <MoriButton
            size="medium"
            variant="ghost"
            onPress={() => setReducedAvatarMotion(!reducedAvatarMotion)}
          >
            {systemReducedMotion
              ? "Giảm chuyển động (hệ thống)"
              : reducedAvatarMotion
                ? "Bật chuyển động"
                : "Giảm chuyển động"}
          </MoriButton>
          <MoriButton
            size="medium"
            variant="ghost"
            onPress={() => setShowAvatar(false)}
          >
            Ẩn avatar
          </MoriButton>
        </View>
      </View>
      <View style={[avatarStyles.stage, crisis && avatarStyles.crisisStage]}>
        {Platform.OS === "android" && status !== "failed" ? (
          <WebView
            ref={webView}
            testID="snow-neko-webview"
            source={{ uri: rendererUri }}
            originWhitelist={[rendererOrigin]}
            javaScriptEnabled
            domStorageEnabled={false}
            allowFileAccess={false}
            allowFileAccessFromFileURLs={false}
            allowUniversalAccessFromFileURLs={false}
            mixedContentMode="never"
            setSupportMultipleWindows={false}
            scrollEnabled={false}
            bounces={false}
            overScrollMode="never"
            onMessage={onMessage}
            onError={(event) => {
              setStatus("failed");
              setDetail(
                event.nativeEvent.description || "Không thể mở renderer.",
              );
            }}
            onHttpError={(event) => {
              setStatus("failed");
              setDetail(
                `Renderer trả về HTTP ${event.nativeEvent.statusCode}.`,
              );
            }}
            onShouldStartLoadWithRequest={(request) =>
              request.url === rendererUri || request.url === "about:blank"
            }
            style={[avatarStyles.webView, { backgroundColor: "transparent" }]}
          />
        ) : (
          <StaticAlternative failed={status === "failed"} />
        )}
        {status === "loading" && Platform.OS === "android" && (
          <View
            style={[avatarStyles.loading, { backgroundColor: theme.surface }]}
          >
            <ActivityIndicator color={theme.primary} />
            <MoriText variant="small" muted>
              Đang tải Snow Neko…
            </MoriText>
          </View>
        )}
      </View>
    </View>
  );
}

const avatarStyles = StyleSheet.create({
  shell: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: "hidden",
    minHeight: 230,
  },
  crisisShell: { minHeight: 0 },
  toolbar: { paddingHorizontal: 12, paddingTop: 8, gap: 2 },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  stage: { height: 180, position: "relative" },
  crisisStage: { height: 0, overflow: "hidden" },
  webView: { flex: 1 },
  loading: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  fallback: {
    flex: 1,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  snowflake: { fontSize: 38 },
  hiddenRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
