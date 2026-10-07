import { router } from "expo-router";
import { ViewStyle } from "react-native";
import { MoriPressable, MoriText } from "../../components/ui";
import { useTheme } from "../../theme";

export function GardenHotspot({
  label,
  icon,
  to,
  style,
}: {
  label: string;
  icon: string;
  to: string;
  style: ViewStyle;
}) {
  const theme = useTheme();
  return (
    <MoriPressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, mở khu vực`}
      onPress={() => router.push(to as "/timeline")}
      wrapperStyle={{ position: "absolute", ...style }}
      style={(pressed) => ({
        minWidth: 48,
        minHeight: 44,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.night ? "#203933DD" : "#FFFDF0E8",
        borderColor: theme.line,
        borderWidth: 1,
        opacity: pressed ? 0.76 : 1,
      })}
    >
      <MoriText translate={false} style={{ fontSize: 16, lineHeight: 18 }}>
        {icon}
      </MoriText>
      <MoriText variant="small" style={{ fontSize: 9, lineHeight: 12 }}>
        {label}
      </MoriText>
    </MoriPressable>
  );
}
