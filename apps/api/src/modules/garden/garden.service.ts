import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import {
  Garden,
  GardenAreaKey,
  GardenUnlock,
  PersonalMilestoneKey,
} from "@mori/shared";
import { PersonalMilestonesService } from "../milestones/personal-milestones.service";

const milestoneForArea: Record<GardenAreaKey, PersonalMilestoneKey> = {
  quiet_cottage: "quiet_cottage_appeared",
  reflection_lake: "reflection_lake_appeared",
  memory_garden: "memory_garden_appeared",
  letter_tree: "first_letter",
  wind_chimes: "wind_chimes_appeared",
  fireflies: "first_weekly_reflection",
  path_stones: "first_soft_goal",
  moon_hill: "moon_hill_appeared",
};
@Injectable()
export class GardenService {
  constructor(
    private readonly db: DatabaseService,
    private readonly milestones?: PersonalMilestonesService,
  ) {}
  async get(user: string): Promise<Garden> {
    await this.unlock(user, "quiet_cottage", "feature_activation");
    const [state, unlocks] = await Promise.all([
      this.db.one<Omit<Garden, "sanctuary_areas">>("garden_states", user),
      this.db.list<GardenUnlock>("garden_unlocks", user, {
        notNull: ["feature_key"],
        limit: 100,
      }),
    ]);
    return {
      ...state,
      sanctuary_areas: unlocks.map((unlock) => unlock.feature_key),
    };
  }
  award(user: string, action: string) {
    return this.db.rpc("award_growth", { p_user: user, p_action: action });
  }
  async unlock(
    user: string,
    feature: GardenAreaKey,
    sourceType: string,
    sourceId?: string,
  ) {
    await this.db.rpc("unlock_garden_area", {
      p_user: user,
      p_feature: feature,
      p_source_type: sourceType,
      p_source_id: sourceId ?? null,
    });
    await this.milestones?.record(
      user,
      milestoneForArea[feature],
      sourceType,
      sourceId,
    );
  }
}
