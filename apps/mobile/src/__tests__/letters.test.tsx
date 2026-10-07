import {
  LetterDraft,
  letterOpenDate,
  letterPayload,
  readLetterDraft,
} from "../features/letters/letter-draft";
import { letterNotificationPlan } from "../services/notifications";

const now = new Date("2026-10-07T08:30:00.000Z");
const draft: LetterDraft = {
  title: "Gửi mình",
  content: "Một điều riêng tư",
  delay: "week",
  customDate: "",
  clientId: "88888888-8888-4888-a888-888888888888",
};

test("future letter draft restores private content and idempotency key", () => {
  expect(readLetterDraft(JSON.stringify(draft))).toEqual(draft);
  expect(letterPayload(draft, now)).toEqual({
    title: draft.title,
    content: draft.content,
    open_at: "2026-10-14T08:30:00.000Z",
    client_id: draft.clientId,
  });
});

test("custom letter date rejects invalid and past dates", () => {
  expect(() =>
    letterOpenDate(
      { ...draft, delay: "custom", customDate: "2026-02-30" },
      now,
    ),
  ).toThrow("chưa hợp lệ");
  expect(() =>
    letterOpenDate(
      { ...draft, delay: "custom", customDate: "2026-10-01" },
      now,
    ),
  ).toThrow("trong tương lai");
});

test("letter notification is calm, scheduled once, and has no urgency language", () => {
  const plan = letterNotificationPlan(
    "letter-1",
    "2026-10-14T08:30:00.000Z",
    now,
  );

  expect(plan).toEqual(
    expect.objectContaining({
      identifier: "letter:letter-1",
      letterId: "letter-1",
      title: "💌 Một lá thư bạn từng viết đã sẵn sàng.",
    }),
  );
  expect(`${plan?.title} ${plan?.body}`).not.toMatch(
    /chờ bạn|bỏ lỡ|hạn chót|streak/i,
  );
  expect(
    letterNotificationPlan("letter-1", "2026-10-01T00:00:00.000Z", now),
  ).toBeNull();
});
