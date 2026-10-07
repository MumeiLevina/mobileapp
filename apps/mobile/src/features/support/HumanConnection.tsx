import { useState } from "react";
import { Linking, Platform } from "react-native";
import { router } from "expo-router";
import { ErrorNote, MoriButton, MoriText, styles } from "../../components/ui";

export async function openExternalSupportApp(kind: "phone" | "message") {
  const url = kind === "phone" ? "tel:" : "sms:";
  if (Platform.OS === "web" || !(await Linking.canOpenURL(url))) return false;
  await Linking.openURL(url);
  return true;
}

export function HumanConnection({ back = "/first-aid" }: { back?: string }) {
  const [error, setError] = useState("");
  const open = async (kind: "phone" | "message") => {
    setError("");
    try {
      if (!(await openExternalSupportApp(kind))) {
        setError(
          "Thiết bị này chưa mở được ứng dụng. Bạn có thể tự mở Điện thoại hoặc Tin nhắn.",
        );
      }
    } catch {
      setError(
        "Chưa mở được ứng dụng. Bạn có thể tự mở ứng dụng trên thiết bị.",
      );
    }
  };
  return (
    <>
      <MoriText variant="title" style={{ textAlign: "center" }}>
        Có ai khiến bạn cảm thấy an toàn hơn khi nhắn hoặc gọi lúc này không?
      </MoriText>
      <MoriText muted style={{ textAlign: "center" }}>
        Mori không đọc danh bạ và không cần quyền truy cập liên hệ. Bạn tự chọn
        người mình muốn tìm đến.
      </MoriText>
      <ErrorNote error={error} />
      <MoriButton icon="call-outline" onPress={() => void open("phone")}>
        Mở ứng dụng điện thoại
      </MoriButton>
      <MoriButton
        variant="secondary"
        icon="chatbox-outline"
        onPress={() => void open("message")}
      >
        Mở ứng dụng nhắn tin
      </MoriButton>
      <MoriButton
        variant="ghost"
        onPress={() => router.replace(back as "/self-care")}
      >
        Quay lại
      </MoriButton>
      <MoriText muted variant="small" style={styles.notice}>
        Nếu không muốn liên hệ lúc này, bạn không cần làm gì thêm.
      </MoriText>
    </>
  );
}
