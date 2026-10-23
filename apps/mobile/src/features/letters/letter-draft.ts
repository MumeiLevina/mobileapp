import { letterCreateSchema } from "@mori/shared";
import { newId } from "../../lib/id";
import { z } from "zod";
import { parseDraft } from "../../lib/draft-recovery";

export type LetterDelay = "week" | "month" | "quarter" | "year" | "custom";

export type LetterDraft = {
  version?: 1;
  title: string;
  content: string;
  delay: LetterDelay;
  customDate: string;
  clientId: string;
};

export const createLetterDraft = (): LetterDraft => ({
  version: 1,
  title: "",
  content: "",
  delay: "month",
  customDate: "",
  clientId: newId(),
});

export function readLetterDraft(value: string): LetterDraft {
  if (!value) return createLetterDraft();
  return parseDraft(
    value,
    z.object({
      version: z.literal(1).optional(),
      title: z.string().max(120),
      content: z.string().max(20000),
      delay: z.enum(["week", "month", "quarter", "year", "custom"]),
      customDate: z.string(),
      clientId: z.string().uuid(),
    }),
  );
}

export function letterOpenDate(draft: LetterDraft, now = new Date()): Date {
  const date = new Date(now);
  date.setSeconds(0, 0);
  if (draft.delay === "week") date.setDate(date.getDate() + 7);
  if (draft.delay === "month") date.setMonth(date.getMonth() + 1);
  if (draft.delay === "quarter") date.setMonth(date.getMonth() + 3);
  if (draft.delay === "year") date.setFullYear(date.getFullYear() + 1);
  if (draft.delay === "custom") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(draft.customDate);
    if (!match) throw new Error("Hãy nhập ngày theo dạng YYYY-MM-DD.");
    const custom = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      9,
      0,
      0,
      0,
    );
    if (
      custom.getFullYear() !== Number(match[1]) ||
      custom.getMonth() !== Number(match[2]) - 1 ||
      custom.getDate() !== Number(match[3])
    )
      throw new Error("Ngày bạn chọn chưa hợp lệ.");
    date.setTime(custom.getTime());
  }
  if (date.getTime() <= now.getTime())
    throw new Error("Hãy chọn một ngày trong tương lai.");
  return date;
}

export function letterPayload(draft: LetterDraft, now = new Date()) {
  return letterCreateSchema.parse({
    title: draft.title,
    content: draft.content,
    open_at: letterOpenDate(draft, now).toISOString(),
    client_id: draft.clientId,
  });
}
