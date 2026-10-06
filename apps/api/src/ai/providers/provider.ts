import { z } from "zod";
export type PromptMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};
export interface LLMProvider {
  generateText(messages: PromptMessage[]): Promise<string>;
  generateStructured<T>(
    messages: PromptMessage[],
    schema: z.ZodType<T>,
  ): Promise<T>;
  embed(text: string): Promise<number[]>;
}
export const LLM_PROVIDER = Symbol("LLM_PROVIDER");
