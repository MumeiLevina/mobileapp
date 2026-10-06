import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  ServiceUnavailableException,
} from "@nestjs/common";
import { profileSchema, notificationSchema } from "@mori/shared";
import { DatabaseService } from "../../database/database.service";
import { UserId } from "../../common/auth.guard";
import { parse } from "../../common/validation";
@Controller()
export class ProfileController {
  constructor(private readonly db: DatabaseService) {}
  @Get("profile") get(@UserId() user: string) {
    return this.db.one("profiles", user);
  }
  @Post("auth/profile") create(@UserId() user: string, @Body() body: unknown) {
    return this.db.update(
      "profiles",
      user,
      undefined,
      parse(profileSchema, body),
    );
  }
  @Patch("profile") update(@UserId() user: string, @Body() body: unknown) {
    return this.db.update(
      "profiles",
      user,
      undefined,
      parse(profileSchema.partial(), body),
    );
  }
  @Get("notification-preferences") preferences(@UserId() user: string) {
    return this.db.one("notification_preferences", user);
  }
  @Patch("notification-preferences") notifications(
    @UserId() user: string,
    @Body() body: unknown,
  ) {
    return this.db.update(
      "notification_preferences",
      user,
      undefined,
      parse(notificationSchema, body),
    );
  }
  @Delete("account") async remove(@UserId() user: string) {
    const { error } = await this.db.admin.auth.admin.deleteUser(user);
    if (error) throw new ServiceUnavailableException();
    return { ok: true };
  }
}
