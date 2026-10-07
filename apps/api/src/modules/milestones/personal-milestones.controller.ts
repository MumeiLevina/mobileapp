import { Controller, Get, Param, Post } from "@nestjs/common";
import { UserId } from "../../common/auth.guard";
import { uuid } from "../../common/validation";
import { PersonalMilestonesService } from "./personal-milestones.service";

@Controller("personal-milestones")
export class PersonalMilestonesController {
  constructor(private readonly milestones: PersonalMilestonesService) {}

  @Get()
  list(@UserId() user: string) {
    return this.milestones.list(user);
  }

  @Post(":id/acknowledge")
  acknowledge(@UserId() user: string, @Param("id") id: string) {
    return this.milestones.acknowledge(user, uuid(id));
  }
}
