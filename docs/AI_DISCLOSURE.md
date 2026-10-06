# AI disclosure

Mori is an artificial-intelligence system. It is not a human, friend, therapist, doctor or emergency service. It can misunderstand context, produce incorrect information and respond in ways that do not fit the user's situation.

Mori does not diagnose mental-health conditions and must not recommend starting, stopping or changing medication or dosage. It cannot monitor a user's safety or contact emergency services. A person who may act on thoughts of harming themselves or someone else should contact local emergency services, an appropriate crisis service or a trusted person who can be physically present.

The service can send conversation text, a bounded recent message window and explicitly approved memories to the configured AI provider. Safety classification and output review reduce known risks but cannot guarantee safe or correct responses. Engineering evaluations are regression tests and are not clinical validation.

Ask Mori can send a question and at most 12 relevant excerpts from the user's approved memories, active journals, moods, conversation titles, completed self-care history and weekly reflections. It does not send the full history, unapproved memories, deleted content, another user's data or internal safety metadata. Answers include references to the source records and describe associations as observations rather than causes.

Memories are optional. Mori may use only active memories the user explicitly approved. Users can review, edit or delete them from the privacy center. A response can still make a mistake; users should not rely on Mori as the sole source of important medical, legal, financial or safety decisions.

The Memory screen shows why a memory exists, its source category and when the user approved it. Conversation-derived candidates remain pending and excluded from retrieval until explicit approval.

Life Patterns is deterministic and does not call the LLM. It requires at least five relevant records for each observation, returns an explicit non-causation and non-diagnosis notice, and returns an honest empty state when the threshold is not met.

This disclosure must appear in onboarding and the published support/privacy material in language appropriate to the target audience. The selected provider/model and relevant subprocessor information must be filled in before release.
