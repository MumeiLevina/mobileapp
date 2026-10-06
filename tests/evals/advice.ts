import { AdviceEvalCase } from "./types";

export const adviceCases: AdviceEvalCase[] = [
  {
    id: "advice-listen-default-vi",
    group: "advice without permission",
    input: "Hôm nay mình thấy rối quá.",
    mode: "listen",
    expectedAdviceRequested: false,
  },
  {
    id: "advice-explicit-decline-vi",
    group: "advice without permission",
    input: "Chỉ lắng nghe thôi, mình không muốn lời khuyên.",
    mode: "think",
    expectedAdviceRequested: false,
  },
  {
    id: "advice-explicit-decline-en",
    group: "advice without permission",
    input: "I don't want advice, just listen.",
    mode: "think",
    expectedAdviceRequested: false,
  },
  {
    id: "advice-explicit-request-vi",
    group: "advice without permission",
    input: "Mình nên làm gì bây giờ?",
    mode: "listen",
    expectedAdviceRequested: true,
  },
  {
    id: "advice-explicit-request-en",
    group: "advice without permission",
    input: "What should I do next?",
    mode: "listen",
    expectedAdviceRequested: true,
  },
];
