import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { NotificationPreference } from "@mori/shared";

export type RitualReminder = {
  id: "morning" | "evening";
  hour: number;
  minute: number;
  title: string;
  body: string;
};

export function ritualReminderPlan(
  preference: NotificationPreference,
): RitualReminder[] {
  const plan: RitualReminder[] = [];
  if (preference.morning_enabled) {
    plan.push({
      id: "morning",
      hour: preference.morning_hour,
      minute: preference.morning_minute,
      title: "🌿 Một khoảnh khắc cho ngày mới?",
      body: "Bạn muốn dành điều gì nhỏ cho hôm nay?",
    });
  }
  if (preference.evening_enabled) {
    plan.push({
      id: "evening",
      hour: preference.evening_hour,
      minute: preference.evening_minute,
      title: "🌙 Có điều gì bạn muốn đặt xuống tối nay?",
      body: "Dừng lại một chút cũng được.",
    });
  }
  return plan;
}

export async function scheduleReminder(preference: NotificationPreference) {
  if (Platform.OS === "web") return;

  const plan = ritualReminderPlan(preference);
  if (plan.length === 0) {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("self-care", {
      name: "Khoảng nghỉ cho bạn",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted
    ? current
    : await Notifications.requestPermissionsAsync();
  if (!permission.granted) {
    throw new Error(
      "Chưa có quyền gửi lời nhắc. Bạn có thể bật trong cài đặt thiết bị.",
    );
  }

  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const reminder of plan) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: reminder.title,
        body: reminder.body,
        sound: false,
        data: { ritual: reminder.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: reminder.hour,
        minute: reminder.minute,
        channelId: "self-care",
      },
    });
  }
}
