/**
 * Persona Engine — Public Export
 *
 * Phase B — Persona Engine
 */

export {
  PERSONA_REGISTRY,
  PERSONA_SCHEMA,
  getPersona,
  type PersonaDefinition,
  type PersonaVersion,
  type PersonalityTrait,
  type CharacterVoice,
  type CharacterBoundaries,
  type ExampleDialogue,
  type EmotionTrait,
  type SpeakingStyle,
} from "./persona.definitions";

export {
  buildSystemPrompt,
  buildTurnPrompt,
  buildEmotionPrompt,
  buildVietnameseSystemPrompt,
} from "./prompt.builder";
