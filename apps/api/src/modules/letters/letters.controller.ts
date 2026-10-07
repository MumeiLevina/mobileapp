import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { letterCreateSchema, letterUpdateSchema } from "@mori/shared";
import { UserId } from "../../common/auth.guard";
import { parse, uuid } from "../../common/validation";
import { LettersService } from "./letters.service";

@Controller("letters")
export class LettersController {
  constructor(private readonly letters: LettersService) {}

  @Get()
  list(@UserId() user: string) {
    return this.letters.list(user);
  }

  @Get(":id/edit")
  editDraft(@UserId() user: string, @Param("id") id: string) {
    return this.letters.editDraft(user, uuid(id));
  }

  @Post()
  create(@UserId() user: string, @Body() body: unknown) {
    return this.letters.create(user, parse(letterCreateSchema, body));
  }

  @Patch(":id")
  update(
    @UserId() user: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.letters.update(user, uuid(id), parse(letterUpdateSchema, body));
  }

  @Post(":id/open")
  open(@UserId() user: string, @Param("id") id: string) {
    return this.letters.open(user, uuid(id));
  }

  @Delete(":id")
  delete(@UserId() user: string, @Param("id") id: string) {
    return this.letters.delete(user, uuid(id));
  }
}
