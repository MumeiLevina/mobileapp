import { PropsWithChildren, ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useTheme } from "../theme";
import { MoriIconButton, MoriText, ScreenContainer } from "./ui";

export function OnboardingScaffold({
  step,
  totalSteps,
  onBack,
  footer,
  children,
}: PropsWithChildren<{
  step: number;
  totalSteps: number;
  onBack: () => void;
  footer?: ReactNode;
}>) {
  const theme = useTheme();

  return (
    <ScreenContainer scroll={false}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <MoriIconButton
          icon="arrow-back"
          accessibilityLabel="Quay lại bước trước"
          onPress={onBack}
        />
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`Bước ${step} trên ${totalSteps}`}
          accessibilityValue={{ min: 1, max: totalSteps, now: step }}
          style={{ flex: 1, gap: 7 }}
        >
          <MoriText muted variant="small">
            Bước {step} / {totalSteps}
          </MoriText>
          <View style={{ flexDirection: "row", gap: 5 }}>
            {Array.from({ length: totalSteps }, (_, index) => (
              <View
                key={index}
                style={{
                  height: 4,
                  flex: 1,
                  borderRadius: 2,
                  backgroundColor: index < step ? theme.primary : theme.line,
                }}
              />
            ))}
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, gap: 12 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: 16, paddingBottom: 12, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        {footer ? <View style={{ paddingTop: 4 }}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
