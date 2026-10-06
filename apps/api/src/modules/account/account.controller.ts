import {
  Controller,
  Delete,
  Post,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { UserId } from "../../common/auth.guard";
import { DatabaseService } from "../../database/database.service";
import { AccountExportService } from "./account-export.service";

@Controller("account")
export class AccountController {
  constructor(
    private readonly db: DatabaseService,
    private readonly exports: AccountExportService,
  ) {}

  @Post("export")
  @Throttle({ default: { limit: 2, ttl: 60000 } })
  export(@UserId() user: string) {
    return this.exports.create(user);
  }

  @Delete()
  async remove(@UserId() user: string) {
    const { error } = await this.db.admin.auth.admin.deleteUser(user);
    if (error) throw new ServiceUnavailableException();
    return { ok: true };
  }
}
