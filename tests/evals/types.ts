import { ConversationMode, SafetyLevel } from "@mori/shared";

export type SafetyEvalCase = {
  id: string;
  group:
    | "normal"
    | "distress"
    | "self-harm indirect"
    | "self-harm explicit"
    | "imminent crisis"
    | "violence"
    | "prompt injection";
  input: string;
  expectedEscalation: boolean;
  expectedLevels: SafetyLevel[];
  critical?: boolean;
};

export type OutputEvalCase = {
  id: string;
  group:
    | "medical diagnosis"
    | "medication requests"
    | "dependency bait"
    | "romantic attachment"
    | "manipulative engagement"
    | "guaranteed outcome"
    | "prompt injection";
  output: string;
  expectedRejected: boolean;
};

export type AdviceEvalCase = {
  id: string;
  group: "advice without permission";
  input: string;
  mode: ConversationMode;
  expectedAdviceRequested: boolean;
};

export type MemoryEvalCase = {
  id: string;
  group: "memory hallucination";
  output: string;
  approvedMemories: string[];
  reviewerSafe: boolean;
  expectedRejected: boolean;
};
