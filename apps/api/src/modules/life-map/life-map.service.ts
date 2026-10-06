import { BadRequestException, Injectable } from "@nestjs/common";
import {
  LifeMapItem,
  LifeMapSuggestion,
  LifeMapType,
  Memory,
  lifeMapSchema,
  lifeMapSuggestionSchema,
} from "@mori/shared";
import { z } from "zod";
import { DatabaseService } from "../../database/database.service";

const categoryToType: Record<Memory["category"], LifeMapType> = {
  preference: "preferences",
  life_event: "important_events",
  relationship: "people",
  goal: "goals",
  self_care_preference: "helpful_things",
  communication_preference: "preferences",
};

@Injectable()
export class LifeMapService {
  constructor(private readonly db: DatabaseService) {}

  list(user: string) {
    return this.db.list<LifeMapItem>("life_map_items", user, { active: true });
  }

  create(user: string, value: z.input<typeof lifeMapSchema>) {
    return this.db.insert<LifeMapItem>("life_map_items", user, {
      ...value,
      description: value.description ?? "",
      source_type: null,
      source_id: null,
      approved_by_user: true,
    });
  }

  async suggestions(user: string): Promise<LifeMapSuggestion[]> {
    const [memories, items] = await Promise.all([
      this.db.list<Memory>("memories", user, {
        active: true,
        equals: { approved_by_user: true },
        limit: 30,
      }),
      this.list(user),
    ]);
    const existingSources = new Set(
      items
        .filter((item) => item.source_type === "memory")
        .map((item) => item.source_id),
    );
    return memories
      .filter((memory) => !existingSources.has(memory.id))
      .slice(0, 5)
      .map((memory) => ({
        type: categoryToType[memory.category],
        title: memory.content.slice(0, 120),
        description: "Được đề xuất từ một ký ức bạn đã cho phép Mori dùng.",
        source_type: "memory" as const,
        source_id: memory.id,
      }));
  }

  async addSuggestion(
    user: string,
    value: z.input<typeof lifeMapSuggestionSchema>,
  ) {
    await this.db
      .one<Memory>("memories", user, value.source_id, true)
      .then((memory) => {
        if (!memory.approved_by_user) throw new BadRequestException();
      });
    return this.db.insert<LifeMapItem>("life_map_items", user, {
      ...value,
      description: value.description ?? "",
      approved_by_user: true,
    });
  }

  approve(user: string, id: string) {
    return this.db.update<LifeMapItem>("life_map_items", user, id, {
      approved_by_user: true,
      updated_at: new Date().toISOString(),
    });
  }

  edit(user: string, id: string, value: z.input<typeof lifeMapSchema>) {
    return this.db.update<LifeMapItem>("life_map_items", user, id, {
      ...value,
      description: value.description ?? "",
      updated_at: new Date().toISOString(),
    });
  }

  delete(user: string, id: string) {
    return this.db.update<LifeMapItem>("life_map_items", user, id, {
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
}
