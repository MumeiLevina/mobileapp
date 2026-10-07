import { Body, Controller, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  Conversation,
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
  save(@UserId() user: string, @Body() body: unknown) {
    const value = parse(savePrivateConversationSchema, body);
    return this.db.rpc<Conversation>("save_private_conversation", {
      p_user: user,
      p_client_id: value.client_id,
      p_mode: value.mode,
      p_messages: value.messages,
    });
  }
}
