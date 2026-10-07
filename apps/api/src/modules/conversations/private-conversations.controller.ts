import { Body, Controller, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  Conversation,
  Message,
  privateMessageSchema,
  savePrivateConversationSchema,
} from "@mori/shared";
import { UserId } from "../../common/auth.guard";
import { parse } from "../../common/validation";
import { DatabaseService } from "../../database/database.service";
import { AIOrchestratorService } from "../ai/orchestrator.service";

@Controller("private-conversations")
export class PrivateConversationsController {
  constructor(
    private readonly db: DatabaseService,
    private readonly ai: AIOrchestratorService,
  ) {}

  @Post("messages")
  @Throttle({ default: { limit: 12, ttl: 60000 } })
  send(@UserId() user: string, @Body() body: unknown) {
    const value = parse(privateMessageSchema, body);
    return this.ai.processPrivateMessage(
      user,
      value.content,
      value.mode,
      value.client_id,
      value.history ?? [],
    );
  }

  @Post("save")
  async save(@UserId() user: string, @Body() body: unknown) {
    const value = parse(savePrivateConversationSchema, body);
    const conversation = await this.db.insert<Conversation>(
      "conversations",
      user,
      {
        mode: value.mode,
        title: "Một cuộc trò chuyện riêng đã lưu",
      },
    );
    for (const message of value.messages) {
      await this.db.insert<Message>("messages", user, {
        conversation_id: conversation.id,
        role: message.role,
        content: message.content,
        client_id: message.id,
        safety_level: "normal",
      });
    }
    return conversation;
  }
}
