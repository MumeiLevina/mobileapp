import { router } from "expo-router";
import { MoriPressable, MoriText } from "../../components/ui";
import { useTheme } from "../../theme";
import { useTranslate } from "../../i18n";

export function GardenHotspot({
  label,
  icon,
  to,
}: {
  label: string;
  icon: string;
  to: string;
}) {
  const theme = useTheme();
  const tr = useTranslate();
  return (
    <MoriPressable
      testID={`garden-hotspot-${to.slice(1).replaceAll("/", "-")}`}
      accessibilityRole="button"
      accessibilityLabel={`${tr(label)}, ${tr("Mở khu vực")}`}
      onPress={() => router.push(to as "/timeline")}
      wrapperStyle={{ flexBasis: "45%", flexGrow: 1, minWidth: 0 }}
      style={(pressed) => ({
        minWidth: 48,
        minHeight: 48,
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
      <MoriText variant="small" style={{ textAlign: "center" }}>
        {label}
      </MoriText>
    </MoriPressable>
  );
}
