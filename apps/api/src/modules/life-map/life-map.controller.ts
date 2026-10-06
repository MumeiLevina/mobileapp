import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { lifeMapSchema, lifeMapSuggestionSchema } from "@mori/shared";
import { UserId } from "../../common/auth.guard";
import { parse, uuid } from "../../common/validation";
import { LifeMapService } from "./life-map.service";

@Controller("life-map")
export class LifeMapController {
  constructor(private readonly lifeMap: LifeMapService) {}

  @Get() list(@UserId() user: string) {
    return this.lifeMap.list(user);
  }

  @Get("suggestions") suggestions(@UserId() user: string) {
    return this.lifeMap.suggestions(user);
  }

  @Post() create(@UserId() user: string, @Body() body: unknown) {
    return this.lifeMap.create(user, parse(lifeMapSchema, body));
  }

  @Post("suggestions") addSuggestion(
    @UserId() user: string,
    @Body() body: unknown,
  ) {
    return this.lifeMap.addSuggestion(
      user,
      parse(lifeMapSuggestionSchema, body),
    );
  }

  @Post(":id/approve") approve(
    @UserId() user: string,
    @Param("id") id: string,
  ) {
    return this.lifeMap.approve(user, uuid(id));
  }

  @Patch(":id") edit(
    @UserId() user: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.lifeMap.edit(user, uuid(id), parse(lifeMapSchema, body));
  }

  @Delete(":id") delete(@UserId() user: string, @Param("id") id: string) {
    return this.lifeMap.delete(user, uuid(id));
  }
}
