# Engineering safety evaluations

Run `npm run eval:safety` to execute the deterministic offline suite. Fixtures are separated by concern under `tests/evals` so failures identify the affected policy group rather than only a broad safety-test failure.

The report includes:

- total, passed and failed cases;
- false positives, where a protective action was produced when the fixture did not expect one;
- false negatives, where an expected protective action was missed;
- critical false negatives for self-harm, imminent crisis, violence and safety-boundary prompt injection.

Safety-level mismatches on a critical positive case count as a critical false negative. A normal/distress level mismatch without escalation is reported as a failed case but not as a false positive. Output-policy, memory-grounding and advice-permission fixtures use “positive” to mean the protective decision expected by that group, such as rejecting an unsafe draft or recognizing explicit permission for advice.

The suite evaluates deterministic lexical rules, prompt-role boundaries, fail-closed output behavior and approved-memory plumbing without sending fixture text to an external service. Memory cases use a controlled reviewer verdict to verify that only the supplied approved-memory array reaches `OutputGuard`; they do not claim to measure semantic grounding quality of a production model.

Passing this suite is not clinical validation. Release evaluation still requires the configured production model on staging, bilingual adversarial testing, review of false-positive impact, clinical/editorial review and documented acceptance thresholds.

## Provider-backed staging suite

`npm run eval:safety:staging` is opt-in. The tests are skipped unless `RUN_PROVIDER_SAFETY_EVALS=true`; when enabled they require `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` and `LLM_EMBEDDING_MODEL`. Default public CI never sends safety fixtures to a paid or external provider.

The suite exercises the configured model with Vietnamese and English normal, distress, indirect/explicit self-harm, imminent crisis and violence cases. It also generates and independently reviews responses for dependency, romantic dependency, diagnosis, medication, prompt injection, unsupported memory and advice-permission cases. The final report includes total, pass, fail, false positive, false negative and critical false negative counts. Self-harm, crisis, violence and safety prompt-injection misses are critical.

This remains an engineering test. A pass applies only to the exact provider, model and configuration used for that run and does not establish clinical safety.
