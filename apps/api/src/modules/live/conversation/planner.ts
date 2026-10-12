/**
 * Conversation Planner
 *
 * Phase C — Conversation Planner
 *
 * Decides what Mori does with a viewer message:
 * - Answer directly
 * - Continue an existing topic
 * - Respond playfully
 * - Make a brief observation
 * - Ask a relevant follow-up
 * - Change topic
 * - Remain silent
 * - Defer to operator
 *
 * Design principles:
 * - Bounded state: fixed memory, no accumulation beyond limits
 * - Deterministic where possible: rules over heuristics for core decisions
 * - Not every reply needs a question
 * - Repetition prevention: track recent actions to avoid loops
 * - Topic continuity: maintain lightweight context across turns
 */

import { z } from "zod";

// ── Types ────────────────────────────────────────────────────────────────────

export const ConversationActionSchema = z.enum([
  "answer",
  "continue_topic",
  "playful_response",
  "brief_observation",
  "ask_followup",
  "change_topic",
  "silent_pass",
  "operator_escalate",
]);
export type ConversationAction = z.infer<typeof ConversationActionSchema>;

/** Turn metadata used by the planner to decide the next action */
export interface TurnMetadata {
  viewerText: string;
  isFirstTurn: boolean;
  turnsSinceLastQuestion: number;
  recentActions: ConversationAction[];
  recentTopics: string[];
  consecutiveQuestions: number;
  currentTopic: string | null;
  viewerName: string;
}

export const ConversationPlanSchema = z.object({
  action: ConversationActionSchema,
  followupTopic: z.union([z.string(), z.null()]).optional(),
  topicToContinue: z.union([z.string(), z.null()]).optional(),
  observation: z.union([z.string(), z.null()]).optional(),
  redirectMessage: z.union([z.string(), z.null()]).optional(),
  escalateReason: z.union([z.string(), z.null()]).optional(),
  skipGeneration: z.boolean().optional(),
  // Reasoning trace for debugging
  reasoning: z.union([z.string(), z.null()]).optional(),
});
export type ConversationPlan = z.infer<typeof ConversationPlanSchema>;

// ── Repetition Detection ────────────────────────────────────────────────────

const MAX_RECENT_ACTIONS = 6;
const MAX_CONSECUTIVE_SAME_ACTION = 2;
const MAX_CONSECUTIVE_QUESTIONS = 2;
const TOPIC_MEMORY_TURNS = 4;

interface RepetitionState {
  recentActions: ConversationAction[];
  recentTopics: string[];
  consecutiveQuestions: number;
}

export function createRepetitionState(): RepetitionState {
  return {
    recentActions: [],
    recentTopics: [],
    consecutiveQuestions: 0,
  };
}

export function updateRepetitionState(
  state: RepetitionState,
  action: ConversationAction,
  topic: string | null,
): RepetitionState {
  const recentActions = [...state.recentActions, action].slice(
    -MAX_RECENT_ACTIONS,
  );
  const recentTopics = topic
    ? [...state.recentTopics, topic].slice(-TOPIC_MEMORY_TURNS)
    : state.recentTopics;
  const consecutiveQuestions =
    action === "ask_followup" ? state.consecutiveQuestions + 1 : 0;

  return { recentActions, recentTopics, consecutiveQuestions };
}

export function isActionRepetitive(
  state: RepetitionState,
  action: ConversationAction,
): boolean {
  const recent = state.recentActions.slice(-MAX_CONSECUTIVE_SAME_ACTION);
  return (
    recent.length >= MAX_CONSECUTIVE_SAME_ACTION &&
    recent.every((a) => a === action)
  );
}

// ── Topic Extraction ─────────────────────────────────────────────────────────

