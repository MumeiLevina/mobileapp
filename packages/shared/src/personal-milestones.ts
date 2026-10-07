import { z } from "zod";

export const PersonalMilestoneKey = z.enum([
  "quiet_cottage_appeared",
  "reflection_lake_appeared",
  "memory_garden_appeared",
  "first_letter",
  "wind_chimes_appeared",
  "first_weekly_reflection",
  "first_soft_goal",
  "moon_hill_appeared",
]);

export type PersonalMilestoneKey = z.infer<typeof PersonalMilestoneKey>;

export type PersonalMilestone = {
  id: string;
  user_id: string;
  milestone_key: PersonalMilestoneKey;
  created_at: string;
  acknowledged_at: string | null;
  source_type: string | null;
  source_id: string | null;
};
