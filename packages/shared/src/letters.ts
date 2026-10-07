import { z } from "zod";

export const letterCreateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(20000),
  open_at: z.string().datetime({ offset: true }),
  client_id: z.string().uuid().optional(),
});

export const letterUpdateSchema = letterCreateSchema
  .omit({ client_id: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0);

export type Letter = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  open_at: string;
  opened_at: string | null;
  deleted_at: string | null;
  client_id?: string | null;
};

export type LetterStatus = "upcoming" | "ready" | "opened";

export type LetterSummary = Omit<
  Letter,
  "user_id" | "content" | "client_id"
> & {
  status: LetterStatus;
};
