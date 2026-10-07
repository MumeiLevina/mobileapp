import { z } from "zod";

export const SoftGoalStatus = z.enum(["active", "completed", "archived"]);

export const createSoftGoalSchema = z.object({
  title: z.string().trim().min(1).max(160),
  note: z.string().trim().max(2000).default(""),
  client_id: z.string().uuid(),
  source_type: z.enum(["manual", "conversation"]).default("manual"),
  source_id: z.string().uuid().nullable().default(null),
});

export const updateSoftGoalSchema = createSoftGoalSchema
  .pick({ title: true, note: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0);

export type SoftGoalStatus = z.infer<typeof SoftGoalStatus>;
export type SoftGoal = {
  id: string;
  user_id: string;
  title: string;
  note: string;
  status: SoftGoalStatus;
  source_type: "manual" | "conversation";
  source_id: string | null;
  client_id: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  archived_at: string | null;
};
