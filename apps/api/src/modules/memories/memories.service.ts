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
    return this.db.list<Memory>("memories", user, { active: true });
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
  ) {
    const embedding = approved
      ? await this.provider.embed(value.content)
      : null;
    return this.db.insert<Memory>("memories", user, {
      ...value,
      approved_by_user: approved,
      confidence: 1,
      embedding,
    });
  }
  async approve(user: string, id: string) {
    const memory = await this.db.one<Memory>("memories", user, id, true);
    const embedding = await this.provider.embed(memory.content);
    return this.db.update<Memory>("memories", user, id, {
      approved_by_user: true,
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
