import { getGuidedJournalTemplate } from "@mori/shared";
import {
  buildGuidedJournalContent,
  createGuidedJournalDraft,
  readGuidedJournalDraft,
} from "../features/journal/guided-draft";

const template = getGuidedJournalTemplate("khi-minh-thay-mat-phuong-huong")!;

test("guided journal draft restores answers and current prompt", () => {
  const draft = createGuidedJournalDraft(template);
  const stored = JSON.stringify({
    ...draft,
    answers: ["Điều thứ nhất", "Điều thứ hai", ""],
    step: 2,
  });

  expect(readGuidedJournalDraft(stored, template)).toEqual({
    ...draft,
    answers: ["Điều thứ nhất", "Điều thứ hai", ""],
    step: 2,
  });
});

test("saved guided content keeps each prompt beside its answer", () => {
  const content = buildGuidedJournalContent(
    template,
    ["Một", "Hai", "Ba"],
    "vi",
  );

  const first = content.indexOf(template.prompts[0].vi);
  const second = content.indexOf(template.prompts[1].vi);
  const third = content.indexOf(template.prompts[2].vi);
  expect(first).toBeLessThan(second);
  expect(second).toBeLessThan(third);
  expect(content).toContain(`${template.prompts[2].vi}\n\nBa`);
});
