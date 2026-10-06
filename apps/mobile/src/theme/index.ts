import { useColorScheme } from "react-native";
import { usePreferences } from "../store/preferences";
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const typography = {
  hero: 36,
  title: 28,
  subtitle: 21,
  body: 16,
  small: 13,
};
export const palettes = {
  light: {
    background: "#F8F6EF",
    surface: "#FFFEFA",
    text: "#293D32",
    muted: "#667064",
    primary: "#405E48",
    onPrimary: "#FFFFFF",
    line: "#DEDFD5",
    soft: "#E9EDE2",
    peach: "#F2E2D2",
    error: "#9A433A",
    night: false,
  },
  dark: {
    background: "#18251F",
    surface: "#22332A",
    text: "#F1F1E5",
    muted: "#B3BCAF",
    primary: "#BAD2AE",
    onPrimary: "#203227",
    line: "#405044",
    soft: "#304437",
    peach: "#504239",
    error: "#F0ADA2",
    night: true,
  },
};
export function useTheme() {
  const mode = usePreferences((s) => s.theme);
  const system = useColorScheme();
  return palettes[
    mode === "system" ? (system === "dark" ? "dark" : "light") : mode
  ];
}
