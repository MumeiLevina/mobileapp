import { router } from "expo-router";
import {
  MoriButton,
  MoriText,
  ScreenContainer,
  styles,
} from "../components/ui";
import { firstAidActions } from "../features/first-aid/content";
import { View } from "react-native";

export default function FirstAid() {
  return (
    <ScreenContainer back>
      <MoriText variant="title">Mình đang có một lúc khó khăn.</MoriText>
      <MoriText muted>Bạn cần điều gì nhất lúc này?</MoriText>
      <View style={styles.stack}>
        {firstAidActions.map((action) => (
          <MoriButton
            key={action.id}
            variant={action.id === "danger" ? "dangerGhost" : "secondary"}
            icon={action.icon}
            onPress={() => router.push(action.route as "/self-care")}
          >
            {action.label}
          </MoriButton>
        ))}
      </View>
      <MoriText muted variant="small" style={{ textAlign: "center" }}>
        Không lựa chọn nào ở đây được thêm vào ký ức hay nhật ký của Mori.
      </MoriText>
    </ScreenContainer>
  );
}
