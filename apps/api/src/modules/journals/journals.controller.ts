import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { Journal, journalSchema } from "@mori/shared";
import { DatabaseService } from "../../database/database.service";
import { UserId } from "../../common/auth.guard";
import { parse, uuid } from "../../common/validation";
import { GardenService } from "../garden/garden.service";
@Controller("journals")
export class JournalsController {
  constructor(
    private readonly db: DatabaseService,
    private readonly garden: GardenService,
  ) {}
  @Get() list(@UserId() user: string) {
    return this.db.list<Journal>("journals", user, { active: true });
  }
  @Post() async create(@UserId() user: string, @Body() body: unknown) {
    const value = parse(journalSchema, body);
    const existing = await this.db.list<Journal>("journals", user, {
      equals: { client_id: value.client_id },
    });
    const entry = existing[0]
      ? await this.db.update<Journal>("journals", user, existing[0].id, {
          ...value,
          updated_at: new Date().toISOString(),
        })
      : await this.db.insert<Journal>("journals", user, value);
    await this.garden.award(user, `journal:${entry.id}`);
    return entry;
  }
  @Patch(":id") async update(
    @UserId() user: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    await this.db.one("journals", user, uuid(id), true);
    return this.db.update("journals", user, id, {
      ...parse(journalSchema.omit({ client_id: true }).partial(), body),
      updated_at: new Date().toISOString(),
    });
  }
  @Delete(":id") delete(@UserId() user: string, @Param("id") id: string) {
    return this.db.remove("journals", user, uuid(id));
  }
}
