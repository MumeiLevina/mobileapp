import { Body, Controller, Get, Post } from "@nestjs/common";
import { RitualEntry, ritualEntrySchema } from "@mori/shared";
import { UserId } from "../../common/auth.guard";
import { parse } from "../../common/validation";
import { DatabaseService } from "../../database/database.service";
import { GardenService } from "../garden/garden.service";

@Controller("rituals")
export class RitualsController {
  constructor(
    private readonly db: DatabaseService,
    private readonly garden: GardenService,
  ) {}

  @Get()
  list(@UserId() user: string) {
    return this.db.list<RitualEntry>("ritual_entries", user, { limit: 100 });
  }

  @Post()
  async create(@UserId() user: string, @Body() body: unknown) {
    const value = parse(ritualEntrySchema, body);
    const existing = await this.db.list<RitualEntry>("ritual_entries", user, {
      equals: { client_id: value.client_id },
      limit: 1,
    });
    const entry =
      existing[0] ??
      (await this.db.insert<RitualEntry>("ritual_entries", user, value));
    await this.garden.award(user, `ritual:${entry.id}`);
    return entry;
  }
}
