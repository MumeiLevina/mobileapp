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
