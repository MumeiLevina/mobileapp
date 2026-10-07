import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { MoriButton, MoriText, ScreenContainer } from "../../components/ui";
import { useTheme } from "../../theme";

export default function MomentSuggestion() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const theme = useTheme();
  const reachOut = kind === "reach-out";

  return (
    <ScreenContainer back>
      <View
        accessible
        accessibilityLabel={
          reachOut ? "Kết nối với một người" : "Tạm rời màn hình"
        }
        style={{
          width: 82,
          height: 82,
          borderRadius: 41,
          alignItems: "center",
          justifyContent: "center",
          alignSelf: "center",
          backgroundColor: reachOut ? theme.peach : theme.soft,
          marginTop: 28,
        }}
      >
        <Ionicons
          name={reachOut ? "people-outline" : "phone-portrait-outline"}
          size={38}
          color={theme.primary}
        />
      </View>
      <MoriText variant="title" style={{ textAlign: "center" }}>
        {reachOut
          ? "Nghĩ tới một người khiến bạn thấy an toàn."
          : "Bạn có thể rời màn hình một chút."}
      </MoriText>
      <MoriText muted style={{ textAlign: "center" }}>
        {reachOut
          ? "Một tin nhắn ngắn như “Bạn có rảnh nói chuyện một chút không?” cũng đã đủ để bắt đầu."
          : "Đặt điện thoại xuống, nhìn ra xa hoặc bước đi vài phút. Không cần quay lại ngay."}
      </MoriText>
      <MoriButton onPress={() => router.replace("/(tabs)")}>
        {reachOut ? "Mình đã nghĩ ra một người" : "Trở về khi mình sẵn sàng"}
      </MoriButton>
    </ScreenContainer>
  );
}
