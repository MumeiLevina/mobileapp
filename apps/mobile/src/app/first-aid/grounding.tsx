import { router } from "expo-router";
import {
  MoriButton,
  MoriCard,
  MoriText,
  ScreenContainer,
} from "../../components/ui";
import { groundingSteps } from "../../features/first-aid/content";

export default function Grounding() {
  return (
    <ScreenContainer back>
      <MoriText variant="title">Chạm lại vào khoảnh khắc này.</MoriText>
      <MoriText muted>
        Đi chậm từng bước. Điều này có thể giúp bạn chú ý lại vào khoảnh khắc
        hiện tại.
      </MoriText>
      {groundingSteps.map((step, index) => (
        <MoriCard key={step}>
          <MoriText variant="subtitle">{index + 1}</MoriText>
          <MoriText>{step}</MoriText>
        </MoriCard>
      ))}
      <MoriButton onPress={() => router.replace("/(tabs)")}>Trở về</MoriButton>
    </ScreenContainer>
  );
}
