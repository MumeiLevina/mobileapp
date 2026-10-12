# AIRI-inspired integration assessment for Mori

Upstream reference: https://github.com/moeru-ai/airi (main, assessed 2026-10-12).

## Current Mori architecture

- `apps/api/src/modules/live/live.pipeline.ts`: bounded, safety-reviewed public LLM generation.
- `apps/api/src/modules/live/persona/`: versioned Vietnamese/English character prompts.
- `apps/api/src/modules/live/conversation/planner.ts`: deterministic topic/repetition decisions, currently **not connected** to the public generation service.
- `apps/live-desktop/python/mori_live/voice.py`: single utterance Azure Vietnamese TTS or mock WAV and playback acknowledgement.
- `apps/live-desktop/python/mori_live/director.py`: bounded YouTube queue, one active turn, no spontaneous speech.
- `packages/live-protocol/`: strict public live request/response envelopes, existing emotion/animation fields.

## Upstream observations

- AIRI `packages/pipelines-audio/src/speech-pipeline.ts` segments streamed text, allows bounded concurrent TTS, schedules playback in order and supports interruption/cancellation.
- AIRI `packages/memory-pgvector/src/index.ts` currently shows an SDK module skeleton; do not treat this file as a production-ready long-term memory implementation.
- AIRI has model/animation driver packages and runtime/stage modules, but they should not be copied wholesale into Mori's separate Node/Python architecture.

## Phase 1 — implemented in this integration

- Wire Mori's existing versioned persona and bounded public conversation history into the live LLM generation path.
- Preserve the safety classifier, output guard, operator limits, public/private isolation, budget, and existing strict public protocol.
- Keep topic memory and proactive speech disabled until carefully scoped and independently tested.

## Phase 2 — proposal, **not implemented**

- Streaming speech: design additive, versioned protocol events `voice.segment.*`, `voice.cancel` and playback acknowledgements. Maintain the current full-utterance fallback.
- Ensure final output safety before speech is released; do not read unreviewed provider tokens aloud.
- Bounded sentence segmentation, small bounded synthesis concurrency, ordered playback, stale-turn rejection, abort and cleanup.
- Track time-to-first-approved-audio, speech duration, interruption recovery and cost using non-sensitive aggregate telemetry.
- Keep desktop voice model and Live2D renderer unchanged until standalone validation.

## Phase 3 — proposal, **not implemented**

- Keep public memory opt-in, scoped to public events, with TTL, retention bounds, moderation, deletion, pseudonymous identifiers and consent.
- Do not access mobile journals, Supabase private profiles, private memories or private auth.
- Wire the existing conversation planner by an explicit opt-in feature flag, after testing skipped turns and safety escalation paths.
- Evaluate expressiveness, non-repetition, Vietnamese quality, emotional consistency and latency with reproducible tests.

## Constraints

No direct AIRI source code is copied; this phase is inspired by upstream architecture only. Before reusing upstream code/assets, review their exact licenses and dependency compatibility. Do not touch `main`, `develop/mobile`, mobile UI, Supabase, credentials or release configuration.
