import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Activity,
  AccountDataExport,
  AskMoriResponse,
  ChatResult,
  Conversation,
  ConversationMode,
  Garden,
  Journal,
  Letter,
  LifeMapItem,
  LifeMapSuggestion,
  LifePatternsResponse,
  Memory,
  MemorySource,
  Message,
  Mood,
  NotificationPreference,
  Profile,
  PrivateChatResult,
  RitualEntry,
  SoftGoal,
  PATTERN_DISCLAIMER,
  TimelineFilter,
  TimelineItem,
  activities,
  gardenFromPoints,
  journalSchema,
  letterCreateSchema,
  letterUpdateSchema,
  lifeMapSchema,
  lifeMapSuggestionSchema,
  memorySchema,
  messageSchema,
  moodSchema,
  notificationSchema,
  profileSchema,
  privateMessageSchema,
  savePrivateConversationSchema,
  createSoftGoalSchema,
  updateSoftGoalSchema,
  ritualEntrySchema,
  askMoriSchema,
} from "@mori/shared";
import { newId } from "../lib/id";
type DemoData = {
  profile: Profile;
  moods: Mood[];
  journals: Journal[];
  memories: Memory[];
  memorySources: (MemorySource & { memory_id: string; user_id: string })[];
  conversations: Conversation[];
  messages: Message[];
  garden: Garden;
  awards: string[];
  sessions: {
    id: string;
    activity_id: string;
    completed: boolean;
    created_at: string;
    completed_at?: string;
  }[];
  gardenMilestones: { id: string; action_key: string; created_at: string }[];
  gardenUnlocks: {
    id: string;
    feature_key: Garden["sanctuary_areas"][number];
    unlocked_at: string;
    source_type: string;
    source_id: string | null;
  }[];
  notifications: NotificationPreference;
  lifeMapItems: LifeMapItem[];
  ritualEntries: RitualEntry[];
  letters: Letter[];
  softGoals: SoftGoal[];
};
const entity = () => ({
  id: newId(),
  user_id: "demo",
  created_at: new Date().toISOString(),
});
const initial = (): DemoData => ({
  profile: {
    display_name: "Bạn",
    goals: [],
    companion_style: "gentle",
    locale: "vi",
    onboarded: false,
    weekly_reflection_enabled: false,
  },
  moods: [],
  journals: [],
  memories: [],
  memorySources: [],
  conversations: [],
  messages: [],
  garden: gardenFromPoints(0),
  awards: [],
  sessions: [],
  gardenMilestones: [],
  gardenUnlocks: [],
  notifications: {
    period: "off",
    hour: 20,
    minute: 0,
    timezone: "Asia/Ho_Chi_Minh",
    morning_enabled: false,
    morning_hour: 8,
    morning_minute: 0,
    evening_enabled: false,
    evening_hour: 20,
    evening_minute: 0,
  },
  lifeMapItems: [],
  ritualEntries: [],
  letters: [],
  softGoals: [],
});
let database: DemoData | undefined;
async function get() {
  if (!database) {
    const stored = await AsyncStorage.getItem("mori-demo");
    database = stored ? (JSON.parse(stored) as DemoData) : initial();
    database.lifeMapItems ??= [];
    database.memorySources ??= [];
    database.gardenMilestones ??= [];
    database.gardenUnlocks ??= [];
    database.ritualEntries ??= [];
    database.letters ??= [];
    database.softGoals ??= [];
    const legacyNotifications =
      database.notifications as Partial<NotificationPreference>;
    database.notifications = notificationSchema.parse({
      ...legacyNotifications,
      morning_enabled:
        legacyNotifications.morning_enabled ??
        legacyNotifications.period === "morning",
      morning_hour:
        legacyNotifications.morning_hour ??
        (legacyNotifications.period === "morning"
          ? legacyNotifications.hour
          : undefined),
      morning_minute:
        legacyNotifications.morning_minute ??
        (legacyNotifications.period === "morning"
          ? legacyNotifications.minute
          : undefined),
      evening_enabled:
        legacyNotifications.evening_enabled ??
        legacyNotifications.period === "evening",
      evening_hour:
        legacyNotifications.evening_hour ??
        (legacyNotifications.period === "evening"
          ? legacyNotifications.hour
          : undefined),
      evening_minute:
        legacyNotifications.evening_minute ??
        (legacyNotifications.period === "evening"
          ? legacyNotifications.minute
          : undefined),
    });
  }
  return database;
}
function award(db: DemoData, key: string) {
  if (!db.awards.includes(key)) {
    db.awards.push(key);
    db.gardenMilestones.push({
      id: newId(),
      action_key: key,
      created_at: new Date().toISOString(),
    });
    db.garden = gardenFromPoints(db.garden.growth_points + 1);
    db.garden.sanctuary_areas = [
      ...new Set([
        ...db.garden.sanctuary_areas,
        ...db.gardenUnlocks.map((unlock) => unlock.feature_key),
      ]),
    ];
  }
}
function unlock(
  db: DemoData,
  feature: Garden["sanctuary_areas"][number],
  sourceType: string,
  sourceId: string | null = null,
) {
  if (!db.gardenUnlocks.some((item) => item.feature_key === feature))
    db.gardenUnlocks.push({
      id: newId(),
      feature_key: feature,
      unlocked_at: new Date().toISOString(),
      source_type: sourceType,
      source_id: sourceId,
    });
  if (!db.garden.sanctuary_areas.includes(feature))
    db.garden.sanctuary_areas.push(feature);
}
const record = (input: unknown) => input as Record<string, unknown>;
const withoutOwner = <T extends { user_id?: string }>(value: T) => {
  const { user_id: _userId, ...safe } = value;
  return safe;
};
export async function demoRequest(
  path: string,
  method: string,
  body?: unknown,
): Promise<unknown> {
  const db = await get();
  const [route, query = ""] = path.replace(/^\//, "").split("?");
  const [resource, id, action] = route.split("/");
  const queryParams = new URLSearchParams(query);
  let result: unknown;
  if (resource === "profile" || resource === "auth") {
    if (method === "GET") return db.profile;
    db.profile = { ...db.profile, ...profileSchema.partial().parse(body) };
    result = db.profile;
  } else if (resource === "moods") {
    if (method === "GET") return db.moods;
    const value = moodSchema.parse(body);
    const mood = db.moods.find((m) => m.client_id === value.client_id) ?? {
      ...entity(),
      ...value,
    };
    if (!db.moods.some((m) => m.id === mood.id)) db.moods.unshift(mood);
    award(db, `mood:${mood.id}`);
    result = mood;
  } else if (resource === "garden") return db.garden;
  else if (resource === "journals") {
    if (method === "GET") return db.journals;
    if (method === "DELETE") {
      db.journals = id ? db.journals.filter((j) => j.id !== id) : [];
      result = { ok: true };
    } else if (method === "PATCH") {
      const journal = db.journals.find((j) => j.id === id);
      if (!journal) throw new Error("Không tìm thấy trang viết.");
      Object.assign(
        journal,
        journalSchema.omit({ client_id: true }).partial().parse(body),
      );
      result = journal;
    } else {
      const value = journalSchema.parse(body);
      const entry = db.journals.find(
        (j) => j.client_id === value.client_id,
      ) ?? { ...entity(), ...value };
      Object.assign(entry, value);
      if (!db.journals.some((j) => j.id === entry.id))
        db.journals.unshift(entry);
      award(db, `journal:${entry.id}`);
      unlock(db, "reflection_lake", "journal", entry.id);
      result = entry;
    }
  } else if (resource === "letters") {
    const active = () => db.letters.filter((letter) => !letter.deleted_at);
    const find = () => active().find((letter) => letter.id === id);
    if (method === "GET" && !id) {
      return active().map(
        ({
          user_id: _user,
          content: _content,
          client_id: _client,
          ...item
        }) => ({
          ...item,
          status: item.opened_at
            ? ("opened" as const)
            : Date.parse(item.open_at) <= Date.now()
              ? ("ready" as const)
              : ("upcoming" as const),
        }),
      );
    }
    if (method === "GET" && action === "edit") {
      const item = find();
      if (!item) throw new Error("Không tìm thấy lá thư.");
      return item;
    }
    if (method === "POST" && action === "open") {
      const item = find();
      if (!item) throw new Error("Không tìm thấy lá thư.");
      if (Date.parse(item.open_at) > Date.now())
        throw new Error("Lá thư này chưa đến ngày mở.");
      item.opened_at ??= new Date().toISOString();
      item.updated_at = new Date().toISOString();
      award(db, `letter-flower:${item.id}`);
      result = item;
    } else if (method === "DELETE") {
      const item = find();
      if (!item) throw new Error("Không tìm thấy lá thư.");
      item.deleted_at = new Date().toISOString();
      item.updated_at = item.deleted_at;
      result = item;
    } else if (method === "PATCH") {
      const item = find();
      if (!item) throw new Error("Không tìm thấy lá thư.");
      if (item.opened_at || Date.parse(item.open_at) <= Date.now())
        throw new Error("Lá thư đã sẵn sàng nên không thể sửa nữa.");
      Object.assign(item, letterUpdateSchema.parse(body), {
        updated_at: new Date().toISOString(),
      });
      result = item;
    } else if (method === "POST" && !id) {
      const value = letterCreateSchema.parse(body);
      if (Date.parse(value.open_at) <= Date.now())
        throw new Error("Hãy chọn một ngày trong tương lai.");
      const existing = value.client_id
        ? active().find((item) => item.client_id === value.client_id)
        : undefined;
      const item: Letter = existing ?? {
        ...entity(),
        ...value,
        updated_at: new Date().toISOString(),
        opened_at: null,
        deleted_at: null,
      };
      if (!existing) db.letters.unshift(item);
      award(db, `letter-seed:${item.id}`);
      unlock(db, "letter_tree", "letter", item.id);
      result = item;
    }
  } else if (resource === "memories") {
    if (method === "GET")
      return db.memories.map((memory) => ({
        ...memory,
        memory_sources: db.memorySources.filter(
          (source) => source.memory_id === memory.id,
        ),
      }));
    if (method === "DELETE") {
      const removed = id
        ? new Set([id])
        : new Set(db.memories.map((memory) => memory.id));
      db.memories = id ? db.memories.filter((m) => m.id !== id) : [];
      db.memorySources = db.memorySources.filter(
        (source) => !removed.has(source.memory_id),
      );
      result = { ok: true };
    } else if (action === "approve") {
      const memory = db.memories.find((m) => m.id === id);
      if (!memory) throw new Error("Không tìm thấy ký ức.");
      memory.approved_by_user = true;
      memory.approved_at = new Date().toISOString();
      unlock(db, "memory_garden", "memory", memory.id);
      result = memory;
    } else if (method === "PATCH") {
      const memory = db.memories.find((m) => m.id === id);
      if (!memory) throw new Error("Không tìm thấy ký ức.");
      Object.assign(memory, memorySchema.parse(body));
      result = memory;
    } else {
      const memory: Memory = {
        ...entity(),
        ...memorySchema.parse(body),
        approved_by_user: true,
        approved_at: new Date().toISOString(),
        confidence: 1,
      };
      db.memories.unshift(memory);
      db.memorySources.unshift({
        ...entity(),
        memory_id: memory.id,
        source_type: "manual",
        source_id: null,
        reason: "Được bạn trực tiếp thêm vào ký ức của Mori.",
      });
      unlock(db, "memory_garden", "memory", memory.id);
      result = memory;
    }
  } else if (resource === "private-conversations") {
    if (id === "messages") {
      const value = privateMessageSchema.parse(body);
      const folded = value.content
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d");
      const crisis =
        /(tu tu|muon chet|khong muon song|kill myself|suicid|tu sat|giet nguoi|hurt someone)/.test(
          folded,
        );
      return {
        message: {
          id: value.client_id,
          role: "assistant",
          content: crisis
            ? "Điều bạn chia sẻ nghe rất nghiêm trọng. Nếu đang gặp nguy hiểm ngay lúc này, hãy liên hệ dịch vụ cấp cứu tại nơi bạn sống hoặc một người bạn tin tưởng. Bạn có đang an toàn ngay lúc này không?"
            : "Mình đang lắng nghe. Điều gì trong chuyện này đang ở lại với bạn nhiều nhất?",
        },
        safetyLevel: crisis ? "crisis" : "normal",
      } satisfies PrivateChatResult;
    }
    if (id === "save") {
      const value = savePrivateConversationSchema.parse(body);
      const conversation: Conversation = {
        ...entity(),
        title: "Một cuộc trò chuyện riêng đã lưu",
        mode: value.mode,
      };
      db.conversations.unshift(conversation);
      db.messages.push(
        ...value.messages.map((message): Message => ({
          ...entity(),
          conversation_id: conversation.id,
          role: message.role,
          content: message.content,
          client_id: message.id,
          safety_level: "normal",
        })),
      );
      result = conversation;
    }
  } else if (resource === "conversations") {
    if (method === "GET") {
      return id
        ? {
            conversation: db.conversations.find((c) => c.id === id),
            messages: db.messages.filter((m) => m.conversation_id === id),
          }
        : db.conversations;
    }
    if (method === "DELETE") {
      db.conversations = id ? db.conversations.filter((c) => c.id !== id) : [];
      db.messages = id
        ? db.messages.filter((m) => m.conversation_id !== id)
        : [];
      result = { ok: true };
    } else if (action === "journal-draft") {
      const text = db.messages
        .filter((m) => m.conversation_id === id && m.role === "user")
        .map((m) => m.content)
        .join("\n\n");
      result = {
        title: "Một khoảng lắng nghe",
        content: text,
        source: "conversation",
        saved: false,
      };
    } else if (action === "messages") {
      const value = messageSchema.parse(body);
      const previous = db.messages.find(
        (m) => m.client_id === value.client_id && m.role === "assistant",
      );
      if (previous)
        return {
          message: previous,
          safetyLevel: previous.safety_level ?? "normal",
        };
      const t = value.content
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d");
      const crisis =
        /(tu tu|muon chet|khong muon song|kill myself|suicid|tu sat|giet nguoi|hurt someone)/.test(
          t,
        );
      let content = crisis
        ? "Điều bạn chia sẻ nghe rất nghiêm trọng. Nếu đang gặp nguy hiểm ngay lúc này, hãy liên hệ dịch vụ cấp cứu tại nơi bạn sống hoặc đến cơ sở cấp cứu gần nhất. Nếu có thể, hãy liên hệ một người bạn tin tưởng để họ ở bên bạn. Bạn có đang an toàn ngay lúc này không?"
        : value.mode === "think"
          ? "Nghe như chuyện này đang lấy khá nhiều năng lượng của bạn. Nếu muốn, mình cùng chọn một điều nhỏ trong tầm tay hôm nay nhé. Điều gì bạn muốn ưu tiên?"
          : value.mode === "understand"
            ? "Có vẻ nhiều cảm xúc đang đến cùng một lúc. Điều gì trong chuyện này chạm đến bạn nhiều nhất?"
            : "Mình đang lắng nghe. Nghe như hôm nay không thật dễ dàng với bạn.\n\nBạn có thể kể thêm nếu muốn, không cần vội tìm ra câu trả lời.";
      if (!crisis && /(vui|happy|thanh cong)/.test(t))
        content =
          "Nghe như đây là một khoảnh khắc thật đáng trân trọng. Bạn có thể dành một chút thời gian tận hưởng điều đó.";
      if (!crisis && /(chi co ban hieu|only you understand)/.test(t))
        content =
          "Thật tốt khi nơi này giúp bạn cảm thấy được lắng nghe. Bạn cũng xứng đáng có những người ngoài đời mà bạn có thể dựa vào khi cần.";
      if (db.profile.locale === "en")
        content = crisis
          ? "What you shared sounds serious. If you are in immediate danger, contact local emergency services or the nearest emergency department. If possible, reach someone you trust who can stay with you. Are you safe right now?"
          : value.mode === "think"
            ? "It sounds like this is taking a lot of your energy. If you would like, we can think through one small thing within your control. What would you like to focus on?"
            : value.mode === "understand"
              ? "It sounds like several feelings are arriving at once. Which part of this feels most significant to you?"
              : "I am listening. It sounds like today has not been easy.\n\nYou can share more if you would like. There is no rush to find an answer.";
      const message: Message = {
        ...entity(),
        conversation_id: id,
        role: "assistant",
        content,
        client_id: value.client_id,
        safety_level: crisis ? "crisis" : "normal",
      };
      db.messages.push(
        {
          ...entity(),
          conversation_id: id,
          role: "user",
          content: value.content,
          client_id: value.client_id,
        },
        message,
      );
      let memory: Memory | undefined;
      if (!crisis && /(chi.*lang nghe|khong.*loi khuyen|just listen)/.test(t)) {
        memory = {
          ...entity(),
          content: "Bạn muốn Mori lắng nghe, chỉ đưa lời khuyên khi được hỏi.",
          category: "communication_preference",
          approved_by_user: false,
          approved_at: null,
          confidence: 1,
        };
        db.memories.unshift(memory);
        db.memorySources.unshift({
          ...entity(),
          memory_id: memory.id,
          source_type: "conversation",
          source_id: id,
          reason:
            "Bạn đã nói rõ cách Mori nên phản hồi trong cuộc trò chuyện này.",
        });
      }
      result = {
        message,
        memory,
        safetyLevel: crisis ? "crisis" : "normal",
        activity:
          !crisis &&
          value.mode === "think" &&
          /(thu gian|self.care|breath|bai tho)/.test(t)
            ? activities[0]
            : undefined,
      } satisfies ChatResult;
    } else {
      const conversation: Conversation = {
        ...entity(),
        title: "Một khoảng lắng nghe",
        mode: ConversationMode.parse(record(body).mode ?? "listen"),
      };
      db.conversations.unshift(conversation);
      result = conversation;
    }
  } else if (resource === "soft-goals") {
    const find = () => db.softGoals.find((goal) => goal.id === id);
    if (method === "GET") return db.softGoals;
    if (method === "POST" && !id) {
      const parsed = createSoftGoalSchema.parse(body);
      const value = {
        ...parsed,
        note: parsed.note ?? "",
        source_type: parsed.source_type ?? ("manual" as const),
        source_id: parsed.source_id ?? null,
      };
      const existing = db.softGoals.find(
        (goal) => goal.client_id === value.client_id,
      );
      if (existing) return existing;
      if (db.softGoals.filter((goal) => goal.status === "active").length >= 5)
        throw new Error(
          "Bạn đang giữ vài điều nhỏ rồi. Có thể hoàn thành hoặc cất bớt một điều trước khi thêm mới.",
        );
      const goal: SoftGoal = {
        ...entity(),
        ...value,
        status: "active",
        updated_at: new Date().toISOString(),
        completed_at: null,
        archived_at: null,
      };
      db.softGoals.unshift(goal);
      result = goal;
    } else if (method === "PATCH") {
      const goal = find();
      if (!goal || goal.status !== "active")
        throw new Error("Không tìm thấy ý định đang giữ.");
      Object.assign(goal, updateSoftGoalSchema.parse(body), {
        updated_at: new Date().toISOString(),
      });
      result = goal;
    } else if (method === "POST" && action === "complete") {
      const goal = find();
      if (!goal || goal.status === "archived")
        throw new Error("Không tìm thấy ý định đang giữ.");
      if (goal.status === "active") {
        goal.status = "completed";
        goal.completed_at = new Date().toISOString();
        goal.updated_at = goal.completed_at;
      }
      award(db, `soft-goal:${goal.id}`);
      unlock(db, "path_stones", "soft_goal", goal.id);
      result = goal;
    } else if (method === "POST" && action === "archive") {
      const goal = find();
      if (!goal) throw new Error("Không tìm thấy ý định này.");
      goal.status = "archived";
      goal.completed_at = null;
      goal.archived_at = new Date().toISOString();
      goal.updated_at = goal.archived_at;
      result = goal;
    } else if (method === "DELETE") {
      db.softGoals = db.softGoals.filter((goal) => goal.id !== id);
      result = { ok: true };
    }
  } else if (resource === "self-care") {
    if (method === "GET") return activities;
    if (!activities.some((a) => a.id === id))
      throw new Error("Không tìm thấy hoạt động.");
    if (action === "start") {
      const session = {
        id: newId(),
        activity_id: id,
        completed: false,
        created_at: new Date().toISOString(),
      };
      db.sessions.push(session);
      result = session;
    } else {
      const session = db.sessions.find(
        (s) => s.id === record(body).session_id && s.activity_id === id,
      );
      if (!session) throw new Error("Không tìm thấy lượt thực hiện.");
      session.completed = true;
      session.completed_at = new Date().toISOString();
      award(db, `selfcare:${session.id}`);
      if (id === "breathing")
        unlock(db, "wind_chimes", "self_care", session.id);
      result = { ok: true };
    }
  } else if (resource === "rituals") {
    if (method === "GET") return db.ritualEntries;
    const value = ritualEntrySchema.parse(body);
    const existing = db.ritualEntries.find(
      (entry) => entry.client_id === value.client_id,
    );
    if (existing) result = existing;
    else {
      const entry: RitualEntry = { ...entity(), ...value };
      db.ritualEntries.unshift(entry);
      award(db, `ritual:${entry.id}`);
      result = entry;
    }
  } else if (resource === "notification-preferences") {
    if (method === "GET") return db.notifications;
    db.notifications = notificationSchema.parse(body);
    result = db.notifications;
  } else if (resource === "first-aid" && id === "crisis") {
    return {
      message:
        "Sự an toàn của bạn lúc này là điều cần ưu tiên. Nếu bạn đang gặp nguy hiểm, hãy liên hệ dịch vụ cấp cứu tại nơi bạn sống hoặc đến cơ sở cấp cứu gần nhất. Nếu có thể, hãy tránh xa những thứ có thể gây hại và liên hệ một người bạn tin tưởng để họ ở bên bạn.",
      resources: [],
    };
  } else if (resource === "reflections" && id === "timeline") {
    const filter = TimelineFilter.parse(queryParams.get("filter") ?? "all");
    const moodNames: Record<Mood["mood"], string> = {
      joyful: "Rất vui",
      good: "Khá ổn",
      okay: "Bình thường",
      low: "Hơi buồn",
      overwhelmed: "Quá tải",
    };
    const items: TimelineItem[] = [
      ...db.moods.map((mood) => ({
        id: `mood:${mood.id}`,
        type: "mood" as const,
        title: `Tâm trạng: ${moodNames[mood.mood]}`,
        detail: mood.optional_note || mood.tags.join(" · ") || undefined,
        occurredAt: mood.created_at,
        sourceId: mood.id,
      })),
      ...db.journals
        .filter((journal) => !journal.deleted_at)
        .map((journal) => ({
          id: `journal:${journal.id}`,
          type: "journal" as const,
          title: journal.title,
          detail: journal.content.slice(0, 240),
          occurredAt: journal.created_at,
          sourceId: journal.id,
        })),
      ...db.conversations
        .filter((conversation) => !conversation.deleted_at)
        .map((conversation) => ({
          id: `conversation:${conversation.id}`,
          type: "conversation" as const,
          title: conversation.title,
          occurredAt: conversation.created_at,
          sourceId: conversation.id,
        })),
      ...db.sessions
        .filter((session) => session.completed && session.completed_at)
        .map((session) => ({
          id: `self-care:${session.id}`,
          type: "self_care" as const,
          title:
            activities.find((activity) => activity.id === session.activity_id)
              ?.title ?? "Một khoảng chăm sóc bản thân",
          occurredAt: session.completed_at!,
          sourceId: session.id,
        })),
      ...db.lifeMapItems
        .filter(
          (item) =>
            !item.deleted_at &&
            item.approved_by_user &&
            item.type === "important_events",
        )
        .map((item) => ({
          id: `important-event:${item.id}`,
          type: "important_event" as const,
          title: item.title,
          detail: item.description || undefined,
          occurredAt: item.created_at,
          sourceId: item.id,
        })),
      ...db.gardenMilestones.flatMap((milestone, index) => {
        const titles: Record<number, string> = {
          5: "Hoa đã xuất hiện trong khu vườn",
          12: "Đom đóm và mặt hồ đã xuất hiện",
          25: "Ghế nhỏ và ánh trăng đã xuất hiện",
        };
        const title = titles[index + 1];
        return title
          ? [
              {
                id: `garden:${milestone.id}`,
                type: "garden_milestone" as const,
                title,
                occurredAt: milestone.created_at,
                sourceId: milestone.id,
              },
            ]
          : [];
      }),
    ];
    return items
      .filter((item) =>
        filter === "all"
          ? true
          : filter === "important_moment"
            ? ["important_event", "garden_milestone", "letter"].includes(
                item.type,
              )
            : item.type === filter,
      )
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
      .slice(0, 100);
  } else if (resource === "weekly-reflection") {
    const since = Date.now() - 7 * 86400000;
    if (method === "POST" && id === "complete") {
      if (!db.profile.weekly_reflection_enabled)
        throw new Error("Nhìn lại tuần đang tắt.");
      const week = new Date();
      week.setUTCDate(week.getUTCDate() - ((week.getUTCDay() + 6) % 7));
      award(db, `weekly:${week.toISOString().slice(0, 10)}`);
      unlock(db, "fireflies", "weekly_reflection");
      await AsyncStorage.setItem("mori-demo", JSON.stringify(db));
      return { ok: true };
    }
    return {
      enabled: db.profile.weekly_reflection_enabled,
      content: db.profile.weekly_reflection_enabled
        ? db.profile.locale === "en"
          ? `In the last 7 days, you checked in ${db.moods.filter((m) => Date.parse(m.created_at) > since).length} times.\n\nWhat would you like to carry into next week?`
          : `Trong 7 ngày qua, bạn đã ghé lại với mình ${db.moods.filter((m) => Date.parse(m.created_at) > since).length} lần.\n\nBạn muốn mang theo điều gì vào tuần tới?`
        : null,
    };
  } else if (resource === "life-map") {
    if (method === "GET" && id === "suggestions") {
      const existing = new Set(
        db.lifeMapItems.map((item) => item.source_id).filter(Boolean),
      );
      const mapType = (category: Memory["category"]): LifeMapItem["type"] =>
        category === "relationship"
          ? "people"
          : category === "goal"
            ? "goals"
            : category === "life_event"
              ? "important_events"
              : category === "self_care_preference"
                ? "helpful_things"
                : "preferences";
      return db.memories
        .filter(
          (memory) =>
            memory.approved_by_user &&
            !memory.deleted_at &&
            !existing.has(memory.id),
        )
        .slice(0, 5)
        .map(
          (memory) =>
            ({
              type: mapType(memory.category),
              title: memory.content.slice(0, 120),
              description:
                "Được đề xuất từ một ký ức bạn đã cho phép Mori dùng.",
              source_type: "memory",
              source_id: memory.id,
            }) satisfies LifeMapSuggestion,
        );
    }
    if (method === "GET")
      return db.lifeMapItems.filter((item) => !item.deleted_at);
    if (method === "DELETE") {
      const item = db.lifeMapItems.find((entry) => entry.id === id);
      if (!item) throw new Error("Không tìm thấy mục này.");
      item.deleted_at = new Date().toISOString();
      result = { ok: true };
    } else if (action === "approve") {
      const item = db.lifeMapItems.find((entry) => entry.id === id);
      if (!item) throw new Error("Không tìm thấy mục này.");
      item.approved_by_user = true;
      result = item;
    } else if (method === "PATCH") {
      const item = db.lifeMapItems.find((entry) => entry.id === id);
      if (!item) throw new Error("Không tìm thấy mục này.");
      Object.assign(item, lifeMapSchema.parse(body), {
        updated_at: new Date().toISOString(),
      });
      result = item;
    } else {
      const suggestion = id === "suggestions";
      const suggestionValue = suggestion
        ? lifeMapSuggestionSchema.parse(body)
        : null;
      const value = suggestionValue ?? lifeMapSchema.parse(body);
      if (
        suggestion &&
        !db.memories.some(
          (memory) =>
            memory.id === suggestionValue?.source_id &&
            memory.approved_by_user &&
            !memory.deleted_at,
        )
      )
        throw new Error("Nguồn đề xuất không còn khả dụng.");
      const item: LifeMapItem = {
        ...entity(),
        ...value,
        source_type: suggestion ? "memory" : null,
        source_id: suggestionValue?.source_id ?? null,
        approved_by_user: true,
      };
      db.lifeMapItems.unshift(item);
      result = item;
    }
  } else if (resource === "insights" && id === "patterns") {
    const workMoods = db.moods.filter((mood) => mood.tags.includes("Work"));
    const patterns: LifePatternsResponse["patterns"] = [];
    if (workMoods.length >= 5)
      patterns.push({
        id: "topic:work",
        type: "recurring_topic",
        title: "Chủ đề xuất hiện nhiều lần",
        observation: `Công việc xuất hiện trong ${workMoods.length} ghi chép gần đây của bạn.`,
        evidenceCount: workMoods.length,
        sources: workMoods.slice(0, 7).map((mood) => ({
          id: mood.id,
          type: "mood",
          label: "Tâm trạng",
          occurredAt: mood.created_at,
        })),
      });
    const completed = db.sessions.filter(
      (session) => session.completed && session.completed_at,
    );
    const byActivity = completed.reduce<Record<string, typeof completed>>(
      (groups, session) => ({
        ...groups,
        [session.activity_id]: [
          ...(groups[session.activity_id] ?? []),
          session,
        ],
      }),
      {},
    );
    const frequent = Object.entries(byActivity).find(
      ([, sessions]) => sessions.length >= 5,
    );
    if (frequent) {
      const [activityId, sessions] = frequent;
      patterns.push({
        id: `activity:${activityId}`,
        type: "helpful_activity",
        title: "Hoạt động bạn thường chọn",
        observation: `${activities.find((activity) => activity.id === activityId)?.title ?? activityId} xuất hiện ${sessions.length} lần trong lịch sử chăm sóc bản thân của bạn.`,
        evidenceCount: sessions.length,
        sources: sessions.slice(0, 7).map((session) => ({
          id: session.id,
          type: "self_care",
          label: "Chăm sóc bản thân",
          occurredAt: session.completed_at!,
        })),
      });
    }
    return {
      patterns,
      message: patterns.length ? null : "There's not enough information yet.",
      disclaimer: PATTERN_DISCLAIMER,
    } satisfies LifePatternsResponse;
  } else if (resource === "insights" && id === "ask") {
    const { question } = askMoriSchema.parse(body);
    const folded = question
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d");
    if (
      /(tu tu|tu sat|muon chet|khong muon song|kill myself|suicid)/.test(folded)
    ) {
      return {
        answer:
          "Điều bạn vừa chia sẻ nghe rất nghiêm trọng. Nếu bạn có thể hành động ngay hoặc đang gặp nguy hiểm, hãy liên hệ dịch vụ cấp cứu tại nơi bạn sống hoặc đến cơ sở cấp cứu gần nhất. Nếu có thể, hãy liên hệ một người bạn tin tưởng để họ ở bên bạn. Bạn có đang gặp nguy hiểm ngay lúc này không?",
        sources: [],
        safetyLevel: "crisis",
      } satisfies AskMoriResponse;
    }
    const candidates = [
      ...db.memories
        .filter((memory) => memory.approved_by_user && !memory.deleted_at)
        .map((memory) => ({
          id: memory.id,
          type: "memory" as const,
          label: "Ký ức",
          occurredAt: memory.created_at,
          text: memory.content,
        })),
      ...db.journals
        .filter((journal) => !journal.deleted_at)
        .map((journal) => ({
          id: journal.id,
          type: "journal" as const,
          label: "Nhật ký",
          occurredAt: journal.created_at,
          text: `${journal.title} ${journal.content}`,
        })),
      ...db.moods.map((mood) => ({
        id: mood.id,
        type: "mood" as const,
        label: "Tâm trạng",
        occurredAt: mood.created_at,
        text: `${mood.mood} ${mood.tags.join(" ")} ${mood.optional_note}`,
      })),
      ...db.conversations
        .filter((conversation) => !conversation.deleted_at)
        .map((conversation) => ({
          id: conversation.id,
          type: "conversation" as const,
          label: "Trò chuyện",
          occurredAt: conversation.created_at,
          text: conversation.title,
        })),
      ...db.sessions
        .filter((session) => session.completed)
        .map((session) => ({
          id: session.id,
          type: "self_care" as const,
          label: "Chăm sóc bản thân",
          occurredAt: new Date().toISOString(),
          text: session.activity_id,
        })),
    ];
    const tokens = folded.split(/[^a-z0-9]+/).filter((word) => word.length > 2);
    const ranked = candidates
      .map((candidate) => ({
        ...candidate,
        score: tokens.filter((word) =>
          candidate.text
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .includes(word),
        ).length,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    const sources = ranked.map(
      ({ text: _text, score: _score, ...source }) => source,
    );
    return {
      answer: sources.length
        ? `Mình tìm thấy ${sources.length} khoảnh khắc có liên quan trong dữ liệu bạn đã lưu. Đây là quan sát từ các ghi chép của bạn, không phải bằng chứng về nguyên nhân.`
        : "Mình chưa có đủ thông tin liên quan trong những điều bạn đã lưu.",
      sources,
      safetyLevel: "normal",
    } satisfies AskMoriResponse;
  } else if (resource === "account" && id === "export") {
    const accountExport: AccountDataExport = {
      schemaVersion: 5,
      generatedAt: new Date().toISOString(),
      data: {
        profile: { ...db.profile },
        moods: db.moods.map(withoutOwner),
        journals: db.journals.map(withoutOwner),
        memories: db.memories.map(
          ({ embedding: _embedding, confidence: _confidence, ...memory }) =>
            withoutOwner(memory),
        ),
        conversations: db.conversations.map(withoutOwner),
        messages: db.messages.map(({ safety_level: _safety, ...message }) =>
          withoutOwner(message),
        ),
        selfCareHistory: db.sessions.map((session) => ({ ...session })),
        garden: { ...db.garden },
        weeklyReflections: [],
        notificationPreferences: { ...db.notifications },
        lifeMapItems: db.lifeMapItems.map(withoutOwner),
        memorySources: db.memorySources.map(withoutOwner),
        ritualEntries: db.ritualEntries.map(withoutOwner),
        letters: db.letters.map(withoutOwner),
      },
    };
    return accountExport;
  } else if (resource === "account") {
    database = initial();
    await AsyncStorage.removeItem("mori-demo");
    return { ok: true };
  } else throw new Error("Chức năng này chưa có trong bản demo.");
  await AsyncStorage.setItem("mori-demo", JSON.stringify(db));
  return result;
}
export async function loadDemoSamples() {
  const db = await get();
  const past = (days: number) =>
    new Date(Date.now() - days * 86400000).toISOString();
  db.moods = ["good", "low", "okay", "joyful", "good", "okay"].map(
    (mood, i) => ({
      ...entity(),
      created_at: past(i + 1),
      mood: mood as Mood["mood"],
      intensity: 0.5,
      tags: ["Work"],
      optional_note: "Dữ liệu mẫu",
      client_id: newId(),
    }),
  );
  db.journals = [
    {
      ...entity(),
      created_at: past(1),
      title: "Một buổi sáng chậm",
      content:
        "Hôm nay mình dành một chút thời gian bên ô cửa. Có những điều nhỏ thôi, nhưng đủ làm một ngày dịu hơn.",
      source: "manual",
      client_id: newId(),
    },
    {
      ...entity(),
      created_at: past(3),
      title: "Cho mình một khoảng nghỉ",
      content:
        "Không cần làm mọi điều trong cùng một ngày. Mình muốn nhớ điều đó.",
      source: "manual",
      client_id: newId(),
    },
  ];
  const sampleMemory: Memory = {
    ...entity(),
    content: "Bạn thích những khoảng lặng bên cửa sổ.",
    category: "preference",
    approved_by_user: true,
    approved_at: past(2),
    confidence: 1,
  };
  db.memories = [sampleMemory];
  db.memorySources = [
    {
      ...entity(),
      memory_id: sampleMemory.id,
      source_type: "manual",
      source_id: null,
      reason: "Được bạn trực tiếp thêm vào ký ức của Mori.",
      created_at: past(2),
    },
  ];
  db.garden = gardenFromPoints(12);
  await AsyncStorage.setItem("mori-demo", JSON.stringify(db));
}
export const demoGardenStates = [
  gardenFromPoints(0),
  gardenFromPoints(8),
  gardenFromPoints(25),
];
export type { Activity };
