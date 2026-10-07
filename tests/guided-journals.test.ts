import {
  getGuidedJournalTemplate,
  guidedJournalTemplateSchema,
  guidedJournalTemplates,
} from "../packages/shared/src";

test("curated guided journal templates are valid, enabled and ordered", () => {
  expect(guidedJournalTemplates).toHaveLength(10);
  expect(
    guidedJournalTemplates.every(
      (template) => guidedJournalTemplateSchema.safeParse(template).success,
    ),
  ).toBe(true);
  expect(guidedJournalTemplates.map((template) => template.sortOrder)).toEqual(
    [...guidedJournalTemplates]
      .map((template) => template.sortOrder)
      .sort((a, b) => a - b),
  );
  expect(
    new Set(guidedJournalTemplates.map((template) => template.slug)).size,
  ).toBe(guidedJournalTemplates.length);
});

test("When I Feel Lost preserves the reviewed prompt order", () => {
  const template = getGuidedJournalTemplate("khi-minh-thay-mat-phuong-huong");
  expect(template?.prompts.map((prompt) => prompt.vi)).toEqual([
    "Điều gì đang khiến mình cảm thấy mất phương hướng nhất lúc này?",
    "Có điều gì trước đây từng khiến mình cảm thấy có ý nghĩa hoặc vững vàng hơn?",
    "Nếu hôm nay không cần giải quyết tất cả, một bước thật nhỏ mình có thể làm là gì?",
  ]);
});
