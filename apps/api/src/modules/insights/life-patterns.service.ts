import { Injectable } from "@nestjs/common";
import {
  InsightSource,
  LifePattern,
  LifePatternsResponse,
  Mood,
  PATTERN_DISCLAIMER,
  activities,
} from "@mori/shared";
import { DatabaseService } from "../../database/database.service";
import { fold } from "../safety/safety.service";

type JournalRow = {
  id: string;
  title: string;
  content: string;
  created_at: string;
};
type SessionRow = {
  id: string;
  activity_id: string;
  completed_at: string;
};

const topicMatchers = [
  { label: "Công việc", pattern: /\b(work|job|office|deadline|cong viec)\b/ },
  { label: "Học tập", pattern: /\b(study|school|exam|hoc|thi cu)\b/ },
  { label: "Gia đình", pattern: /\b(family|mother|father|gia dinh|me|bo)\b/ },
  {
    label: "Mối quan hệ",
    pattern: /\b(relationship|partner|friend|moi quan he|ban be)\b/,
  },
  { label: "Sức khỏe", pattern: /\b(health|sleep|body|suc khoe|giac ngu)\b/ },
] as const;
const topicLabels: Record<string, string> = {
  Work: "Công việc",
  Relationship: "Mối quan hệ",
  Family: "Gia đình",
  Health: "Sức khỏe",
  Myself: "Bản thân",
  "Just tired": "Mệt mỏi",
  Other: "Khác",
};

const source = (
  id: string,
  type: InsightSource["type"],
  label: string,
  occurredAt: string,
): InsightSource => ({ id, type, label, occurredAt });

@Injectable()
export class LifePatternsService {
  constructor(private readonly db: DatabaseService) {}

  async list(user: string): Promise<LifePatternsResponse> {
    const [moods, journals, sessions, preferences] = await Promise.all([
      this.db.list<Mood>("mood_entries", user, { limit: 200 }),
      this.db.list<JournalRow>("journals", user, {
        active: true,
        limit: 200,
      }),
      this.db.list<SessionRow>("self_care_sessions", user, {
        notNull: ["completed_at"],
        limit: 200,
      }),
      this.db.one<{ timezone: string }>("notification_preferences", user),
    ]);
    const patterns = [
      ...this.recurringTopics(moods, journals),
      ...this.activityFrequency(sessions),
      ...this.timePattern(journals, preferences.timezone),
      ...this.recurringThought(journals),
      ...this.moodActivity(moods, sessions),
    ];
    return {
      patterns,
      message: patterns.length ? null : "There's not enough information yet.",
      disclaimer: PATTERN_DISCLAIMER,
    };
  }

  private recurringTopics(
    moods: Mood[],
    journals: JournalRow[],
  ): LifePattern[] {
    if (moods.length + journals.length < 5) return [];
    const entries = [
      ...moods.map((mood) => ({
        id: mood.id,
        text: `${mood.tags.join(" ")} ${mood.optional_note}`,
        date: mood.created_at,
        type: "mood" as const,
        label: "Tâm trạng",
      })),
      ...journals.map((journal) => ({
        id: journal.id,
        text: `${journal.title} ${journal.content}`,
        date: journal.created_at,
        type: "journal" as const,
        label: "Nhật ký",
      })),
    ];
    const tagged = moods.flatMap((mood) =>
      mood.tags.map((tag) => ({ tag, mood })),
    );
    const candidates = [
      ...new Set([
        ...tagged.map(({ tag }) => topicLabels[tag] ?? tag),
        ...topicMatchers.map(({ label }) => label),
      ]),
    ]
      .map((label) => {
        const matcher = topicMatchers.find((topic) => topic.label === label);
        const matched = entries.filter((entry) => {
          if (
            entry.type === "mood" &&
            moods
              .find((mood) => mood.id === entry.id)
              ?.tags.some((tag) => (topicLabels[tag] ?? tag) === label)
          )
            return true;
          return matcher?.pattern.test(fold(entry.text)) ?? false;
        });
        return { label, matched };
      })
      .filter(({ matched }) => matched.length >= 5)
      .sort((a, b) => b.matched.length - a.matched.length)
      .slice(0, 2);
    return candidates.map(({ label, matched }) => ({
      id: `topic:${fold(label).replace(/\s+/g, "-")}`,
      type: "recurring_topic",
      title: "Chủ đề xuất hiện nhiều lần",
      observation: `${label} xuất hiện trong ${matched.length} ghi chép gần đây của bạn.`,
      evidenceCount: matched.length,
      sources: matched
        .slice(0, 7)
        .map((entry) => source(entry.id, entry.type, entry.label, entry.date)),
    }));
  }

  private activityFrequency(sessions: SessionRow[]): LifePattern[] {
    const byActivity = new Map<string, SessionRow[]>();
    sessions.forEach((session) =>
      byActivity.set(session.activity_id, [
        ...(byActivity.get(session.activity_id) ?? []),
        session,
      ]),
    );
    return [...byActivity.entries()]
      .filter(([, entries]) => entries.length >= 5)
      .slice(0, 1)
      .map(([activityId, entries]) => ({
        id: `activity:${activityId}`,
        type: "helpful_activity" as const,
        title: "Hoạt động bạn thường chọn",
        observation: `${activities.find((activity) => activity.id === activityId)?.title ?? activityId} xuất hiện ${entries.length} lần trong lịch sử chăm sóc bản thân của bạn.`,
        evidenceCount: entries.length,
        sources: entries
          .slice(0, 7)
          .map((entry) =>
            source(
              entry.id,
              "self_care",
              "Chăm sóc bản thân",
              entry.completed_at,
            ),
          ),
      }));
  }

