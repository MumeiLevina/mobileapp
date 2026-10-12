import {
  emptyOnboardingDraft,
  readOnboardingDraft,
} from "../features/onboarding/onboarding-draft";

test("onboarding draft restores progress and choices", () => {
  expect(
    readOnboardingDraft(
      JSON.stringify({
        version: 1,
        step: 4,
        name: "An",
        selected: ["Một nơi để tâm sự"],
        style: "calm",
      }),
    ),
  ).toEqual({
    version: 1,
    step: 4,
    name: "An",
    selected: ["Một nơi để tâm sự"],
    style: "calm",
  });
});

test.each([
  "",
  "not-json",
  JSON.stringify({ version: 1, step: 6 }),
  JSON.stringify({
    version: 1,
    step: 2,
    name: "An",
    selected: [],
    style: "unsupported",
  }),
])("invalid onboarding draft falls back safely", (value) => {
  expect(readOnboardingDraft(value)).toEqual(emptyOnboardingDraft);
});
