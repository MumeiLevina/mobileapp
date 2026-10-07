import { z } from "zod";

export const GuidedJournalCategory = z.enum([
  "evening",
  "morning",
  "heavy_moment",
  "feeling_lost",
  "study_pressure",
  "work_pressure",
  "relationships",
  "self_understanding",
  "after_difficulty",
  "gratitude",
]);

export const guidedJournalPromptSchema = z.object({
  id: z.string().min(1),
  vi: z.string().min(1),
  en: z.string().min(1),
});

export const guidedJournalTemplateSchema = z.object({
  id: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  titleVi: z.string().min(1),
  titleEn: z.string().min(1),
  descriptionVi: z.string().min(1),
  descriptionEn: z.string().min(1),
  category: GuidedJournalCategory,
  estimatedMinutes: z.number().int().min(1).max(30),
  prompts: z.array(guidedJournalPromptSchema).min(1).max(8),
  enabled: z.boolean(),
  sortOrder: z.number().int().min(0),
});

export type GuidedJournalCategory = z.infer<typeof GuidedJournalCategory>;
export type GuidedJournalTemplate = z.infer<typeof guidedJournalTemplateSchema>;

export const guidedJournalLibraryVersion = 1;

export const guidedJournalTemplates: readonly GuidedJournalTemplate[] = [
  {
    id: "guided-evening-v1",
    slug: "cuoi-ngay",
    titleVi: "Cuối ngày",
    titleEn: "At the end of the day",
    descriptionVi: "Đặt xuống vài điều trước khi ngày hôm nay khép lại.",
    descriptionEn: "Set down a few thoughts before today comes to a close.",
    category: "evening",
    estimatedMinutes: 3,
    prompts: [
      {
        id: "day-stayed",
        vi: "Điều gì trong hôm nay vẫn còn ở lại với mình?",
        en: "What from today is still staying with me?",
      },
      {
        id: "day-enough",
        vi: "Có điều gì mình đã làm đủ tốt, dù chỉ là một việc nhỏ?",
        en: "What did I do well enough, even if it was something small?",
      },
      {
        id: "day-release",
        vi: "Điều gì mình muốn tạm đặt xuống cho đến ngày mai?",
        en: "What would I like to set down until tomorrow?",
      },
    ],
    enabled: true,
    sortOrder: 10,
  },
  {
    id: "guided-morning-v1",
    slug: "bat-dau-ngay-moi",
    titleVi: "Bắt đầu ngày mới",
    titleEn: "Beginning a new day",
    descriptionVi: "Chọn một nhịp vừa đủ cho ngày đang mở ra.",
    descriptionEn: "Choose a gentle pace for the day ahead.",
    category: "morning",
    estimatedMinutes: 3,
    prompts: [
      {
        id: "morning-feeling",
        vi: "Sáng nay mình đang mang theo cảm giác nào?",
        en: "What feeling am I carrying this morning?",
      },
      {
        id: "morning-important",
        vi: "Điều gì thật sự quan trọng với mình hôm nay?",
        en: "What truly matters to me today?",
      },
      {
        id: "morning-kindness",
        vi: "Một cách nhỏ để mình đối xử dịu dàng với bản thân hôm nay là gì?",
        en: "What is one small way I can be kind to myself today?",
      },
    ],
    enabled: true,
    sortOrder: 20,
  },
  {
    id: "guided-overwhelmed-v1",
    slug: "khi-moi-thu-hoi-nang",
    titleVi: "Khi mọi thứ hơi nặng",
    titleEn: "When things feel heavy",
    descriptionVi: "Tách từng điều ra để mình không phải ôm tất cả cùng lúc.",
    descriptionEn:
      "Separate what is here so I do not have to hold it all at once.",
    category: "heavy_moment",
    estimatedMinutes: 5,
    prompts: [
      {
        id: "heavy-now",
        vi: "Điều gì đang chiếm nhiều chỗ nhất trong tâm trí mình lúc này?",
        en: "What is taking up the most space in my mind right now?",
      },
      {
        id: "heavy-control",
        vi: "Trong những điều đó, điều nào nằm trong khả năng của mình hôm nay?",
        en: "Which part of this is within my reach today?",
      },
      {
        id: "heavy-less",
        vi: "Mình có thể bớt đi, lùi lại hoặc nhờ giúp một điều gì?",
        en: "What could I reduce, postpone, or ask for help with?",
      },
    ],
    enabled: true,
    sortOrder: 30,
  },
  {
    id: "guided-lost-v1",
    slug: "khi-minh-thay-mat-phuong-huong",
    titleVi: "Khi mình thấy mất phương hướng",
    titleEn: "When I feel lost",
    descriptionVi: "Không cần tìm ra cả con đường. Một bước nhỏ là đủ.",
    descriptionEn: "I do not need the whole path. One small step is enough.",
    category: "feeling_lost",
    estimatedMinutes: 5,
    prompts: [
      {
        id: "lost-most",
        vi: "Điều gì đang khiến mình cảm thấy mất phương hướng nhất lúc này?",
        en: "What is making me feel most lost right now?",
      },
      {
        id: "lost-meaning",
        vi: "Có điều gì trước đây từng khiến mình cảm thấy có ý nghĩa hoặc vững vàng hơn?",
        en: "What has helped me feel grounded or connected to meaning before?",
      },
      {
        id: "lost-small-step",
        vi: "Nếu hôm nay không cần giải quyết tất cả, một bước thật nhỏ mình có thể làm là gì?",
        en: "If I do not need to solve everything today, what is one very small step I could take?",
      },
    ],
    enabled: true,
    sortOrder: 40,
  },
  {
    id: "guided-study-v1",
    slug: "ap-luc-hoc-tap",
    titleVi: "Áp lực học tập",
    titleEn: "Study pressure",
    descriptionVi:
      "Nhìn rõ việc cần làm mà không biến điểm số thành giá trị của mình.",
    descriptionEn:
      "See what needs doing without turning results into my worth.",
    category: "study_pressure",
    estimatedMinutes: 5,
    prompts: [
      {
        id: "study-pressure",
        vi: "Điều gì trong việc học đang tạo áp lực cho mình nhất?",
        en: "What part of studying is creating the most pressure for me?",
      },
      {
        id: "study-expectation",
        vi: "Mình đang cố đáp ứng kỳ vọng nào, của mình hay của người khác?",
        en: "Whose expectation am I trying to meet: mine or someone else's?",
      },
      {
        id: "study-next",
        vi: "Việc nhỏ nhất mình có thể bắt đầu trong 15 phút tới là gì?",
        en: "What is the smallest thing I could begin in the next 15 minutes?",
      },
    ],
    enabled: true,
    sortOrder: 50,
  },
  {
    id: "guided-work-v1",
    slug: "ap-luc-cong-viec",
    titleVi: "Áp lực công việc",
    titleEn: "Work pressure",
    descriptionVi: "Gỡ rối điều đang gấp, điều quan trọng và điều có thể chờ.",
    descriptionEn: "Untangle what is urgent, important, and able to wait.",
    category: "work_pressure",
    estimatedMinutes: 5,
    prompts: [
      {
        id: "work-weight",
        vi: "Điều gì ở công việc đang đè nặng lên mình nhất?",
        en: "What at work is weighing on me the most?",
      },
      {
        id: "work-boundary",
        vi: "Có ranh giới nào mình cần nói rõ hoặc giữ lại?",
        en: "Is there a boundary I need to name or protect?",
      },
      {
        id: "work-priority",
        vi: "Nếu chỉ chọn một ưu tiên vừa sức cho hôm nay, đó sẽ là gì?",
        en: "If I chose one manageable priority for today, what would it be?",
      },
    ],
    enabled: true,
    sortOrder: 60,
  },
  {
    id: "guided-relationship-v1",
    slug: "moi-quan-he",
    titleVi: "Mối quan hệ",
    titleEn: "Relationships",
    descriptionVi: "Lắng nghe điều mình cần và điều mình muốn nói rõ.",
    descriptionEn: "Listen to what I need and what I want to say clearly.",
    category: "relationships",
    estimatedMinutes: 5,
    prompts: [
      {
        id: "relationship-facts",
        vi: "Chuyện gì đã xảy ra, nếu mình chỉ kể lại những điều mình biết chắc?",
        en: "What happened, if I describe only what I know for sure?",
      },
      {
        id: "relationship-feeling",
        vi: "Chuyện đó để lại cảm giác gì trong mình?",
        en: "What feeling did that leave with me?",
      },
      {
        id: "relationship-need",
        vi: "Mình đang cần điều gì: được lắng nghe, có khoảng cách hay nói chuyện rõ ràng hơn?",
        en: "What do I need: to be heard, to have space, or to speak more clearly?",
      },
    ],
    enabled: true,
    sortOrder: 70,
  },
  {
    id: "guided-self-v1",
    slug: "hieu-minh-hon",
    titleVi: "Hiểu mình hơn",
    titleEn: "Understanding myself",
    descriptionVi: "Nhận ra điều đang lặp lại và điều mình thật sự cần.",
    descriptionEn: "Notice what repeats and what I genuinely need.",
    category: "self_understanding",
    estimatedMinutes: 5,
    prompts: [
      {
        id: "self-alive",
        vi: "Gần đây, khoảnh khắc nào khiến mình cảm thấy là chính mình nhất?",
        en: "Recently, when have I felt most like myself?",
      },
      {
        id: "self-drain",
        vi: "Điều gì thường làm năng lượng của mình vơi đi?",
        en: "What tends to drain my energy?",
      },
      {
        id: "self-need",
        vi: "Có nhu cầu nào của mình đang cần được chú ý hơn?",
        en: "What need of mine could use more attention?",
      },
    ],
    enabled: true,
    sortOrder: 80,
  },
  {
    id: "guided-after-hard-v1",
    slug: "sau-mot-dieu-kho-khan",
    titleVi: "Sau một điều khó khăn",
    titleEn: "After something difficult",
    descriptionVi: "Ghi lại điều đã qua mà không ép mình phải ổn ngay.",
    descriptionEn:
      "Name what happened without asking myself to be okay right away.",
    category: "after_difficulty",
    estimatedMinutes: 5,
    prompts: [
      {
        id: "after-happened",
        vi: "Điều khó khăn nào mình vừa đi qua?",
        en: "What difficult thing have I just been through?",
      },
      {
        id: "after-needed",
        vi: "Lúc này, phần nào trong mình cần được nghỉ hoặc được nâng đỡ?",
        en: "What part of me needs rest or support right now?",
      },
      {
        id: "after-kind",
        vi: "Một câu tử tế và thật lòng mình có thể nói với bản thân là gì?",
        en: "What is one kind and honest thing I can say to myself?",
      },
    ],
    enabled: true,
    sortOrder: 90,
  },
  {
    id: "guided-gratitude-v1",
    slug: "dieu-minh-biet-on",
    titleVi: "Điều mình biết ơn",
    titleEn: "What I appreciate",
    descriptionVi: "Giữ lại vài điều nhỏ đã làm hôm nay dịu hơn.",
    descriptionEn: "Keep a few small things that made today gentler.",
    category: "gratitude",
    estimatedMinutes: 3,
    prompts: [
      {
        id: "gratitude-small",
        vi: "Một điều nhỏ hôm nay mình thấy biết ơn là gì?",
        en: "What is one small thing I appreciated today?",
      },
      {
        id: "gratitude-person",
        vi: "Có ai hoặc điều gì đã giúp ngày của mình nhẹ hơn một chút?",
        en: "Who or what made my day a little lighter?",
      },
      {
        id: "gratitude-self",
        vi: "Có điều gì ở chính mình mà mình muốn ghi nhận hôm nay?",
        en: "What would I like to acknowledge in myself today?",
      },
    ],
    enabled: true,
    sortOrder: 100,
  },
] as const;

export function getGuidedJournalTemplate(idOrSlug: string) {
  return guidedJournalTemplates.find(
    (template) =>
      template.enabled &&
      (template.id === idOrSlug || template.slug === idOrSlug),
  );
}