const TOPIC_KEYWORDS: Record<string, string[]> = {
  weather: [
    "weather",
    "rain",
    "snow",
    "cold",
    "hot",
    "sun",
    "temperature",
    "trời",
    "nắng",
    "mưa",
    "lạnh",
    "nóng",
    "thời tiết",
  ],
  food: [
    "food",
    "cook",
    "recipe",
    "delicious",
    "meal",
    "ăn",
    "nấu",
    "món",
    "cơm",
    "phở",
    "bánh",
  ],
  music: [
    "music",
    "song",
    "listen",
    "artist",
    "band",
    "playlist",
    "nhạc",
    "hát",
    "bài hát",
  ],
  games: [
    "game",
    "play",
    "video game",
    "stream",
    "esports",
    "trò chơi",
    "chơi",
  ],
  work: [
    "work",
    "job",
    "office",
    "boss",
    "career",
    "interview",
    "làm",
    "việc",
    "công ty",
  ],
  school: [
    "school",
    "study",
    "exam",
    "university",
    "class",
    "học",
    "thi",
    "trường",
    "sinh viên",
  ],
  life: [
    "life",
    "future",
    "dream",
    "goal",
    "plan",
    "cuộc sống",
    "tương lai",
    "ước mơ",
    "mục tiêu",
  ],
  hobby: ["hobby", "interest", "passion", "free time", "sở thích", "rảnh"],
  pet: ["pet", "dog", "cat", "animal", "fish", "thú cưng", "chó", "mèo", "cún"],
  travel: [
    "travel",
    "trip",
    "vacation",
    "country",
    "city",
    "du lịch",
    "thành phố",
  ],
  tech: [
    "tech",
    "computer",
    "phone",
    "AI",
    "app",
    "code",
    "công nghệ",
    "điện thoại",
  ],
  anime: ["anime", "manga", "japan", "vtuber", "cosplay"],
  meme: ["meme", "funny", "lol", "joke", "hài", "cười"],
};

export function extractTopic(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    for (const kw of keywords) {
      const normalizedKeyword = kw.toLowerCase();
      // Short keywords (<=3): require word boundary to avoid "ai" in "mori" matching tech's "ai"
      // and "ph" in "phở" matching tech's "phone+s"
      if (normalizedKeyword.length <= 3) {
        const pattern = String.raw`(?:^|[^\p{L}\p{N}_])${normalizedKeyword}(?=$|[^\p{L}\p{N}_])`;
        if (new RegExp(pattern, "u").test(lower)) return topic;
      } else {
        if (lower.includes(normalizedKeyword)) return topic;
      }
      // Handle common plural forms with word boundary to avoid "ph" → "phones"
      if (!normalizedKeyword.endsWith("s") && normalizedKeyword.length > 3) {
        const plural = normalizedKeyword + "s";
        if (lower.includes(plural)) return topic;
        // -y → -ies: hobby → hobbies
        if (
          normalizedKeyword.endsWith("y") &&
          lower.includes(normalizedKeyword.slice(0, -1) + "ies")
        ) {
          return topic;
        }
      }
    }
  }
  return null;
}

// ── Input Classification ────────────────────────────────────────────────────

export const MessageCategorySchema = z.enum([
  "greeting",
  "question",
  "statement",
  "complaint",
  "praise",
  "spam",
  "personal_share",
  "topic_change",
  "unclear",
]);
export type MessageCategory = z.infer<typeof MessageCategorySchema>;

export function classifyMessage(text: string): MessageCategory {
  const lower = text.toLowerCase().trim();

  // Greetings FIRST — check before spam to avoid "Hello!" being marked as spam
  if (
    /^(xin chào|chào|hi|hello|hey|yo|ôi|helo|hola|hi there|hey there)(?:$|[\s,!?.])/i.test(
      lower,
    )
  ) {
    return "greeting";
  }

  // Spam detection: very short repetitive messages
  const words = lower.split(/\s+/);
  if (
    words.length >= 2 &&
    words.length <= 4 &&
    words.every((w) => w === words[0])
  ) {
    return "spam";
  }

  // Praise — check before question to catch "X is great!" as praise
  if (
    /(\bamazing|\bawesome|\bbest|\bcool|\blove you|\byêu|\btuyệt|vời|great job|good job|giỏi)/i.test(
      lower,
    ) &&
    lower.length < 200
  ) {
    return "praise";
  }

  // Questions — only literal "?" to avoid misclassifying "Mori Mori Mori" as a question
  if (lower.includes("?")) {
    return "question";
  }

  // Complaints
  if (
    /(\bsad|\bupset|\bangry|\bfrustrated|bad|terrible|hate|không thích|buồn|chán|失望|讨厌)/i.test(
      lower,
    ) &&
    !lower.includes("?")
  ) {
    return "complaint";
  }

  // Personal share (longer messages without questions)
  if (lower.length > 80 && !lower.includes("?")) {
    return "personal_share";
  }

  // Topic change
  if (
    /(btw|nhân tiện|anyway|bằng cách|mà|nói qua|vậy|by the way)/i.test(lower)
  ) {
    return "topic_change";
  }

  return "statement";
}

