import { BadRequestException, Injectable } from "@nestjs/common";
import {
  SoftGoal,
  createSoftGoalSchema,
  updateSoftGoalSchema,
} from "@mori/shared";
import { z } from "zod";
import { DatabaseService } from "../../database/database.service";
import { GardenService } from "../garden/garden.service";

const ACTIVE_LIMIT = 5;
type CreateSoftGoal = z.infer<typeof createSoftGoalSchema>;
type UpdateSoftGoal = z.infer<typeof updateSoftGoalSchema>;

@Injectable()
export class SoftGoalsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly garden: GardenService,
  ) {}

  list(user: string) {
    return this.db.list<SoftGoal>("soft_goals", user, { limit: 100 });
  }

  async create(user: string, value: CreateSoftGoal) {
    const existing = await this.db.list<SoftGoal>("soft_goals", user, {
      equals: { client_id: value.client_id },
      limit: 1,
    });
    if (existing[0]) return existing[0];
    const active = await this.db.list<SoftGoal>("soft_goals", user, {
      equals: { status: "active" },
      limit: ACTIVE_LIMIT + 1,
    });
    if (active.length >= ACTIVE_LIMIT) {
      throw new BadRequestException(
        "Bạn đang giữ vài điều nhỏ rồi. Có thể hoàn thành hoặc cất bớt một điều trước khi thêm mới.",
      );
    }
    return this.db.insert<SoftGoal>("soft_goals", user, {
      ...value,
      status: "active",
    });
  }

  async update(user: string, id: string, value: UpdateSoftGoal) {
    const goal = await this.db.one<SoftGoal>("soft_goals", user, id);
    if (goal.status !== "active")
      throw new BadRequestException("Chỉ có thể sửa một ý định đang giữ.");
    return this.db.update<SoftGoal>("soft_goals", user, id, {
      ...value,
      updated_at: new Date().toISOString(),
    });
  }

  async complete(user: string, id: string, now = new Date()) {
    const goal = await this.db.one<SoftGoal>("soft_goals", user, id);
    if (goal.status === "archived")
      throw new BadRequestException("Ý định này đã được cất đi.");
    const completed =
      goal.status === "completed"
        ? goal
        : await this.db.update<SoftGoal>("soft_goals", user, id, {
            status: "completed",
            completed_at: now.toISOString(),
            archived_at: null,
            updated_at: now.toISOString(),
          });
    await this.garden.award(user, `soft-goal:${goal.id}`);
    return completed;
  }

  async archive(user: string, id: string, now = new Date()) {
    const goal = await this.db.one<SoftGoal>("soft_goals", user, id);
    if (goal.status === "archived") return goal;
    return this.db.update<SoftGoal>("soft_goals", user, id, {
      status: "archived",
      completed_at: null,
      archived_at: now.toISOString(),
      updated_at: now.toISOString(),
    });
  }

  delete(user: string, id: string) {
    return this.db.remove("soft_goals", user, id);
  }
}
