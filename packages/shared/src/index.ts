import { z } from "zod";
export * from "./guided-journals";
export * from "./letters";
export * from "./soft-goals";
export const CompanionStyle = z.enum(["gentle", "close_friend", "calm"]);
export const ConversationMode = z.enum(["listen", "understand", "think"]);
export const IntentType = z.enum([
  "LISTEN",
  "REFLECT",
  "ADVICE",
  "SELF_CARE",
  "JOURNAL",
  "CELEBRATE",
  "CASUAL",
  "CRISIS",
]);
export const SafetyLevel = z.enum(["normal", "distress", "elevated", "crisis"]);
export const MemoryCategory = z.enum([
  "preference",
  "life_event",
  "relationship",
  "goal",
  "self_care_preference",
  "communication_preference",
]);
export const MoodType = z.enum([
  "joyful",
  "good",
  "okay",
  "low",
  "overwhelmed",
]);
export const SelfCareCategory = z.enum([
  "breathing",
  "grounding",
  "journaling",
  "relaxation",
  "sleep",
  "mindfulness",
  "self_compassion",
  "walk",
  "digital_break",
  "reach_out",
  "hydration",
  "stretching",
]);
export type CompanionStyle = z.infer<typeof CompanionStyle>;
export type ConversationMode = z.infer<typeof ConversationMode>;
export type IntentType = z.infer<typeof IntentType>;
export type SafetyLevel = z.infer<typeof SafetyLevel>;
export type MemoryCategory = z.infer<typeof MemoryCategory>;
export type MoodType = z.infer<typeof MoodType>;
export type SelfCareCategory = z.infer<typeof SelfCareCategory>;
export const profileSchema = z.object({
  display_name: z.string().trim().max(60).default("Bạn"),
  goals: z.array(z.string().max(80)).max(6).default([]),
  companion_style: CompanionStyle.default("gentle"),
  locale: z.enum(["vi", "en"]).default("vi"),
  onboarded: z.boolean().default(false),
  weekly_reflection_enabled: z.boolean().default(false),
});
export type Profile = z.infer<typeof profileSchema>;
export const moodSchema = z.object({
  mood: MoodType,
  intensity: z.number().min(0).max(1),
  tags: z
    .array(
      z.enum([
        "Work",
        "Relationship",
        "Family",
        "Myself",
        "Health",
        "Just tired",
        "Other",
      ]),
    )
    .max(7),
  optional_note: z.string().max(2000).default(""),
  client_id: z.string().uuid(),
});
export const journalSchema = z.object({
  title: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(20000),
  source: z
    .enum(["manual", "conversation", "reflection", "guided"])
    .default("manual"),
  client_id: z.string().uuid(),
});
export const memorySchema = z.object({
  content: z.string().trim().min(1).max(600),
  category: MemoryCategory,
});
export const messageSchema = z.object({
  content: z.string().trim().min(1).max(6000),
  mode: ConversationMode,
  client_id: z.string().uuid(),
});
export const ephemeralMessageSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(12000),
});
export const privateMessageSchema = z.object({
  content: z.string().trim().min(1).max(6000),
  mode: ConversationMode,
  client_id: z.string().uuid(),
  history: z.array(ephemeralMessageSchema).max(12).default([]),
});
export const savePrivateConversationSchema = z.object({
  mode: ConversationMode,
  messages: z.array(ephemeralMessageSchema).min(2).max(100),
});
export type EphemeralMessage = z.infer<typeof ephemeralMessageSchema>;
export type PrivateChatResult = {
  message: EphemeralMessage;
  safetyLevel: SafetyLevel;
  crisisResources?: CrisisResource[];
};
export const notificationSchema = z.object({
  period: z.enum(["off", "morning", "evening", "custom"]),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  timezone: z.string().max(80),
  morning_enabled: z.boolean().default(false),
  morning_hour: z.number().int().min(0).max(23).default(8),
  morning_minute: z.number().int().min(0).max(59).default(0),
  evening_enabled: z.boolean().default(false),
  evening_hour: z.number().int().min(0).max(23).default(20),
  evening_minute: z.number().int().min(0).max(59).default(0),
});
export const RitualType = z.enum(["morning", "evening"]);
export const DesiredFeeling = z.enum([
  "peaceful",
  "focused",
  "gentle",
  "brave",
]);
export const ritualEntrySchema = z
  .object({
    type: RitualType,
    desired_feeling: DesiredFeeling.nullable().default(null),
    small_intention: z.string().trim().max(1000).default(""),
    reflection: z.string().trim().max(4000).default(""),
    client_id: z.string().uuid(),
  })
  .superRefine((value, context) => {
    if (value.type === "morning" && !value.desired_feeling) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["desired_feeling"],
        message: "Morning ritual needs an explicit desired feeling.",
      });
    }
  });
