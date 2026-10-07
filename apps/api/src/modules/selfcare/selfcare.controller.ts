import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  ServiceUnavailableException,
} from "@nestjs/common";
import { z } from "zod";
import { Activity } from "@mori/shared";
import { DatabaseService } from "../../database/database.service";
import { UserId } from "../../common/auth.guard";
import { parse } from "../../common/validation";
import { GardenService } from "../garden/garden.service";
@Controller("self-care")
export class SelfCareController {
  constructor(
    private readonly db: DatabaseService,
    private readonly garden: GardenService,
  ) {}
  @Get() async list() {
    const { data, error } = await this.db.admin
      .from("self_care_activities")
      .select("*")
      .eq("enabled", true);
    if (error) throw new ServiceUnavailableException();
    return data as Activity[];
  }
  @Post(":id/start") async start(
    @UserId() user: string,
    @Param("id") id: string,
  ) {
    if (!(await this.list()).some((a) => a.id === id))
      throw new BadRequestException();
    return this.db.insert("self_care_sessions", user, { activity_id: id });
  }
  @Post(":id/complete") async complete(
    @UserId() user: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const { session_id } = parse(
      z.object({ session_id: z.string().uuid() }),
      body,
    );
    const session = await this.db.one<{
      id: string;
      activity_id: string;
      completed_at: string | null;
    }>("self_care_sessions", user, session_id);
    if (session.activity_id !== id) throw new BadRequestException();
    if (!session.completed_at)
      await this.db.update("self_care_sessions", user, session_id, {
        completed_at: new Date().toISOString(),
      });
    await this.garden.award(user, `selfcare:${session_id}`);
    if (id === "breathing")
      await this.garden.unlock(user, "wind_chimes", "self_care", session_id);
    return { ok: true };
  }
}
