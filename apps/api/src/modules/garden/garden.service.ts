import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { Garden, GardenAreaKey, GardenUnlock } from "@mori/shared";
@Injectable()
export class GardenService {
  constructor(private readonly db: DatabaseService) {}
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
  unlock(
    user: string,
    feature: GardenAreaKey,
    sourceType: string,
    sourceId?: string,
  ) {
    return this.db.rpc("unlock_garden_area", {
      p_user: user,
      p_feature: feature,
      p_source_type: sourceType,
      p_source_id: sourceId ?? null,
    });
  }
}
