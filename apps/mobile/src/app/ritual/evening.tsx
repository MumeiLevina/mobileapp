import { useState } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  MoriButton,
  MoriCard,
  MoriText,
  ScreenContainer,
  styles,
} from "../../components/ui";
import { MoodPicker } from "../../features/mood/MoodPicker";
import {
  eveningDestination,
  EveningRitualAction,
} from "../../features/rituals/evening-actions";
import { useTheme } from "../../theme";

export default function EveningRitual() {
  const theme = useTheme();
  const [showMood, setShowMood] = useState(false);

  const choose = (action: EveningRitualAction) => {
    if (action === EveningRitualAction.mood) {
      setShowMood(true);
      return;
    }
    const destination = eveningDestination(action);
    if (destination) router.replace(destination);
  };

  return (
    <ScreenContainer back>
      <View
        accessible
        accessibilityLabel="Mặt trăng buổi tối"
        style={{
          width: 88,
          height: 88,
          borderRadius: 44,
          alignSelf: "center",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.soft,
          marginTop: 8,
        }}
      >
        <Ionicons name="moon-outline" size={40} color={theme.primary} />
      </View>

      <View style={{ gap: 7, alignItems: "center" }}>
        <MoriText variant="title" style={{ textAlign: "center" }}>
          Hôm nay đã đi qua rồi.
        </MoriText>
        <MoriText muted style={{ textAlign: "center" }}>
          Bạn muốn để lại điều gì ở đây trước khi nghỉ?
        </MoriText>
      </View>

      {showMood ? (
        <MoriCard>
          <MoriText style={{ fontWeight: "600" }}>
            Cảm xúc nào đang ở đây cùng bạn?
          </MoriText>
          <MoriText muted variant="small">
            Chỉ ghi lại nếu điều đó có ích với bạn lúc này.
          </MoriText>
          <MoodPicker onComplete={() => router.replace("/(tabs)")} />
          <MoriButton variant="ghost" onPress={() => setShowMood(false)}>
            Chọn một cách khác
          </MoriButton>
        </MoriCard>
      ) : (
        <View style={styles.stack}>
          <MoriButton
            variant="secondary"
            icon="book-outline"
            onPress={() => choose(EveningRitualAction.write)}
          >
            Viết vài dòng
          </MoriButton>
          <MoriButton
            variant="secondary"
            icon="leaf-outline"
            onPress={() => choose(EveningRitualAction.breathe)}
          >
            Thở 2 phút
          </MoriButton>
          <MoriButton
            variant="secondary"
            icon="rainy-outline"
            onPress={() => choose(EveningRitualAction.quiet)}
          >
            Ngồi yên một chút
          </MoriButton>
          <MoriButton
            variant="secondary"
            icon="happy-outline"
            onPress={() => choose(EveningRitualAction.mood)}
          >
            Ghi lại cảm xúc
          </MoriButton>
          <MoriButton
            variant="ghost"
            onPress={() => choose(EveningRitualAction.finish)}
          >
            Không cần gì thêm
          </MoriButton>
        </View>
      )}

      <MoriText muted variant="small" style={{ textAlign: "center" }}>
        Không có bước nào bắt buộc. Dừng ở đây cũng được.
      </MoriText>
    </ScreenContainer>
  );
}
