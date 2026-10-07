import { DatabaseService } from "../apps/api/src/database/database.service";
import { AIOrchestratorService } from "../apps/api/src/modules/ai/orchestrator.service";
import { PrivateConversationsController } from "../apps/api/src/modules/conversations/private-conversations.controller";

const userMessage = {
  id: "11111111-1111-4111-a111-111111111111",
  role: "user" as const,
  content: "Một điều riêng tư",
};
const assistantMessage = {
  id: "22222222-2222-4222-a222-222222222222",
  role: "assistant" as const,
  content: "Mình đang lắng nghe.",
};

test("private send delegates ephemeral history without creating database rows", async () => {
  const db = { insert: jest.fn() } as unknown as DatabaseService;
  const ai = {
    processPrivateMessage: jest.fn().mockResolvedValue({
      message: assistantMessage,
      safetyLevel: "normal",
    }),
  } as unknown as AIOrchestratorService;
  const controller = new PrivateConversationsController(db, ai);

  await controller.send("owner", {
    content: "Một điều riêng tư",
    mode: "listen",
    client_id: assistantMessage.id,
    history: [userMessage],
  });

  expect(ai.processPrivateMessage).toHaveBeenCalledWith(
    "owner",
    "Một điều riêng tư",
    "listen",
    assistantMessage.id,
    [userMessage],
  );
  expect(db.insert).not.toHaveBeenCalled();
});

test("explicit save converts the session into owner-scoped normal records", async () => {
  const conversation = {
    id: "33333333-3333-4333-a333-333333333333",
    user_id: "owner",
    title: "Một cuộc trò chuyện riêng đã lưu",
    mode: "listen",
    created_at: new Date().toISOString(),
  };
  const db = {
    insert: jest
      .fn()
      .mockResolvedValueOnce(conversation)
      .mockResolvedValueOnce(userMessage)
      .mockResolvedValueOnce(assistantMessage),
  } as unknown as DatabaseService;
  const controller = new PrivateConversationsController(
    db,
    {} as AIOrchestratorService,
  );

  await controller.save("owner", {
    mode: "listen",
    messages: [userMessage, assistantMessage],
  });

  expect(db.insert).toHaveBeenNthCalledWith(1, "conversations", "owner", {
    mode: "listen",
    title: "Một cuộc trò chuyện riêng đã lưu",
  });
  expect(db.insert).toHaveBeenNthCalledWith(
    2,
    "messages",
    "owner",
    expect.objectContaining({
      conversation_id: conversation.id,
      role: "user",
      content: userMessage.content,
    }),
  );
  expect(db.insert).toHaveBeenNthCalledWith(
    3,
    "messages",
    "owner",
    expect.objectContaining({
      conversation_id: conversation.id,
      role: "assistant",
      content: assistantMessage.content,
    }),
  );
});
