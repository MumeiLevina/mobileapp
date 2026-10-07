import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { MoriButton, MoriText, ScreenContainer } from "../../components/ui";
import { HumanConnection } from "../../features/support/HumanConnection";
import { useTheme } from "../../theme";

export default function MomentSuggestion() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const theme = useTheme();
  const reachOut = kind === "reach-out";

  if (reachOut) {
    return (
      <ScreenContainer back>
        <HumanConnection back="/(tabs)" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer back>
      <View
        accessible
        accessibilityLabel={"Tạm rời màn hình"}
        style={{
          width: 82,
          height: 82,
          borderRadius: 41,
          alignItems: "center",
          justifyContent: "center",
          alignSelf: "center",
          backgroundColor: theme.soft,
          marginTop: 28,
        }}
      >
        <Ionicons
          name="phone-portrait-outline"
          size={38}
          color={theme.primary}
        />
      </View>
      <MoriText variant="title" style={{ textAlign: "center" }}>
        Có thể bạn không cần thêm gì từ màn hình lúc này.
      </MoriText>
      <MoriText muted style={{ textAlign: "center" }}>
        Chọn một điều nhỏ, hoặc chỉ đặt điện thoại xuống. Không cần quay lại
        ngay.
      </MoriText>
      <MoriButton
        variant="secondary"
        icon="phone-portrait-outline"
        onPress={() => undefined}
      >
        Đặt điện thoại xuống
      </MoriButton>
      <MoriButton
        variant="secondary"
        icon="water-outline"
        onPress={() => undefined}
      >
        Uống một chút nước
      </MoriButton>
      <MoriButton
        variant="secondary"
        icon="walk-outline"
        onPress={() => undefined}
      >
        Đi ra ngoài một lát
      </MoriButton>
      <MoriButton onPress={() => router.replace("/(tabs)")}>
        Quay lại Mori
      </MoriButton>
    </ScreenContainer>
  );
}
