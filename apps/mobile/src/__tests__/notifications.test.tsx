import { notificationSchema } from "@mori/shared";
import * as Notifications from "expo-notifications";
import {
  ritualReminderPlan,
  scheduleLetterNotification,
  scheduleReminder,
} from "../services/notifications";

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: "date", DAILY: "daily" },
}));

const preference = (input: Record<string, unknown> = {}) =>
  notificationSchema.parse({
    period: "off",
    hour: 20,
    minute: 0,
    timezone: "Asia/Ho_Chi_Minh",
    ...input,
  });

test("ritual reminders are off by default", () => {
  const value = preference();

  expect(value.morning_enabled).toBe(false);
  expect(value.evening_enabled).toBe(false);
  expect(ritualReminderPlan(value)).toEqual([]);
});

test("morning and evening reminders keep independent local times", () => {
  const value = preference({
    timezone: "Asia/Tokyo",
    morning_enabled: true,
    morning_hour: 7,
    morning_minute: 15,
    evening_enabled: true,
    evening_hour: 21,
    evening_minute: 30,
  });

  expect(value.timezone).toBe("Asia/Tokyo");
  expect(ritualReminderPlan(value)).toEqual([
    expect.objectContaining({ id: "morning", hour: 7, minute: 15 }),
    expect.objectContaining({ id: "evening", hour: 21, minute: 30 }),
  ]);
  expect(
    ritualReminderPlan(value)
      .map((item) => item.title)
      .join(" "),
  ).not.toMatch(/streak|chuỗi|bỏ lỡ/i);
});

describe("native notification permission boundaries", () => {
  beforeEach(() => jest.clearAllMocks());

  test("does not request notification permission when saving a future letter", async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      granted: false,
    } as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>);

    await expect(
      scheduleLetterNotification(
        "letter-1",
        new Date(Date.now() + 86400000).toISOString(),
      ),
    ).resolves.toBe(false);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  test("keeps existing ritual reminders if the permission request is denied", async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      granted: false,
    } as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>);
    jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({
      granted: false,
    } as Awaited<ReturnType<typeof Notifications.requestPermissionsAsync>>);

    await expect(
      scheduleReminder(preference({ morning_enabled: true })),
    ).rejects.toThrow("Chưa có quyền gửi lời nhắc");
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  test("turning reminders off cancels schedules without requesting permissions", async () => {
    jest.mocked(Notifications.cancelScheduledNotificationAsync)
      .mockResolvedValue(undefined);

    await scheduleReminder(preference());
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "ritual:morning",
    );
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "ritual:evening",
    );
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});
