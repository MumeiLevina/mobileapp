import { Injectable } from "@nestjs/common";
import { AccountDataExport } from "@mori/shared";
import { DatabaseService } from "../../database/database.service";

type ExportAudit = { id: string };

const pick = (
  value: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> =>
  Object.fromEntries(
    keys.filter((key) => key in value).map((key) => [key, value[key]]),
  );

@Injectable()
export class AccountExportService {
  constructor(private readonly db: DatabaseService) {}

  async create(user: string): Promise<AccountDataExport> {
    const audit = await this.db.insert<ExportAudit>(
      "data_export_audits",
      user,
      {
        format: "json",
        status: "processing",
        record_counts: {},
      },
    );

    try {
      const [
        profile,
        moods,
        journals,
        memories,
        conversations,
        messages,
        selfCareHistory,
        garden,
        weeklyReflections,
        notificationPreferences,
        lifeMapItems,
      ] = await Promise.all([
        this.db.one<Record<string, unknown>>("profiles", user),
        this.db.listAllForExport<Record<string, unknown>>(
          "mood_entries",
          user,
          "id,mood,intensity,tags,optional_note,client_id,created_at",
        ),
        this.db.listAllForExport<Record<string, unknown>>(
          "journals",
          user,
          "id,title,content,source,client_id,created_at,updated_at",
        ),
        this.db.listAllForExport<Record<string, unknown>>(
          "memories",
          user,
          "id,content,category,approved_by_user,created_at,updated_at",
        ),
        this.db.listAllForExport<Record<string, unknown>>(
          "conversations",
          user,
          "id,title,mode,created_at,updated_at",
        ),
        this.db.listAllForExport<Record<string, unknown>>(
          "messages",
          user,
          "id,conversation_id,role,content,client_id,created_at",
        ),
        this.db.listAllForExport<Record<string, unknown>>(
          "self_care_sessions",
          user,
          "id,activity_id,created_at,completed_at",
        ),
        this.db.one<Record<string, unknown>>("garden_states", user),
        this.db.listAllForExport<Record<string, unknown>>(
          "weekly_reflections",
          user,
          "id,week_start,content,created_at",
        ),
        this.db.one<Record<string, unknown>>("notification_preferences", user),
        this.db.listAllForExport<Record<string, unknown>>(
          "life_map_items",
          user,
          "id,type,title,description,source_type,source_id,approved_by_user,created_at,updated_at,deleted_at",
        ),
      ]);

      const data: AccountDataExport["data"] = {
        profile: pick(profile, [
          "display_name",
          "goals",
          "companion_style",
          "locale",
          "onboarded",
          "weekly_reflection_enabled",
          "updated_at",
        ]),
        moods,
        journals,
        memories,
        conversations,
        messages,
        selfCareHistory,
        garden: pick(garden, [
          "growth_points",
          "tree_level",
          "unlocked_items",
          "last_updated",
        ]),
        weeklyReflections,
        notificationPreferences: pick(notificationPreferences, [
          "period",
          "hour",
          "minute",
          "timezone",
        ]),
        lifeMapItems,
      };
      const recordCounts = {
        profile: 1,
        moods: moods.length,
        journals: journals.length,
        memories: memories.length,
        conversations: conversations.length,
        messages: messages.length,
        selfCareHistory: selfCareHistory.length,
        garden: 1,
        weeklyReflections: weeklyReflections.length,
        notificationPreferences: 1,
        lifeMapItems: lifeMapItems.length,
      };
      await this.db.update("data_export_audits", user, audit.id, {
        status: "completed",
        record_counts: recordCounts,
        completed_at: new Date().toISOString(),
      });
      return {
        schemaVersion: 2,
        generatedAt: new Date().toISOString(),
        data,
      };
    } catch (error) {
      await this.db
        .update("data_export_audits", user, audit.id, {
          status: "failed",
          completed_at: new Date().toISOString(),
        })
        .catch(() => undefined);
      throw error;
    }
  }
}