  private timePattern(journals: JournalRow[], timezone: string): LifePattern[] {
    if (journals.length < 5) return [];
    const ranges = [
      {
        label: "từ 10 giờ tối đến nửa đêm",
        match: (hour: number) => hour >= 22,
      },
      {
        label: "vào buổi sáng",
        match: (hour: number) => hour >= 5 && hour < 12,
      },
      {
        label: "vào buổi chiều",
        match: (hour: number) => hour >= 12 && hour < 18,
      },
      {
        label: "vào buổi tối",
        match: (hour: number) => hour >= 18 && hour < 22,
      },
    ];
    const best = ranges
      .map((range) => ({
        ...range,
        entries: journals.filter((journal) =>
          range.match(this.hourAt(journal.created_at, timezone)),
        ),
      }))
      .sort((a, b) => b.entries.length - a.entries.length)[0];
    if (!best || best.entries.length < 5) return [];
    return [
      {
        id: `time:${best.label}`,
        type: "time_pattern",
        title: "Thời gian bạn thường viết",
        observation: `${best.entries.length} trong ${journals.length} trang gần đây được tạo ${best.label}.`,
        evidenceCount: best.entries.length,
        sources: best.entries
          .slice(0, 7)
          .map((entry) =>
            source(entry.id, "journal", "Nhật ký", entry.created_at),
          ),
      },
    ];
  }

  private hourAt(timestamp: string, timezone: string) {
    try {
      return (
        Number(
          new Intl.DateTimeFormat("en-US", {
            hour: "numeric",
            hour12: false,
            timeZone: timezone,
          }).format(new Date(timestamp)),
        ) % 24
      );
    } catch {
      return new Date(timestamp).getUTCHours();
    }
  }

  private recurringThought(journals: JournalRow[]): LifePattern[] {
    if (journals.length < 5) return [];
    const phrases = new Map<string, JournalRow[]>();
    journals.forEach((journal) => {
      const normalized = fold(journal.content).replace(/[^a-z0-9\s]/g, " ");
      const tokens = normalized.split(/\s+/).filter(Boolean);
      const seen = new Set<string>();
      for (let index = 0; index <= tokens.length - 5; index += 1)
        seen.add(tokens.slice(index, index + 5).join(" "));
      seen.forEach((phrase) =>
        phrases.set(phrase, [...(phrases.get(phrase) ?? []), journal]),
      );
    });
    const match = [...phrases.entries()]
      .filter(([, entries]) => entries.length >= 5)
      .sort((a, b) => b[1].length - a[1].length)[0];
    if (!match) return [];
    const [phrase, entries] = match;
    return [
      {
        id: `thought:${phrase}`,
        type: "recurring_thought",
        title: "Một cụm từ lặp lại",
        observation: `“${phrase}” xuất hiện trong ${entries.length} trang viết.`,
        evidenceCount: entries.length,
        sources: entries
          .slice(0, 7)
          .map((entry) =>
            source(entry.id, "journal", "Nhật ký", entry.created_at),
          ),
      },
    ];
  }

  private moodActivity(moods: Mood[], sessions: SessionRow[]): LifePattern[] {
    const positive = new Set(["good", "joyful"]);
    const byActivity = new Map<string, { session: SessionRow; mood: Mood }[]>();
    sessions.forEach((session) => {
      const completed = Date.parse(session.completed_at);
      const mood = moods
        .filter((entry) => {
          const delta = Date.parse(entry.created_at) - completed;
          return delta >= 0 && delta <= 24 * 60 * 60 * 1000;
        })
        .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))[0];
      if (mood)
        byActivity.set(session.activity_id, [
          ...(byActivity.get(session.activity_id) ?? []),
          { session, mood },
        ]);
    });
    const match = [...byActivity.entries()]
      .map(([activityId, pairs]) => ({
        activityId,
        pairs,
        positive: pairs.filter(({ mood }) => positive.has(mood.mood)).length,
      }))
      .filter(({ pairs }) => pairs.length >= 5)
      .sort((a, b) => b.pairs.length - a.pairs.length)[0];
    if (!match) return [];
    const title =
      activities.find((activity) => activity.id === match.activityId)?.title ??
      match.activityId;
    return [
      {
        id: `mood-activity:${match.activityId}`,
        type: "mood_activity",
        title: "Hoạt động và các lần ghi tâm trạng sau đó",
        observation: `Trong ${match.pairs.length} lần có ghi tâm trạng trong vòng 24 giờ sau “${title}”, ${match.positive} lần là tâm trạng khá ổn hoặc rất vui. Đây chỉ là thứ tự xuất hiện trong ghi chép.`,
        evidenceCount: match.pairs.length,
        sources: match.pairs
          .slice(0, 7)
          .map(({ mood }) =>
            source(mood.id, "mood", "Tâm trạng", mood.created_at),
          ),
      },
    ];
  }
}
