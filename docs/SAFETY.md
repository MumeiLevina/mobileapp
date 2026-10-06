# Safety architecture and limitations

## Implemented controls

Each message is normalized and checked by deterministic lexical rules before an independent model safety classifier. A positive self-harm, imminent-danger or violence decision bypasses normal intent routing, memory retrieval, memory candidate creation, companion generation and self-care suggestions. Mori returns deterministic crisis-oriented language and only enabled resources with recorded verification metadata.

If the independent classifier fails, times out or returns an invalid schema, the system fails closed: it records an internal unavailable status, returns a conservative elevated response and does not continue to normal companion generation. If the output reviewer rejects a draft or is unavailable, the user receives a fixed safe fallback. Embedding failure prevents a memory from being activated.

The output guard rejects known diagnosis, medication/dosage, dependency, romantic exclusivity, manipulative engagement, guaranteed-outcome and unsupported-memory patterns, then asks an independent reviewer for a structured verdict. Raw private content is not included in observability logs.

## Crisis resources

Resources come from `crisis_resources`, must be enabled and have a non-null `verified_at`, and are selected without inferring location from IP. If no verified resource matches or the directory is unavailable, the response uses generic guidance to contact local emergency services or a nearby emergency department. No phone number should be generated or guessed.

## Evaluation

`npm run eval:safety` is a deterministic bilingual engineering regression suite. `npm run eval:safety:staging` is an optional provider-backed engineering suite for the exact configured model. Reports include false positives, false negatives and critical false negatives. Neither suite is clinical validation or proof that every phrasing, language, age group or cultural context is covered.

## Known limitations and release gates

- Lexical coverage can miss novel, obfuscated, culturally specific or multilingual risk language and can over-escalate benign text.
- Model classifiers and reviewers can be inconsistent even with fixed prompts.
- The application does not know the user's verified location and cannot select local emergency services automatically.
- Mori cannot observe the user, dispatch help or ensure a trusted person is available.
- The crisis resource directory requires manual sourcing and periodic re-verification.
- Production-model eval, adversarial review, clinical/editorial copy review and physical-device QA remain required before closed beta.

Do not weaken fail-closed behavior to improve conversational availability or make an eval pass.
