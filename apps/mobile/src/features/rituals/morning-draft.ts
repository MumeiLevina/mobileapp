import { DesiredFeeling } from "@mori/shared";
import { z } from "zod";
import { newId } from "../../lib/id";

const morningRitualDraftSchema = z.object({
  version: z.literal(1),
  desiredFeeling: DesiredFeeling.nullable(),
  smallIntention: z.string().max(1000),
  clientId: z.string().uuid(),
});

export type MorningRitualDraft = z.infer<typeof morningRitualDraftSchema>;

export function createMorningRitualDraft(): MorningRitualDraft {
  return {
    version: 1,
    desiredFeeling: null,
    smallIntention: "",
    clientId: newId(),
  };
}

export function readMorningRitualDraft(stored: string): MorningRitualDraft {
  try {
    return morningRitualDraftSchema.parse(JSON.parse(stored));
  } catch {
    return createMorningRitualDraft();
  }
}
