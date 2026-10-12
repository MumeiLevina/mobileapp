import { notificationSchema } from "@mori/shared";
import { ritualReminderPlan } from "../services/notifications";

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
  const Notifications = require("expo-notifications") as typeof import("expo-notifications");
  const { scheduleReminder, scheduleLetterNotification } =
    require("../services/notifications") as typeof import("../services/notifications");

  beforeEach(() => jest.clearAllMocks());

  test("does not request notification permission when saving a future letter", async () => {
    jest.spyOn(Notifications, "getPermissionsAsync").mockResolvedValue({
      granted: false,
    } as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>);
    const request = jest.spyOn(Notifications, "requestPermissionsAsync");
    const schedule = jest.spyOn(Notifications, "scheduleNotificationAsync");

    await expect(
      scheduleLetterNotification("letter-1", new Date(Date.now() + 86400000).toISOString()),
    ).resolves.toBe(false);
    expect(request).not.toHaveBeenCalled();
    expect(schedule).not.toHaveBeenCalled();
  });

  test("keeps existing ritual reminders if the permission request is denied", async () => {
    jest.spyOn(Notifications, "getPermissionsAsync").mockResolvedValue({
      granted: false,
    } as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>);
    jest.spyOn(Notifications, "requestPermissionsAsync").mockResolvedValue({
      granted: false,
    } as Awaited<ReturnType<typeof Notifications.requestPermissionsAsync>>);
    const cancel = jest.spyOn(Notifications, "cancelScheduledNotificationAsync");
    await expect(scheduleReminder(preference({ morning_enabled: true }))).rejects.toThrow(
      "Chưa có quyền gửi lời nhắc",
    );
    expect(cancel).not.toHaveBeenCalled();
  });

  test("turning reminders off cancels schedules without requesting permissions", async () => {
    const cancel = jest.spyOn(Notifications, "cancelScheduledNotificationAsync").mockResolvedValue();
    const request = jest.spyOn(Notifications, "requestPermissionsAsync");
    await scheduleReminder(preference());
    expect(cancel).toHaveBeenCalledWith("ritual:morning");
    expect(cancel).toHaveBeenCalledWith("ritual:evening");
    expect(request).not.toHaveBeenCalled();
  });
});
