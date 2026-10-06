import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { Activity, IntentResult } from "@mori/shared";
import { DatabaseService } from "../../database/database.service";
@Injectable()
export class SelfCareService {
  constructor(private readonly db: DatabaseService) {}
  async list(): Promise<Activity[]> {
    const { data, error } = await this.db.admin
      .from("self_care_activities")
      .select("*")
      .eq("enabled", true);
    if (error) throw new ServiceUnavailableException();
    return data as Activity[];
  }
  async suggestSelfCare(intent: IntentResult): Promise<Activity | undefined> {
    if (!intent.adviceRequested || intent.intent !== "SELF_CARE")
      return undefined;
    const library = await this.list();
    return library.find(
      (a) => a.category === "breathing" && a.energy_level === "low",
    );
  }
}
