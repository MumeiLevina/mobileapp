import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

async function safely(run: () => Promise<void>) {
  if (Platform.OS === "web") return;
  try {
    await run();
  } catch {
    // Interaction feedback is optional and must never block the user's action.
  }
}

export const interactionFeedback = {
  selection: () => safely(() => Haptics.selectionAsync()),
  primary: () =>
    safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  success: () =>
    safely(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    ),
  warning: () =>
    safely(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
    ),
};
