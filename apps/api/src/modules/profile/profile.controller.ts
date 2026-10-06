import { Body, Controller, Get, Patch, Post } from "@nestjs/common";
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
}
