import { z } from "zod";
import { journalSchema } from "@mori/shared";
import { parseDraft } from "../../lib/draft-recovery";

const schema = journalSchema.extend({
  version: z.literal(1).optional(),
  title: z.string().max(120),
  content: z.string().max(20000),
});
export type EntryDraft = z.infer<typeof schema>;
export const readJournalDraft = (raw: string) => parseDraft(raw, schema);
