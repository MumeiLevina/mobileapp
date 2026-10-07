import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { MoriPressable, MoriText } from "../../components/ui";
import { useTheme } from "../../theme";
export function SelfCareCard({
  title,
  subtitle,
  icon,
  to,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  to: string;
}) {
  const t = useTheme();
  return (
    <MoriPressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      guardMs={350}
      onPress={() => router.push(to as "/self-care")}
      style={(pressed) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        paddingVertical: 15,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 53,
          height: 53,
          borderRadius: 18,
          backgroundColor: t.soft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={24} color={t.primary} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <MoriText>{title}</MoriText>
        <MoriText muted variant="small">
          {subtitle}
        </MoriText>
      </View>
      <Ionicons name="arrow-forward" size={18} color={t.muted} />
    </MoriPressable>
  );
}
