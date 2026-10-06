import { Injectable } from "@nestjs/common";
import {
  LifeMapItem,
  Mood,
  TimelineFilter,
  TimelineItem,
  activities,
} from "@mori/shared";
import { DatabaseService } from "../../database/database.service";

@Injectable()
export class TimelineService {
  constructor(private readonly db: DatabaseService) {}

  async list(user: string, filter: TimelineFilter): Promise<TimelineItem[]> {
    const [moods, journals, conversations, sessions, lifeEvents, milestones] =
      await Promise.all([
        this.db.list<Mood>("mood_entries", user, { limit: 100 }),
        this.db.list<Record<string, unknown>>("journals", user, {
          active: true,
          limit: 100,
        }),
        this.db.list<Record<string, unknown>>("conversations", user, {
          active: true,
          limit: 100,
        }),
        this.db.list<Record<string, unknown>>("self_care_sessions", user, {
          notNull: ["completed_at"],
          limit: 100,
        }),
        this.db.list<LifeMapItem>("life_map_items", user, {
          active: true,
          equals: { type: "important_events", approved_by_user: true },
          limit: 100,
        }),
        this.db.list<Record<string, unknown>>("garden_unlocks", user, {
          limit: 100,
        }),
      ]);

    const moodNames: Record<Mood["mood"], string> = {
      joyful: "Rất vui",
      good: "Khá ổn",
      okay: "Bình thường",
      low: "Hơi buồn",
      overwhelmed: "Quá tải",
    };
    const items: TimelineItem[] = [
      ...moods.map((mood) => ({
        id: `mood:${mood.id}`,
        type: "mood" as const,
        title: `Tâm trạng: ${moodNames[mood.mood]}`,
        detail: mood.optional_note || mood.tags.join(" · ") || undefined,
        occurredAt: mood.created_at,
        sourceId: mood.id,
      })),
      ...journals.map((journal) => ({
        id: `journal:${String(journal.id)}`,
        type: "journal" as const,
        title: String(journal.title),
        detail: String(journal.content).slice(0, 240),
        occurredAt: String(journal.created_at),
        sourceId: String(journal.id),
      })),
      ...conversations.map((conversation) => ({
        id: `conversation:${String(conversation.id)}`,
        type: "conversation" as const,
        title: String(conversation.title),
        occurredAt: String(conversation.created_at),
        sourceId: String(conversation.id),
      })),
      ...sessions.map((session) => ({
        id: `self-care:${String(session.id)}`,
        type: "self_care" as const,
        title:
          activities.find((activity) => activity.id === session.activity_id)
            ?.title ?? "Một khoảng chăm sóc bản thân",
        occurredAt: String(session.completed_at),
        sourceId: String(session.id),
      })),
      ...lifeEvents.map((event) => ({
        id: `important-event:${event.id}`,
        type: "important_event" as const,
        title: event.title,
        detail: event.description || undefined,
        occurredAt: event.created_at,
        sourceId: event.id,
      })),
      ...milestones
        .slice()
        .sort(
          (a, b) =>
            Date.parse(String(a.created_at)) - Date.parse(String(b.created_at)),
        )
        .flatMap((milestone, index) => {
          const titles: Record<number, string> = {
            5: "Hoa đã xuất hiện trong khu vườn",
            12: "Đom đóm và mặt hồ đã xuất hiện",
            25: "Ghế nhỏ và ánh trăng đã xuất hiện",
          };
          const title = titles[index + 1];
          return title
            ? [
                {
                  id: `garden:${String(milestone.id)}`,
                  type: "garden_milestone" as const,
                  title,
                  occurredAt: String(milestone.created_at),
                  sourceId: String(milestone.id),
                },
              ]
            : [];
        }),
    ];

    return items
      .filter((item) => this.matches(item.type, filter))
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
      .slice(0, 100);
  }

  private matches(type: TimelineItem["type"], filter: TimelineFilter) {
    if (filter === "all") return true;
    if (filter === "important_moment")
      return ["important_event", "garden_milestone", "letter"].includes(type);
    return type === filter;
  }
}
