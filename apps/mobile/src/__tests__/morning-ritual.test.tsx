import {
  createMorningRitualDraft,
  readMorningRitualDraft,
} from "../features/rituals/morning-draft";

test("morning ritual draft restores private progress and client id", () => {
  const original = createMorningRitualDraft();
  const stored = JSON.stringify({
    ...original,
    desiredFeeling: "gentle",
    smallIntention: "Đi bộ chậm trong mười phút.",
  });

  expect(readMorningRitualDraft(stored)).toEqual({
    ...original,
    desiredFeeling: "gentle",
    smallIntention: "Đi bộ chậm trong mười phút.",
  });
});

test("invalid morning ritual draft starts a fresh private draft", () => {
  const restored = readMorningRitualDraft('{"version":2}');

  expect(restored.version).toBe(1);
  expect(restored.desiredFeeling).toBeNull();
  expect(restored.smallIntention).toBe("");
  expect(restored.clientId).toMatch(/^[0-9a-f-]{36}$/);
});
