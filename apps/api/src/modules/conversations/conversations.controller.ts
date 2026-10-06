import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { ConversationMode, messageSchema } from "@mori/shared";
import { z } from "zod";
import { Throttle } from "@nestjs/throttler";
import { DatabaseService } from "../../database/database.service";
import { UserId } from "../../common/auth.guard";
import { parse, uuid } from "../../common/validation";
import { AIOrchestratorService } from "../ai/orchestrator.service";
@Controller("conversations")
export class ConversationsController {
  constructor(
    private readonly db: DatabaseService,
    private readonly ai: AIOrchestratorService,
  ) {}
  @Get() list(@UserId() user: string) {
    return this.db.list("conversations", user, { active: true });
  }
  @Post() create(@UserId() user: string, @Body() body: unknown) {
    return this.db.insert(
      "conversations",
      user,
      parse(z.object({ mode: ConversationMode.default("listen") }), body),
    );
  }
  @Get(":id") async detail(@UserId() user: string, @Param("id") id: string) {
    const conversation = await this.db.one(
      "conversations",
      user,
      uuid(id),
      true,
    );
    return {
      conversation,
      messages: (
        await this.db.list("messages", user, {
          equals: { conversation_id: id },
          limit: 200,
        })
      ).reverse(),
    };
  }
  @Post(":id/messages") @Throttle({ default: { limit: 12, ttl: 60000 } }) send(
    @UserId() user: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const value = parse(messageSchema, body);
    return this.ai.processUserMessage(
      user,
      uuid(id),
      value.content,
      value.mode,
      value.client_id,
    );
  }
  @Post(":id/journal-draft")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  draft(@UserId() user: string, @Param("id") id: string) {
    return this.ai.journalDraft(user, uuid(id));
  }
  @Delete(":id") delete(@UserId() user: string, @Param("id") id: string) {
    return this.db.remove("conversations", user, uuid(id));
  }
  @Delete() deleteAll(@UserId() user: string) {
    return this.db.remove("conversations", user);
  }
}