export const askMoriSchema = z.object({
  question: z.string().trim().min(3).max(500),
});
export const LifeMapType = z.enum([
  "people",
  "goals",
  "values",
  "places",
  "important_events",
  "preferences",
  "helpful_things",
]);
export const lifeMapSchema = z.object({
  type: LifeMapType,
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).default(""),
});
export const lifeMapSuggestionSchema = lifeMapSchema.extend({
  source_type: z.literal("memory"),
  source_id: z.string().uuid(),
});
export type LifeMapType = z.infer<typeof LifeMapType>;
export const InsightSourceType = z.enum([
  "memory",
  "journal",
  "mood",
  "conversation",
  "self_care",
  "weekly_reflection",
]);
export const TimelineFilter = z.enum([
  "all",
  "mood",
  "journal",
  "self_care",
  "important_moment",
]);
export type TimelineFilter = z.infer<typeof TimelineFilter>;
export type TimelineItemType =
  | "mood"
  | "journal"
  | "conversation"
  | "self_care"
  | "important_event"
  | "garden_milestone"
  | "letter";
export type TimelineItem = {
  id: string;
  type: TimelineItemType;
  title: string;
  detail?: string;
  occurredAt: string;
  sourceId: string;
};
export const PATTERN_DISCLAIMER =
  "This is a pattern in your entries, not proof of cause or a diagnosis.";
export type LifePatternType =
  | "recurring_topic"
  | "helpful_activity"
  | "time_pattern"
  | "recurring_thought"
  | "mood_activity";
export type LifePattern = {
  id: string;
  type: LifePatternType;
  title: string;
  observation: string;
  evidenceCount: number;
  sources: InsightSource[];
};
export type LifePatternsResponse = {
  patterns: LifePattern[];
  message: string | null;
  disclaimer: typeof PATTERN_DISCLAIMER;
};
export type InsightSourceType = z.infer<typeof InsightSourceType>;
export type InsightSource = {
  id: string;
  type: InsightSourceType;
  label: string;
  occurredAt: string;
};
export type AskMoriResponse = {
  answer: string;
  sources: InsightSource[];
  safetyLevel: SafetyLevel;
  crisisResources?: CrisisResource[];
};
export type NotificationPreference = z.infer<typeof notificationSchema>;
export type RitualType = z.infer<typeof RitualType>;
export type DesiredFeeling = z.infer<typeof DesiredFeeling>;
export type Entity = {
  id: string;
  user_id: string;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
};
export type Mood = Entity & z.infer<typeof moodSchema>;
export type Journal = Entity & z.infer<typeof journalSchema>;
export type RitualEntry = Entity & z.infer<typeof ritualEntrySchema>;
export type Memory = Entity &
  z.infer<typeof memorySchema> & {
    approved_by_user: boolean;
    approved_at?: string | null;
    confidence: number;
    embedding?: number[] | null;
    memory_sources?: MemorySource[];
  };
export type MemorySource = {
  id: string;
  source_type:
    | "manual"
    | "conversation"
    | "journal"
    | "mood"
    | "weekly_reflection"
    | "life_map";
  source_id: string | null;
  reason: string;
  created_at: string;
};
export type Conversation = Entity & { title: string; mode: ConversationMode };
export type LifeMapItem = Entity &
  z.infer<typeof lifeMapSchema> & {
    source_type: "memory" | "journal" | "conversation" | null;
    source_id: string | null;
    approved_by_user: boolean;
  };
