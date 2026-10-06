import { Inject, Injectable } from "@nestjs/common";
import { Memory, memorySchema } from "@mori/shared";
import { z } from "zod";
import { DatabaseService } from "../../database/database.service";
import { LLM_PROVIDER, LLMProvider } from "../../ai/providers/provider";
@Injectable()
export class MemoriesService {
  constructor(
    private readonly db: DatabaseService,
    @Inject(LLM_PROVIDER) private readonly provider: LLMProvider,
  ) {}
  list(user: string) {
    return this.db.listMemoriesWithSources<Memory>(user);
  }
  async retrieveMemories(user: string, input: string): Promise<Memory[]> {
    const embedding = await this.provider.embed(input);
    return this.db.rpc<Memory[]>("match_memories", {
      p_user: user,
      query_embedding: embedding,
      match_count: 4,
    });
  }
  async add(
    user: string,
    value: z.infer<typeof memorySchema>,
    approved = true,
    source: {
      sourceType:
        | "manual"
        | "conversation"
        | "journal"
        | "mood"
        | "weekly_reflection"
        | "life_map";
      sourceId?: string;
      reason: string;
    } = {
      sourceType: "manual",
      reason: "Được bạn trực tiếp thêm vào ký ức của Mori.",
    },
  ) {
    const embedding = approved
      ? await this.provider.embed(value.content)
      : null;
    const memory = await this.db.insert<Memory>("memories", user, {
      ...value,
      approved_by_user: approved,
      approved_at: approved ? new Date().toISOString() : null,
      confidence: 1,
      embedding,
    });
    try {
      await this.db.insert("memory_sources", user, {
        memory_id: memory.id,
        source_type: source.sourceType,
        source_id: source.sourceId ?? null,
        reason: source.reason,
      });
    } catch (error) {
      await this.db.remove("memories", user, memory.id).catch(() => undefined);
      throw error;
    }
    return memory;
  }
  async approve(user: string, id: string) {
    const memory = await this.db.one<Memory>("memories", user, id, true);
    const embedding = await this.provider.embed(memory.content);
    return this.db.update<Memory>("memories", user, id, {
      approved_by_user: true,
      approved_at: new Date().toISOString(),
      embedding,
      updated_at: new Date().toISOString(),
    });
  }
  async edit(user: string, id: string, value: z.infer<typeof memorySchema>) {
    const memory = await this.db.one<Memory>("memories", user, id, true);
    return this.db.update<Memory>("memories", user, id, {
      ...value,
      embedding: memory.approved_by_user
        ? await this.provider.embed(value.content)
        : null,
      updated_at: new Date().toISOString(),
    });
  }
  delete(user: string, id?: string) {
    return this.db.remove("memories", user, id);
  }
}
