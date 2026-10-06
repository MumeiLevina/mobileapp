import { Controller, Get, Query } from "@nestjs/common";
import { TimelineFilter } from "@mori/shared";
import { UserId } from "../../common/auth.guard";
import { parse } from "../../common/validation";
import { TimelineService } from "./timeline.service";

@Controller("reflections")
export class TimelineController {
  constructor(private readonly timeline: TimelineService) {}

  @Get("timeline")
  list(@UserId() user: string, @Query("filter") filter = "all") {
    return this.timeline.list(user, parse(TimelineFilter, filter));
  }
}
