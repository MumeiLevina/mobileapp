/**
 * Conversation Planner Tests
 *
 * Phase C — Conversation Planner
 */

import {
  ConversationActionSchema,
  ConversationPlanSchema,
  createRepetitionState,
  updateRepetitionState,
  isActionRepetitive,
  extractTopic,
  classifyMessage,
  planConversation,
  createTopicMemory,
  updateTopicMemory,
  type TurnMetadata,
} from "../apps/api/src/modules/live/conversation/planner";

describe("ConversationActionSchema", () => {
  it("should accept all valid actions", () => {
    const actions = [
      "answer",
      "continue_topic",
      "playful_response",
      "brief_observation",
      "ask_followup",
      "change_topic",
      "silent_pass",
      "operator_escalate",
    ];
    for (const action of actions) {
      const result = ConversationActionSchema.safeParse(action);
      expect(result.success).toBe(true);
    }
  });

  it("should reject invalid actions", () => {
    const result = ConversationActionSchema.safeParse("invalid_action");
    expect(result.success).toBe(false);
  });
});

describe("ConversationPlanSchema", () => {
  it("should accept a complete plan", () => {
    const plan = {
      action: "answer",
      followupTopic: "weather",
      reasoning: "test",
    };
    const result = ConversationPlanSchema.safeParse(plan);
    expect(result.success).toBe(true);
  });

  it("should accept a minimal plan", () => {
    const plan = { action: "silent_pass" };
    const result = ConversationPlanSchema.safeParse(plan);
    expect(result.success).toBe(true);
  });
});

describe("Repetition State", () => {
  it("should initialize with empty state", () => {
    const state = createRepetitionState();
    expect(state.recentActions).toHaveLength(0);
    expect(state.recentTopics).toHaveLength(0);
    expect(state.consecutiveQuestions).toBe(0);
  });

  it("should update with new action", () => {
    let state = createRepetitionState();
    state = updateRepetitionState(state, "answer", "weather");
    expect(state.recentActions).toContain("answer");
    expect(state.recentTopics).toContain("weather");
    expect(state.consecutiveQuestions).toBe(0);
  });

  it("should count consecutive questions", () => {
    let state = createRepetitionState();
    state = updateRepetitionState(state, "ask_followup", null);
    expect(state.consecutiveQuestions).toBe(1);
    state = updateRepetitionState(state, "ask_followup", null);
    expect(state.consecutiveQuestions).toBe(2);
    state = updateRepetitionState(state, "answer", null);
    expect(state.consecutiveQuestions).toBe(0);
  });

  it("should cap recent actions at limit", () => {
    let state = createRepetitionState();
    for (let i = 0; i < 10; i++) {
      state = updateRepetitionState(state, "answer", null);
    }
    expect(state.recentActions.length).toBeLessThanOrEqual(6);
  });

  it("should detect repetitive action", () => {
    let state = createRepetitionState();
    state = updateRepetitionState(state, "ask_followup", null);
    // With limit=2, one ask_followup is not yet repetitive
    expect(isActionRepetitive(state, "ask_followup")).toBe(false);
    state = updateRepetitionState(state, "ask_followup", null);
    // Two consecutive ask_followups: now repetitive (length >= 2)
    expect(isActionRepetitive(state, "ask_followup")).toBe(true);
  });

  it("should not flag different actions as repetitive", () => {
    let state = createRepetitionState();
    state = updateRepetitionState(state, "ask_followup", null);
    state = updateRepetitionState(state, "answer", null);
    state = updateRepetitionState(state, "ask_followup", null);
    expect(isActionRepetitive(state, "ask_followup")).toBe(false);
  });
});

describe("extractTopic", () => {
  it("should extract weather topic", () => {
    expect(extractTopic("Trời hôm nay nóng quá")).toBe("weather");
    expect(extractTopic("It is raining outside")).toBe("weather");
  });

  it("should extract food topic", () => {
    expect(extractTopic("Tôi thích ăn phở")).toBe("food");
    expect(extractTopic("What should I cook for dinner?")).toBe("food");
  });

  it("should extract music topic", () => {
    expect(extractTopic("I'm listening to some great music")).toBe("music");
    expect(extractTopic("Bạn có thích nghe nhạc không?")).toBe("music");
  });

  it("should extract hobby topic", () => {
    expect(extractTopic("What are your hobbies?")).toBe("hobby");
    expect(extractTopic("Sở thích của bạn là gì?")).toBe("hobby");
  });

  it("should return null for unknown topics", () => {
    expect(extractTopic("Hello Mori")).toBeNull();
    expect(extractTopic("asdfghjkl")).toBeNull();
  });
});

describe("classifyMessage", () => {
  it("should classify greetings", () => {
    expect(classifyMessage("Xin chào Mori!")).toBe("greeting");
    expect(classifyMessage("Hello!")).toBe("greeting");
    expect(classifyMessage("Chào bạn")).toBe("greeting");
  });

  it("should classify questions", () => {
    expect(classifyMessage("Bạn ơi, bạn là gì?")).toBe("question");
    expect(classifyMessage("How are you?")).toBe("question");
    expect(classifyMessage("Mori có thích chơi game không?")).toBe("question");
  });

  it("should classify spam", () => {
    expect(classifyMessage("Mori Mori Mori")).toBe("spam");
    expect(classifyMessage("lol lol")).toBe("spam");
  });

  it("should classify praise", () => {
    expect(classifyMessage("Mori tuyệt vời quá!")).toBe("praise");
    expect(classifyMessage("You are amazing!")).toBe("praise");
  });

  it("should classify personal shares", () => {
    expect(
      classifyMessage(
        "Hôm nay tôi đi làm và gặp rất nhiều khó khăn. Tôi phải đối mặt với rất nhiều thử thách và cảm thấy mệt mỏi. Nhưng tôi vẫn cố gắng.",
      ),
    ).toBe("personal_share");
  });

  it("should classify complaints", () => {
    expect(classifyMessage("Tôi cảm thấy buồn và thất vọng")).toBe("complaint");
    expect(classifyMessage("This is so bad")).toBe("complaint");
  });

  it("should classify statements as default", () => {
    expect(classifyMessage("Trời hôm nay đẹp")).toBe("statement");
    expect(classifyMessage("I like your stream")).toBe("statement");
  });
});

