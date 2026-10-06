import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { NotificationPreference } from "@mori/shared";
export async function scheduleReminder(preference: NotificationPreference) {
  if (Platform.OS === "web") {
    if (preference.period !== "off")
      throw new Error(
        "Lời nhắc cần bản ứng dụng iOS hoặc Android. Trên web, lời nhắc vẫn đang tắt.",
      );
    return;
  }
  if (preference.period === "off") {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return;
  }
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("self-care", {
      name: "Khoảng nghỉ cho bạn",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted
    ? current
    : await Notifications.requestPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      "Chưa có quyền gửi lời nhắc. Bạn có thể bật trong cài đặt thiết bị.",
    );
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Một khoảng nhỏ cho mình?",
      body: "Hôm nay đã đối xử với bạn thế nào?",
      sound: false,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: preference.hour,
      minute: preference.minute,
      channelId: "self-care",
    },
  });
  await Promise.all(
    existing.map((n) =>
      Notifications.cancelScheduledNotificationAsync(n.identifier),
    ),
  );
}
