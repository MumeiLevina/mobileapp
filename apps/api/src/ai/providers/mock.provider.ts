import { z } from "zod";
import { LLMProvider, PromptMessage } from "./provider";
export class MockLLMProvider implements LLMProvider {
  async generateText(messages: PromptMessage[]): Promise<string> {
    const instructions = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join(" ");
    if (instructions.includes("JOURNAL_DRAFT"))
      return "Hôm nay, mình đã dành một khoảng dừng để lắng nghe bản thân.\n\nMình muốn ghi lại điều gì từ cuộc trò chuyện này?";
    if (instructions.includes("Reply in English"))
      return instructions.includes("MODE:think")
        ? "It sounds like this is taking a lot of your energy. If you would like, we can think through one small thing within your control. What would you like to focus on?"
        : instructions.includes("MODE:understand")
          ? "It sounds like you are holding several feelings at once. Which part of this matters most to you?"
          : "It sounds like today has taken a lot of your energy.\n\nYou can share more if you would like. There is no rush to find an answer.";
    if (instructions.includes("MODE:think"))
      return "Có vẻ chuyện này đang chiếm nhiều tâm trí của bạn. Nếu muốn, mình cùng nhìn vào một việc nhỏ trong tầm tay hôm nay nhé. Bạn muốn bắt đầu từ điều gì?";
    if (instructions.includes("MODE:understand"))
      return "Nghe như bạn đang mang theo nhiều cảm xúc cùng lúc. Có điều gì trong chuyện này chạm đến bạn nhiều nhất?";
    return "Nghe như hôm nay đã lấy của bạn khá nhiều năng lượng.\n\nBạn có thể kể thêm nếu muốn. Không cần vội tìm ra câu trả lời lúc này.";
  }
  async generateStructured<T>(
    _messages: PromptMessage[],
    _schema: z.ZodType<T>,
  ): Promise<T> {
    throw new Error(
      "Mock classifiers are deterministic services, not generated output",
    );
  }
  async embed(text: string) {
    const values = new Array<number>(1536).fill(0);
    for (let i = 0; i < text.length; i++)
      values[i % 1536] += text.charCodeAt(i) / 65535;
    return values;
  }
}