describe("planConversation", () => {
  const makeMetadata = (
    overrides: Partial<TurnMetadata> = {},
  ): TurnMetadata => ({
    viewerText: "Xin chào!",
    isFirstTurn: false,
    turnsSinceLastQuestion: 0,
    recentActions: [],
    recentTopics: [],
    consecutiveQuestions: 0,
    currentTopic: null,
    viewerName: "viewer1",
    ...overrides,
  });

  it("should escalate sensitive content", () => {
    const metadata = makeMetadata({
      viewerText: "Tôi muốn tự hại bản thân",
    });
    const plan = planConversation(metadata);
    expect(plan.action).toBe("operator_escalate");
    expect(plan.skipGeneration).toBe(true);
  });

  it("should handle spam playfully", () => {
    const metadata = makeMetadata({
      viewerText: "Mori Mori Mori Mori",
    });
    const plan = planConversation(metadata);
    expect(plan.action).toBe("playful_response");
  });

  it("should answer questions directly", () => {
    const metadata = makeMetadata({
      viewerText: "Bạn thích thời tiết nào nhất?",
      consecutiveQuestions: 0,
    });
    const plan = planConversation(metadata);
    expect(plan.action).toBe("answer");
  });

  it("should give observations to personal shares", () => {
    const metadata = makeMetadata({
      viewerText:
        "Hôm nay tôi đi làm và gặp rất nhiều khó khăn. Tôi phải đối mặt với rất nhiều thử thách và cảm thấy mệt mỏi.",
      recentActions: ["answer"],
      consecutiveQuestions: 0,
    });
    const plan = planConversation(metadata);
    expect(["brief_observation", "answer"]).toContain(plan.action);
  });

  it("should prevent too many consecutive questions", () => {
    const metadata = makeMetadata({
      viewerText: "Câu hỏi 1?",
      consecutiveQuestions: 2,
      recentActions: ["ask_followup", "ask_followup"],
    });
    const plan = planConversation(metadata);
    expect(plan.action).toBe("answer");
  });

  it("should gracefully handle first turn", () => {
    const metadata = makeMetadata({
      viewerText: "Xin chào Mori!",
      isFirstTurn: true,
    });
    const plan = planConversation(metadata);
    expect(["playful_response", "answer"]).toContain(plan.action);
  });

  it("should respond to praise briefly", () => {
    const metadata = makeMetadata({
      viewerText: "Mori bạn tuyệt vời quá đi!",
      recentActions: ["answer"],
    });
    const plan = planConversation(metadata);
    expect(plan.action).toBe("playful_response");
  });

  it("should continue same topic", () => {
    const metadata = makeMetadata({
      viewerText: "Nói về thời tiết đi!",
      recentTopics: ["weather"],
      recentActions: ["answer"],
      turnsSinceLastQuestion: 1,
      consecutiveQuestions: 0,
    });
    const plan = planConversation(metadata);
    expect(plan.action).toBe("continue_topic");
    expect(plan.topicToContinue).toBe("weather");
  });

  it("should include reasoning in plan", () => {
    const metadata = makeMetadata({
      viewerText: "Bạn ơi bạn thích gì?",
    });
    const plan = planConversation(metadata);
    expect(plan.reasoning).toBeTruthy();
  });
});

describe("Topic Memory", () => {
  it("should initialize with null topic", () => {
    const memory = createTopicMemory();
    expect(memory.currentTopic).toBeNull();
    expect(memory.turnsOnTopic).toBe(0);
  });

  it("should track topic changes", () => {
    let memory = createTopicMemory();
    memory = updateTopicMemory(memory, { action: "answer" }, "food");
    expect(memory.currentTopic).toBe("food");
    expect(memory.turnsOnTopic).toBe(1);

    memory = updateTopicMemory(memory, { action: "answer" }, "food");
    expect(memory.turnsOnTopic).toBe(2);

    memory = updateTopicMemory(memory, { action: "answer" }, "music");
    expect(memory.currentTopic).toBe("music");
    expect(memory.turnsOnTopic).toBe(1);
    expect(memory.topicHistory).toContain("food");
    expect(memory.topicHistory).toContain("music");
  });

  it("should reset topic on change_topic action", () => {
    let memory = createTopicMemory();
    memory = updateTopicMemory(memory, { action: "answer" }, "food");
    expect(memory.currentTopic).toBe("food");
    memory = updateTopicMemory(memory, { action: "change_topic" }, null);
    expect(memory.currentTopic).toBeNull();
    expect(memory.turnsOnTopic).toBe(0);
  });

  it("should cap topic history", () => {
    let memory = createTopicMemory();
    const topics = ["food", "music", "weather", "games", "travel"];
    for (const topic of topics) {
      memory = updateTopicMemory(memory, { action: "answer" }, topic);
    }
    // After 5 different topics, slice(-4) keeps last 4: [music, weather, games, travel]
    expect(memory.topicHistory.length).toBeLessThanOrEqual(4);
    expect(memory.topicHistory).toEqual([
      "music",
      "weather",
      "games",
      "travel",
    ]);
  });
});
