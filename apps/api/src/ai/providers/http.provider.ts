import { z } from "zod";
import { LLMProvider, PromptMessage } from "./provider";
import { Config } from "../../config/env";
export class HttpLLMProvider implements LLMProvider {
  constructor(private readonly config: Config) {}
  private async post(path: string, body: unknown): Promise<unknown> {
    const base = this.config.LLM_BASE_URL!;
    if (!base.startsWith("https://") && this.config.NODE_ENV === "production")
      throw new Error("TLS required");
    const response = await fetch(`${base.replace(/\/$/, "")}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.LLM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) throw new Error("Provider unavailable");
    return response.json();
  }
  async generateText(messages: PromptMessage[]) {
    const data = z
      .object({
        choices: z
          .array(
            z.object({
              message: z.object({ content: z.string().min(1).max(12000) }),
            }),
          )
          .min(1),
      })
      .parse(
        await this.post("chat/completions", {
          model: this.config.LLM_MODEL,
          messages,
          temperature: 0.4,
          max_tokens: 700,
        }),
      );
    return data.choices[0].message.content;
  }
  async generateStructured<T>(
    messages: PromptMessage[],
    schema: z.ZodType<T>,
  ): Promise<T> {
    const text = await this.generateText([
      ...messages,
      {
        role: "system",
        content: "Return only one valid JSON object. No markdown fences.",
      },
    ]);
    return schema.parse(JSON.parse(text));
  }
  async embed(text: string) {
    const data = z
      .object({
        data: z
          .array(z.object({ embedding: z.array(z.number()).length(1536) }))
          .min(1),
      })
      .parse(
        await this.post("embeddings", {
          model: this.config.LLM_EMBEDDING_MODEL,
          input: text,
          dimensions: 1536,
        }),
      );
    return data.data[0].embedding;
  }
}
