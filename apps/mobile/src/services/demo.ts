import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Activity,
  AccountDataExport,
  ChatResult,
  Conversation,
  ConversationMode,
  Garden,
  Journal,
  Memory,
  Message,
  Mood,
  NotificationPreference,
  Profile,
  activities,
  gardenFromPoints,
  journalSchema,
  memorySchema,
  messageSchema,
  moodSchema,
  notificationSchema,
  profileSchema,
} from "@mori/shared";
import { newId } from "../lib/id";
type DemoData = {
  profile: Profile;
  moods: Mood[];
  journals: Journal[];
  memories: Memory[];
  conversations: Conversation[];
  messages: Message[];
  garden: Garden;
  awards: string[];
  sessions: { id: string; activity_id: string; completed: boolean }[];
  notifications: NotificationPreference;
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
  conversations: [],
  messages: [],
  garden: gardenFromPoints(0),
  awards: [],
  sessions: [],
  notifications: {
    period: "off",
    hour: 20,
    minute: 0,
    timezone: "Asia/Ho_Chi_Minh",
  },
});
let database: DemoData | undefined;
async function get() {
  if (!database) {
    const stored = await AsyncStorage.getItem("mori-demo");
    database = stored ? (JSON.parse(stored) as DemoData) : initial();
  }
  return database;
}
function award(db: DemoData, key: string) {
  if (!db.awards.includes(key)) {
    db.awards.push(key);
    db.garden = gardenFromPoints(db.garden.growth_points + 1);
  }
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
  const [resource, id, action] = path.replace(/^\//, "").split("/");
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
      result = entry;
    }
  } else if (resource === "memories") {
    if (method === "GET") return db.memories;
    if (method === "DELETE") {
      db.memories = id ? db.memories.filter((m) => m.id !== id) : [];
      result = { ok: true };
    } else if (action === "approve") {
      const memory = db.memories.find((m) => m.id === id);
      if (!memory) throw new Error("Không tìm thấy ký ức.");
      memory.approved_by_user = true;
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
        confidence: 1,
      };
      db.memories.unshift(memory);
      result = memory;
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
          confidence: 1,
        };
        db.memories.unshift(memory);
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
  } else if (resource === "self-care") {
    if (method === "GET") return activities;
    if (!activities.some((a) => a.id === id))
      throw new Error("Không tìm thấy hoạt động.");
    if (action === "start") {
      const session = { id: newId(), activity_id: id, completed: false };
      db.sessions.push(session);
      result = session;
    } else {
      const session = db.sessions.find(
        (s) => s.id === record(body).session_id && s.activity_id === id,
      );
      if (!session) throw new Error("Không tìm thấy lượt thực hiện.");
      session.completed = true;
      award(db, `selfcare:${session.id}`);
      result = { ok: true };
    }
  } else if (resource === "notification-preferences") {
    if (method === "GET") return db.notifications;
    db.notifications = notificationSchema.parse(body);
    result = db.notifications;
  } else if (resource === "weekly-reflection") {
    const since = Date.now() - 7 * 86400000;
    if (method === "POST" && id === "complete") {
      if (!db.profile.weekly_reflection_enabled)
        throw new Error("Nhìn lại tuần đang tắt.");
      const week = new Date();
      week.setUTCDate(week.getUTCDate() - ((week.getUTCDay() + 6) % 7));
      award(db, `weekly:${week.toISOString().slice(0, 10)}`);
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
  } else if (resource === "account" && id === "export") {
    const accountExport: AccountDataExport = {
      schemaVersion: 1,
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
  db.moods = ["good", "low", "okay", "joyful"].map((mood, i) => ({
    ...entity(),
    created_at: past(i + 1),
    mood: mood as Mood["mood"],
    intensity: 0.5,
    tags: ["Work"],
    optional_note: "Dữ liệu mẫu",
    client_id: newId(),
  }));
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
  db.memories = [
    {
      ...entity(),
      content: "Bạn thích những khoảng lặng bên cửa sổ.",
      category: "preference",
      approved_by_user: true,
      confidence: 1,
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
