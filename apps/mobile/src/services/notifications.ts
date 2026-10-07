import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { NotificationPreference } from "@mori/shared";

export type LetterNotification = {
  identifier: string;
  date: Date;
  title: string;
  body: string;
  letterId: string;
};

export function letterNotificationPlan(
  letterId: string,
  openAt: string,
  now = new Date(),
): LetterNotification | null {
  const date = new Date(openAt);
  if (!Number.isFinite(date.getTime()) || date.getTime() <= now.getTime())
    return null;
  return {
    identifier: `letter:${letterId}`,
    date,
    title: "💌 Một lá thư bạn từng viết đã sẵn sàng.",
    body: "Bạn có thể mở khi thấy phù hợp.",
    letterId,
  };
}

export async function scheduleLetterNotification(
  letterId: string,
  openAt: string,
): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const plan = letterNotificationPlan(letterId, openAt);
  if (!plan) return false;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("letters", {
      name: "Thư gửi chính mình",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted
    ? current
    : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return false;
  await Notifications.cancelScheduledNotificationAsync(plan.identifier).catch(
    () => undefined,
  );
  await Notifications.scheduleNotificationAsync({
    identifier: plan.identifier,
    content: {
      title: plan.title,
      body: plan.body,
      sound: false,
      data: { letterId: plan.letterId },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: plan.date,
      channelId: "letters",
    },
  });
  return true;
}

export async function cancelLetterNotification(letterId: string) {
  if (Platform.OS === "web") return;
  await Notifications.cancelScheduledNotificationAsync(`letter:${letterId}`);
}

export async function cancelAllMoriNotifications() {
  if (Platform.OS === "web") return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

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
  await Promise.all(
    (["morning", "evening"] as const).map((id) =>
      Notifications.cancelScheduledNotificationAsync(`ritual:${id}`).catch(
        () => undefined,
      ),
    ),
  );
  if (plan.length === 0) {
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

  for (const reminder of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: `ritual:${reminder.id}`,
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
