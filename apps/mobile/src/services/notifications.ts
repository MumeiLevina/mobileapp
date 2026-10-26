import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { NotificationPreference } from "@mori/shared";

// Native scheduling and cleanup share one queue, so a late old-owner action
// cannot overwrite or cancel a newer owner's schedule.
let notificationQueue = Promise.resolve<unknown>(undefined);
function enqueueNotification<T>(action: () => Promise<T>): Promise<T> {
  const result = notificationQueue.catch(() => undefined).then(action);
  notificationQueue = result;
  return result;
}
function assertCurrent(isCurrent: () => boolean) {
  if (!isCurrent())
    throw new Error("Tài khoản đã thay đổi. Hãy mở lại màn hình để tiếp tục.");
}

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

export function scheduleLetterNotification(
  letterId: string,
  openAt: string,
  isCurrent = () => true,
) {
  return enqueueNotification(() =>
    scheduleLetterNow(letterId, openAt, isCurrent),
  );
}
async function scheduleLetterNow(
  letterId: string,
  openAt: string,
  isCurrent: () => boolean,
): Promise<boolean> {
  assertCurrent(isCurrent);
  if (Platform.OS === "web") return false;
  const plan = letterNotificationPlan(letterId, openAt);
  if (!plan) return false;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("letters", {
      name: "Thư gửi chính mình",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  // Saving a private letter must not trigger an unsolicited OS permission prompt.
  // Only schedule it if the user has already granted notification permission.
  const permission = await Notifications.getPermissionsAsync();
  assertCurrent(isCurrent);
  if (!permission.granted) return false;
  await Notifications.cancelScheduledNotificationAsync(plan.identifier).catch(
    () => undefined,
  );
  assertCurrent(isCurrent);
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
  if (!isCurrent()) {
    await Notifications.cancelScheduledNotificationAsync(plan.identifier);
    assertCurrent(isCurrent);
  }
  return true;
}

export function cancelLetterNotification(
  letterId: string,
  isCurrent = () => true,
) {
  return enqueueNotification(async () => {
    if (Platform.OS === "web" || !isCurrent()) return;
    await Notifications.cancelScheduledNotificationAsync(`letter:${letterId}`);
  });
}

export function cancelAllMoriNotifications(isCurrent = () => true) {
  return enqueueNotification(async () => {
    if (Platform.OS === "web" || !isCurrent()) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
  });
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

export function scheduleReminder(
  preference: NotificationPreference,
  isCurrent = () => true,
) {
  return enqueueNotification(() => scheduleReminderNow(preference, isCurrent));
}
async function scheduleReminderNow(
  preference: NotificationPreference,
  isCurrent: () => boolean,
) {
  assertCurrent(isCurrent);
  if (Platform.OS === "web") return;

  const plan = ritualReminderPlan(preference);
  const cancelExisting = () =>
    Promise.all(
      (["morning", "evening"] as const).map((id) =>
        Notifications.cancelScheduledNotificationAsync(`ritual:${id}`).catch(
          () => undefined,
        ),
      ),
    );

  // Turning reminders off must work even when notifications are denied.
  if (plan.length === 0) {
    await cancelExisting();
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
  assertCurrent(isCurrent);
  if (!permission.granted) {
    throw new Error(
      "Chưa có quyền gửi lời nhắc. Bạn có thể bật trong cài đặt thiết bị.",
    );
  }

  // Do not delete previously scheduled reminders if permission is denied.
  await cancelExisting();
  for (const reminder of plan) {
    assertCurrent(isCurrent);
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
    if (!isCurrent()) {
      await cancelExisting();
      assertCurrent(isCurrent);
    }
  }
}
