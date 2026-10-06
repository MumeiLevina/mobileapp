import { Body, Controller, Get, Post } from "@nestjs/common";
import { Mood, moodSchema } from "@mori/shared";
import { DatabaseService } from "../../database/database.service";
import { UserId } from "../../common/auth.guard";
import { parse } from "../../common/validation";
import { GardenService } from "../garden/garden.service";
@Controller("moods")
export class MoodsController {
  constructor(
    private readonly db: DatabaseService,
    private readonly garden: GardenService,
  ) {}
  @Get() list(@UserId() user: string) {
    return this.db.list<Mood>("mood_entries", user);
  }
  @Post() async create(@UserId() user: string, @Body() body: unknown) {
    const value = parse(moodSchema, body);
    const existing = await this.db.list<Mood>("mood_entries", user, {
      equals: { client_id: value.client_id },
    });
    const mood =
      existing[0] ?? (await this.db.insert<Mood>("mood_entries", user, value));
    await this.garden.award(user, `mood:${mood.id}`);
    return mood;
  }
}
