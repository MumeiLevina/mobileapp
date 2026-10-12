import { z } from "zod";
import { CompanionStyle } from "@mori/shared";

const schema = z.object({
  version: z.literal(1),
  step: z.number().int().min(0).max(5),
  name: z.string().max(60),
  selected: z.array(z.string()).max(6),
  style: z.enum(["gentle", "close_friend", "calm"]),
});

export type OnboardingDraft = {
  version: 1;
  step: number;
  name: string;
  selected: string[];
  style: CompanionStyle;
};

export const emptyOnboardingDraft: OnboardingDraft = {
  version: 1,
  step: 0,
  name: "",
  selected: [],
  style: "gentle",
};

export function readOnboardingDraft(value: string): OnboardingDraft {
  try {
    return schema.parse(JSON.parse(value));
  } catch {
    return emptyOnboardingDraft;
  }
}