export type LifeMapSuggestion = z.infer<typeof lifeMapSuggestionSchema>;
export type Message = Entity & {
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  client_id?: string;
  safety_level?: SafetyLevel;
};
export const GardenAreaKey = z.enum([
  "reflection_lake",
  "memory_garden",
  "letter_tree",
  "quiet_cottage",
  "wind_chimes",
  "fireflies",
  "path_stones",
  "moon_hill",
]);
export type GardenAreaKey = z.infer<typeof GardenAreaKey>;
export type GardenUnlock = {
  id: string;
  feature_key: GardenAreaKey;
  unlocked_at: string;
  source_type: string;
  source_id: string | null;
};
export type Garden = {
  growth_points: number;
  tree_level: number;
  unlocked_items: string[];
  sanctuary_areas: GardenAreaKey[];
};
export type Activity = {
  id: string;
  title: string;
  description: string;
  duration: number;
  category: SelfCareCategory;
  steps: string[];
  difficulty: "easy";
  energy_level: "low" | "medium";
  time_of_day: string[];
  enabled: boolean;
};
export type SafetyResult = {
  level: SafetyLevel;
  selfHarmRisk: boolean;
  violenceRisk: boolean;
  requiresEscalation: boolean;
};
export type CrisisResource = {
  id: string;
  country_code: string | null;
  region: string | null;
  resource_type: "emergency" | "crisis_line" | "hospital" | "support_service";
  name: string;
  phone: string | null;
  url: string | null;
  available_hours: string | null;
  language: string;
};
export type IntentResult = {
  intent: IntentType;
  emotion: string;
  intensity: number;
  adviceRequested: boolean;
  safetyLevel: SafetyLevel;
};
export type ChatResult = {
  message: Message;
  memory?: Memory;
  safetyLevel: SafetyLevel;
  activity?: Activity;
  crisisResources?: CrisisResource[];
};
export type FirstAidCrisisResponse = {
  message: string;
  resources: CrisisResource[];
};
export type AccountDataExport = {
  schemaVersion: 5;
  generatedAt: string;
  data: {
    profile: Record<string, unknown>;
    moods: Record<string, unknown>[];
    journals: Record<string, unknown>[];
    memories: Record<string, unknown>[];
    conversations: Record<string, unknown>[];
    messages: Record<string, unknown>[];
    selfCareHistory: Record<string, unknown>[];
    garden: Record<string, unknown>;
    weeklyReflections: Record<string, unknown>[];
    notificationPreferences: Record<string, unknown>;
    lifeMapItems: Record<string, unknown>[];
    memorySources: Record<string, unknown>[];
    ritualEntries: Record<string, unknown>[];
    letters: Record<string, unknown>[];
  };
};
export const gardenFromPoints = (points: number): Garden => ({
  growth_points: points,
  tree_level: Math.min(5, 1 + Math.floor(points / 5)),
  unlocked_items: [
    "plants",
    ...(points >= 5 ? ["flowers"] : []),
    ...(points >= 12 ? ["fireflies", "lake"] : []),
    ...(points >= 25 ? ["bench", "moon"] : []),
  ],
  sanctuary_areas: [
    "quiet_cottage",
    ...(points >= 12 ? (["reflection_lake", "fireflies"] as const) : []),
    ...(points >= 25 ? (["moon_hill"] as const) : []),
  ],
});
export const activities: Activity[] = [
  {
    id: "breathing",
    title: "Hai phút thở chậm",
    description: "Một khoảng nghỉ, chỉ dành cho bạn.",
    duration: 120,
    category: "breathing",
    steps: [
      "Ngồi ở tư thế thoải mái.",
      "Hít vào nhẹ nhàng trong 4 giây nếu thấy dễ chịu.",
      "Thở ra chậm trong 6 giây. Không cần nín thở.",
      "Trở lại nhịp thở tự nhiên bất cứ lúc nào. Dừng nếu thấy khó chịu.",
    ],
    difficulty: "easy",
    energy_level: "low",
    time_of_day: ["any"],
    enabled: true,
  },
  {
    id: "grounding",
    title: "Chạm vào hiện tại",
    description: "Nhận ra những điều nhỏ ở quanh mình.",
    duration: 120,
    category: "grounding",
    steps: [
      "Nhìn quanh, gọi tên ba vật bạn thấy.",
      "Cảm nhận bàn chân chạm sàn.",
      "Lắng nghe một âm thanh gần bạn.",
    ],
    difficulty: "easy",
    energy_level: "low",
    time_of_day: ["any"],
    enabled: true,
  },
  {
    id: "rain",
    title: "Mưa bên ô cửa",
    description: "Ngắm một khoảng trời yên. Không cần làm gì cả.",
    duration: 180,
    category: "relaxation",
    steps: [
      "Chọn một chỗ ngồi thoải mái.",
      "Để mắt nghỉ trên cảnh mưa.",
      "Bạn có thể rời đi bất cứ lúc nào.",
    ],
    difficulty: "easy",
    energy_level: "low",
    time_of_day: ["any"],
    enabled: true,
  },
  {
    id: "water",
    title: "Uống một chút nước",
    description: "Một cử chỉ nhỏ chăm sóc mình.",
    duration: 60,
    category: "hydration",
    steps: ["Lấy một cốc nước.", "Uống chậm theo nhu cầu của bạn."],
    difficulty: "easy",
    energy_level: "low",
    time_of_day: ["any"],
    enabled: true,
  },
  {
    id: "walk",
    title: "Một vòng ngoài trời",
    description: "Đổi khung cảnh trong vài phút.",
    duration: 300,
    category: "walk",
    steps: [
      "Chọn một nơi an toàn, dễ đi.",
      "Bước chậm và nhìn ngắm xung quanh.",
      "Trở về khi bạn muốn.",
    ],
    difficulty: "easy",
    energy_level: "medium",
    time_of_day: ["morning", "afternoon"],
    enabled: true,
  },
  {
    id: "sleep",
    title: "Khép lại một ngày",
    description: "Cho buổi tối một nhịp chậm hơn.",
    duration: 180,
    category: "sleep",
    steps: [
      "Giảm ánh sáng nếu bạn muốn.",
      "Đặt điện thoại ra xa.",
      "Cho mình một lúc nghỉ ngơi.",
    ],
    difficulty: "easy",
    energy_level: "low",
    time_of_day: ["evening"],
    enabled: true,
  },
  {
    id: "reach-out",
    title: "Gửi lời cho một người",
    description: "Một kết nối nhỏ ngoài đời.",
    duration: 120,
    category: "reach_out",
    steps: [
      "Nghĩ đến một người bạn tin tưởng.",
      "Bạn có thể nhắn: Hôm nay bạn thế nào?",
      "Không cần phải kể mọi chuyện ngay.",
    ],
    difficulty: "easy",
    energy_level: "medium",
    time_of_day: ["any"],
    enabled: true,
  },
  {
    id: "break",
    title: "Rời màn hình một chút",
    description: "Thế giới ngoài này vẫn ở đây.",
    duration: 120,
    category: "digital_break",
    steps: [
      "Đặt thiết bị xuống.",
      "Nhìn ra xa hoặc đứng dậy nếu thoải mái.",
      "Quay lại khi bạn sẵn sàng.",
    ],
    difficulty: "easy",
    energy_level: "low",
    time_of_day: ["any"],
    enabled: true,
  },
  {
    id: "kindness",
    title: "Một lời dịu dàng",
    description: "Thử nói với mình như nói với một người bạn.",
    duration: 120,
    category: "self_compassion",
    steps: [
      "Nhận ra điều hôm nay khiến bạn mệt.",
      "Thử nói: Mình đã cố gắng trong khả năng của mình.",
      "Không cần ép bản thân tin ngay.",
    ],
    difficulty: "easy",
    energy_level: "low",
    time_of_day: ["any"],
    enabled: true,
  },
  {
    id: "stretch",
    title: "Thả lỏng đôi vai",
    description: "Nhẹ nhàng nhận biết cơ thể.",
    duration: 120,
    category: "stretching",
    steps: [
      "Chọn tư thế dễ chịu.",
      "Thả lỏng vai, cử động nhẹ trong giới hạn thoải mái.",
      "Dừng nếu thấy đau hay khó chịu.",
    ],
    difficulty: "easy",
    energy_level: "low",
    time_of_day: ["any"],
    enabled: true,
  },
];
