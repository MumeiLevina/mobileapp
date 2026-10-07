import { Controller, Get } from "@nestjs/common";
import { CrisisResponseService } from "./safety.service";

@Controller("first-aid")
export class FirstAidController {
  constructor(private readonly crisis: CrisisResponseService) {}

  @Get("crisis")
  danger() {
    return this.crisis.respond("vi");
  }
}
