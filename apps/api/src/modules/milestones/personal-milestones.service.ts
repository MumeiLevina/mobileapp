import { Injectable } from "@nestjs/common";
import {
  PersonalMilestone,
  PersonalMilestoneKey,
} from "@mori/shared";
import { DatabaseService } from "../../database/database.service";

@Injectable()
export class PersonalMilestonesService {
  constructor(private readonly db: DatabaseService) {}

  list(user: string) {
    return this.db.list<PersonalMilestone>("personal_milestones", user, {
      limit: 50,
    });
  }

  record(
    user: string,
    key: PersonalMilestoneKey,
    sourceType?: string,
    sourceId?: string,
  ) {
    return this.db.rpc("record_personal_milestone", {
      p_user: user,
      p_key: key,
      p_source_type: sourceType ?? null,
      p_source_id: sourceId ?? null,
    });
  }

  acknowledge(user: string, id: string, now = new Date()) {
    return this.db.update<PersonalMilestone>(
      "personal_milestones",
      user,
      id,
      { acknowledged_at: now.toISOString() },
    );
  }
}
