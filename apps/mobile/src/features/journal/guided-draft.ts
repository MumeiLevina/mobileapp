import {
  GuidedJournalTemplate,
  guidedJournalTemplateSchema,
} from "@mori/shared";
import { z } from "zod";
import { newId } from "../../lib/id";

const guidedJournalDraftSchema = z.object({
  version: z.literal(1),
  templateId: z.string(),
  answers: z.array(z.string().max(4000)),
  step: z.number().int().min(0),
  clientId: z.string().uuid(),
});

export type GuidedJournalDraft = z.infer<typeof guidedJournalDraftSchema>;

export function createGuidedJournalDraft(
  template: GuidedJournalTemplate,
): GuidedJournalDraft {
  return {
    version: 1,
    templateId: template.id,
    answers: template.prompts.map(() => ""),
    step: 0,
    clientId: newId(),
  };
}

export function readGuidedJournalDraft(
  stored: string,
  template: GuidedJournalTemplate,
) {
  try {
    const parsed = guidedJournalDraftSchema.parse(JSON.parse(stored));
    if (
      parsed.templateId !== template.id ||
      parsed.answers.length !== template.prompts.length ||
      parsed.step > template.prompts.length
    ) {
      return createGuidedJournalDraft(template);
    }
    return parsed;
  } catch {
    return createGuidedJournalDraft(template);
  }
}

export function buildGuidedJournalContent(
  template: GuidedJournalTemplate,
  answers: readonly string[],
  locale: "vi" | "en",
) {
  guidedJournalTemplateSchema.parse(template);
  return template.prompts
    .map((prompt, index) => {
      const question = locale === "en" ? prompt.en : prompt.vi;
      return `${question}\n\n${answers[index]?.trim() ?? ""}`;
    })
    .join("\n\n—\n\n");
}