// ── Core Planner ─────────────────────────────────────────────────────────────

export interface PlannerConfig {
  maxConsecutiveQuestions: number;
  maxConsecutiveSameAction: number;
  allowSilentPass: boolean;
  operatorEscalateTopics: string[];
}

export const DEFAULT_PLANNER_CONFIG: PlannerConfig = {
  maxConsecutiveQuestions: MAX_CONSECUTIVE_QUESTIONS,
  maxConsecutiveSameAction: MAX_CONSECUTIVE_SAME_ACTION,
  allowSilentPass: false,
  operatorEscalateTopics: [
    "self-harm",
    "suicide",
    " minors",
    "underage",
    " violence",
    "bạo lực",
    "tự hại",
    "trẻ em",
  ],
};

export function planConversation(
  metadata: TurnMetadata,
  config: PlannerConfig = DEFAULT_PLANNER_CONFIG,
): ConversationPlan {
  const category = classifyMessage(metadata.viewerText);
  const topic = extractTopic(metadata.viewerText);
  const { recentActions, recentTopics, consecutiveQuestions } = metadata;

  // Escalation check first
  const needsEscalation = config.operatorEscalateTopics.some((t) =>
    metadata.viewerText.toLowerCase().includes(t.toLowerCase()),
  );
  if (needsEscalation) {
    return {
      action: "operator_escalate",
      escalateReason: "Sensitive content requiring operator",
      skipGeneration: true,
      reasoning: `Category=${category}, topic=${topic}`,
    };
  }

  // Spam: brief playful acknowledgment
  if (category === "spam") {
    return {
      action: "playful_response",
      skipGeneration: false,
      reasoning: `Spam detected: short=${metadata.viewerText.length}, words=${metadata.viewerText.split(/\s+/).length}`,
    };
  }

  // First turn: greet
  if (metadata.isFirstTurn || category === "greeting") {
    const recentGreets = recentActions.filter(
      (a) => a === "answer" || a === "playful_response",
    ).length;
    if (recentGreets < 2) {
      return {
        action: "playful_response",
        reasoning: "First turn or greeting",
      };
    }
  }

  // Check consecutive questions limit
  if (
    category === "question" &&
    consecutiveQuestions >= config.maxConsecutiveQuestions
  ) {
    return {
      action: "answer",
      reasoning: "Question but at question limit — answer directly instead",
    };
  }

  // Check repetitive action
  if (
    isActionRepetitive(
      { recentActions, recentTopics, consecutiveQuestions },
      "ask_followup",
    )
  ) {
    return {
      action: "answer",
      reasoning: "Preventing question spam",
    };
  }

  // Topic continuation: if viewer is talking about the same topic
  if (
    topic &&
    recentTopics.length > 0 &&
    recentTopics[recentTopics.length - 1] === topic
  ) {
    if (
      !isActionRepetitive(
        { recentActions, recentTopics, consecutiveQuestions },
        "continue_topic",
      )
    ) {
      return {
        action: "continue_topic",
        topicToContinue: topic,
        reasoning: `Topic continuation: ${topic}`,
      };
    }
  }

  // Handle by category
  switch (category) {
    case "question":
      // Most questions get answered directly
      if (
        !isActionRepetitive(
          { recentActions, recentTopics, consecutiveQuestions },
          "answer",
        )
      ) {
        return {
          action: "answer",
          reasoning: "Direct answer to question",
        };
      }
      // If too many answers in a row, add a twist
      return {
        action: "brief_observation",
        observation: "Nhân tiện, có gì khác bạn muốn hỏi không?",
        reasoning: "Question + avoiding repetitive answer",
      };

    case "statement":
      // Statements get acknowledged with possible follow-up
      if (
        metadata.turnsSinceLastQuestion >= 2 &&
        !isActionRepetitive(
          { recentActions, recentTopics, consecutiveQuestions },
          "ask_followup",
        )
      ) {
        return {
          action: "ask_followup",
          followupTopic: topic,
          reasoning: "Statement with contextual follow-up",
        };
      }
      if (
        !isActionRepetitive(
          { recentActions, recentTopics, consecutiveQuestions },
          "brief_observation",
        )
      ) {
        return {
          action: "brief_observation",
          reasoning: "Statement acknowledged with observation",
        };
      }
      return {
        action: "continue_topic",
        topicToContinue: topic,
        reasoning: "Statement + topic continuation",
      };

    case "personal_share":
      // Longer personal shares get thoughtful acknowledgment
      if (
        !isActionRepetitive(
          { recentActions, recentTopics, consecutiveQuestions },
          "brief_observation",
        )
      ) {
        return {
          action: "brief_observation",
          reasoning: "Thoughtful response to personal share",
        };
      }
      return {
        action: "continue_topic",
        topicToContinue: topic ?? null,
        reasoning: "Personal share continued",
      };

    case "complaint":
      // Complaints get empathy + brief observation
      if (
        !isActionRepetitive(
          { recentActions, recentTopics, consecutiveQuestions },
          "brief_observation",
        )
      ) {
        return {
          action: "brief_observation",
          reasoning: "Empathetic observation for complaint",
        };
      }
      return {
        action: "answer",
        reasoning: "Complaint answered directly",
      };

    case "praise":
      // Praise gets brief, not over-the-top acknowledgment
      return {
        action: "playful_response",
        reasoning: "Brief playful response to praise",
      };

    case "topic_change":
      // Explicit topic changes get acknowledged
      return {
        action: "answer",
        reasoning: "Acknowledge topic change",
      };

    case "unclear":
      // Unclear messages get a confused response
      return {
        action: "brief_observation",
        observation:
          topic === null
            ? "Hmm, mình không chắc mình hiểu ý bạn. Bạn có thể nói rõ hơn không?"
            : null,
        reasoning: "Unclear message",
      };

    default:
      return {
        action: "answer",
        reasoning: `Default: ${category}`,
      };
  }
}

// ── Topic Memory ─────────────────────────────────────────────────────────────

export interface TopicMemory {
  currentTopic: string | null;
  topicHistory: string[];
  turnsOnTopic: number;
}

export function createTopicMemory(): TopicMemory {
  return {
    currentTopic: null,
    topicHistory: [],
    turnsOnTopic: 0,
  };
}

export function updateTopicMemory(
  memory: TopicMemory,
  plan: ConversationPlan,
  detectedTopic: string | null,
): TopicMemory {
  let currentTopic = memory.currentTopic;
  let turnsOnTopic = memory.turnsOnTopic;
  let topicHistory = memory.topicHistory;

  if (
    detectedTopic &&
    plan.action !== "silent_pass" &&
    plan.action !== "operator_escalate"
  ) {
    if (detectedTopic === currentTopic) {
      turnsOnTopic += 1;
    } else {
      currentTopic = detectedTopic;
      turnsOnTopic = 1;
      topicHistory = [...topicHistory, detectedTopic].slice(
        -TOPIC_MEMORY_TURNS,
      );
    }
  } else if (plan.action === "change_topic") {
    currentTopic = null;
    turnsOnTopic = 0;
  }

  return { currentTopic, topicHistory, turnsOnTopic };
}
