import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
@Injectable()
export class GardenService {
  constructor(private readonly db: DatabaseService) {}
  get(user: string) {
    return this.db.one("garden_states", user);
  }
  award(user: string, action: string) {
    return this.db.rpc("award_growth", { p_user: user, p_action: action });
  }
}
