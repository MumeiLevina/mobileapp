import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { createSoftGoalSchema, updateSoftGoalSchema } from "@mori/shared";
import { UserId } from "../../common/auth.guard";
import { parse, uuid } from "../../common/validation";
import { SoftGoalsService } from "./soft-goals.service";

@Controller("soft-goals")
export class SoftGoalsController {
  constructor(private readonly goals: SoftGoalsService) {}

  @Get()
  list(@UserId() user: string) {
    return this.goals.list(user);
  }

  @Post()
  create(@UserId() user: string, @Body() body: unknown) {
    const value = parse(createSoftGoalSchema, body);
    return this.goals.create(user, {
      ...value,
      note: value.note ?? "",
      source_type: value.source_type ?? "manual",
      source_id: value.source_id ?? null,
    });
  }

  @Patch(":id")
  update(
    @UserId() user: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.goals.update(user, uuid(id), parse(updateSoftGoalSchema, body));
  }

  @Post(":id/complete")
  complete(@UserId() user: string, @Param("id") id: string) {
    return this.goals.complete(user, uuid(id));
  }

  @Post(":id/archive")
  archive(@UserId() user: string, @Param("id") id: string) {
    return this.goals.archive(user, uuid(id));
  }

  @Delete(":id")
  delete(@UserId() user: string, @Param("id") id: string) {
    return this.goals.delete(user, uuid(id));
  }
}
