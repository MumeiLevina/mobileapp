import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { memorySchema } from "@mori/shared";
import { MemoriesService } from "./memories.service";
import { UserId } from "../../common/auth.guard";
import { parse, uuid } from "../../common/validation";
@Controller("memories")
export class MemoriesController {
  constructor(private readonly memories: MemoriesService) {}
  @Get() list(@UserId() user: string) {
    return this.memories.list(user);
  }
  @Post() create(@UserId() user: string, @Body() body: unknown) {
    return this.memories.add(user, parse(memorySchema, body));
  }
  @Post(":id/approve") approve(
    @UserId() user: string,
    @Param("id") id: string,
  ) {
    return this.memories.approve(user, uuid(id));
  }
  @Patch(":id") edit(
    @UserId() user: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.memories.edit(user, uuid(id), parse(memorySchema, body));
  }
  @Delete(":id") delete(@UserId() user: string, @Param("id") id: string) {
    return this.memories.delete(user, uuid(id));
  }
  @Delete() deleteAll(@UserId() user: string) {
    return this.memories.delete(user);
  }
}
