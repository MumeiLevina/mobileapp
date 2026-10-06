import { Body, Controller, Get, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { askMoriSchema } from "@mori/shared";
import { UserId } from "../../common/auth.guard";
import { parse } from "../../common/validation";
import { AskMoriService } from "./ask-mori.service";
import { LifePatternsService } from "./life-patterns.service";

@Controller("insights")
export class InsightsController {
  constructor(
    private readonly askMori: AskMoriService,
    private readonly patterns: LifePatternsService,
  ) {}

  @Post("ask")
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  ask(@UserId() user: string, @Body() body: unknown) {
    const value = parse(askMoriSchema, body);
    return this.askMori.ask(user, value.question);
  }

  @Get("patterns")
  listPatterns(@UserId() user: string) {
    return this.patterns.list(user);
  }
}
