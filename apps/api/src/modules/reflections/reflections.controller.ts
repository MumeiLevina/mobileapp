import { BadRequestException, Controller, Get, Post } from "@nestjs/common";
import { Mood, Profile } from "@mori/shared";
import { DatabaseService } from "../../database/database.service";
import { UserId } from "../../common/auth.guard";
import { GardenService } from "../garden/garden.service";
@Controller()
export class ReflectionsController {
  constructor(
    private readonly db: DatabaseService,
    private readonly garden: GardenService,
  ) {}
  @Get("garden") getGarden(@UserId() user: string) {
    return this.garden.get(user);
  }
  @Get("weekly-reflection") async weekly(@UserId() user: string) {
    const profile = await this.db.one<Profile>("profiles", user);
    if (!profile.weekly_reflection_enabled)
      return { enabled: false, content: null };
    const since = Date.now() - 7 * 86400000;
    const [moods, journals, sessions, conversations] = await Promise.all([
      this.db.list<Mood>("mood_entries", user),
      this.db.list<{ created_at: string }>("journals", user, { active: true }),
      this.db.list<{ created_at: string; completed_at: string | null }>(
        "self_care_sessions",
        user,
      ),
      this.db.list<{ created_at: string }>("conversations", user, {
        active: true,
      }),
    ]);
    const recent = moods.filter((m) => Date.parse(m.created_at) >= since);
    const topics = [...new Set(recent.flatMap((m) => m.tags))];
    const counts = {
      moods: recent.length,
      journals: journals.filter((j) => Date.parse(j.created_at) >= since)
        .length,
      care: sessions.filter(
        (s) => s.completed_at && Date.parse(s.completed_at) >= since,
      ).length,
      talk: conversations.filter((c) => Date.parse(c.created_at) >= since)
        .length,
    };
    const viTopics: Record<string, string> = {
      Work: "Công việc",
      Relationship: "Mối quan hệ",
      Family: "Gia đình",
      Myself: "Bản thân",
      Health: "Sức khỏe",
      "Just tired": "Chỉ hơi mệt",
      Other: "Khác",
    };
    return {
      enabled: true,
      content:
        profile.locale === "en"
          ? `In the last 7 days, you checked in ${counts.moods} times, wrote ${counts.journals} journal entries, had ${counts.talk} conversations and completed ${counts.care} self-care activities.${topics.length ? ` Topics you chose: ${topics.join(", ")}.` : ""}\n\nWhat would you like to carry into next week?`
          : `Trong 7 ngày qua, bạn đã ghé lại với mình ${counts.moods} lần, viết ${counts.journals} trang nhật ký, có ${counts.talk} cuộc trò chuyện và hoàn thành ${counts.care} hoạt động chăm sóc bản thân.${topics.length ? ` Những chủ đề bạn chọn: ${topics.map((tag) => viTopics[tag] ?? tag).join(", ")}.` : ""}\n\nBạn muốn mang theo điều gì vào tuần tới?`,
    };
  }
  @Post("weekly-reflection/complete") async complete(@UserId() user: string) {
    const reflection = await this.weekly(user);
    if (!reflection.enabled || !reflection.content)
      throw new BadRequestException();
    const now = new Date();
    now.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
    const week = now.toISOString().slice(0, 10);
    await this.db.rpc("save_weekly_reflection", {
      p_user: user,
      p_week: week,
      p_content: reflection.content,
    });
    return { ok: true };
  }
}
