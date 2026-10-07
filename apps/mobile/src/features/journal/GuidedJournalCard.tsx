import { GuidedJournalTemplate } from "@mori/shared";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { View } from "react-native";
import { MoriCard, MoriPressable, MoriText } from "../../components/ui";
import { usePreferences } from "../../store/preferences";
import { useTheme } from "../../theme";

const icons: Record<
  GuidedJournalTemplate["category"],
  keyof typeof Ionicons.glyphMap
> = {
  evening: "moon-outline",
  morning: "sunny-outline",
  heavy_moment: "rainy-outline",
  feeling_lost: "compass-outline",
  study_pressure: "school-outline",
  work_pressure: "briefcase-outline",
  relationships: "heart-outline",
  self_understanding: "leaf-outline",
  after_difficulty: "water-outline",
  gratitude: "flower-outline",
};

export function GuidedJournalCard({
  template,
}: {
  template: GuidedJournalTemplate;
}) {
  const locale = usePreferences((state) => state.locale);
  const theme = useTheme();
  const title = locale === "en" ? template.titleEn : template.titleVi;
  const description =
    locale === "en" ? template.descriptionEn : template.descriptionVi;
  const duration =
    locale === "en"
      ? `${template.estimatedMinutes} min`
      : `${template.estimatedMinutes} phút`;

  return (
    <MoriPressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${duration}`}
      guardMs={350}
      onPress={() =>
        router.push(`/guided-journal/${template.slug}` as "/self-care")
      }
      style={(pressed) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      <MoriCard>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.soft,
            }}
          >
            <Ionicons
              name={icons[template.category]}
              size={23}
              color={theme.primary}
            />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <MoriText variant="subtitle">{title}</MoriText>
            <MoriText muted variant="small">
              {duration}
            </MoriText>
          </View>
          <Ionicons name="arrow-forward" size={19} color={theme.muted} />
        </View>
        <MoriText muted>{description}</MoriText>
      </MoriCard>
    </MoriPressable>
  );
}
