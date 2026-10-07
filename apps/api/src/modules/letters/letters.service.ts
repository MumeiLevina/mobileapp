import { BadRequestException, Injectable } from "@nestjs/common";
import {
  Letter,
  LetterSummary,
  letterCreateSchema,
  letterUpdateSchema,
} from "@mori/shared";
import { z } from "zod";
import { DatabaseService } from "../../database/database.service";
import { GardenService } from "../garden/garden.service";

type LetterCreate = z.infer<typeof letterCreateSchema>;
type LetterUpdate = z.infer<typeof letterUpdateSchema>;

@Injectable()
export class LettersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly garden: GardenService,
  ) {}

  async list(user: string, now = new Date()): Promise<LetterSummary[]> {
    const letters = await this.db.list<Letter>("letters", user, {
      active: true,
      limit: 100,
    });
    return letters.map((letter) => this.summary(letter, now));
  }

  editDraft(user: string, id: string) {
    return this.db.one<Letter>("letters", user, id, true);
  }

  async create(user: string, value: LetterCreate, now = new Date()) {
    this.requireFuture(value.open_at, now);
    const existing = value.client_id
      ? await this.db.list<Letter>("letters", user, {
          active: true,
          equals: { client_id: value.client_id },
          limit: 1,
        })
      : [];
    const letter =
      existing[0] ?? (await this.db.insert<Letter>("letters", user, value));
    await this.garden.award(user, `letter-seed:${letter.id}`);
    await this.garden.unlock(user, "letter_tree", "letter", letter.id);
    return letter;
  }

  async update(
    user: string,
    id: string,
    value: LetterUpdate,
    now = new Date(),
  ) {
    const letter = await this.db.one<Letter>("letters", user, id, true);
    if (letter.opened_at || Date.parse(letter.open_at) <= now.getTime()) {
      throw new BadRequestException("A ready letter can no longer be edited");
    }
    if (value.open_at) this.requireFuture(value.open_at, now);
    return this.db.update<Letter>("letters", user, id, {
      ...value,
      updated_at: now.toISOString(),
    });
  }

  async open(user: string, id: string, now = new Date()) {
    const letter = await this.db.one<Letter>("letters", user, id, true);
    if (Date.parse(letter.open_at) > now.getTime()) {
      throw new BadRequestException("This letter is not ready yet");
    }
    const opened = letter.opened_at
      ? letter
      : await this.db.update<Letter>("letters", user, id, {
          opened_at: now.toISOString(),
          updated_at: now.toISOString(),
        });
    await this.garden.award(user, `letter-flower:${letter.id}`);
    return opened;
  }

  delete(user: string, id: string, now = new Date()) {
    return this.db.update<Letter>("letters", user, id, {
      deleted_at: now.toISOString(),
      updated_at: now.toISOString(),
    });
  }

  private summary(letter: Letter, now: Date): LetterSummary {
    const {
      user_id: _user,
      content: _content,
      client_id: _client,
      ...safe
    } = letter;
    return {
      ...safe,
      status: letter.opened_at
        ? "opened"
        : Date.parse(letter.open_at) <= now.getTime()
          ? "ready"
          : "upcoming",
    };
  }

  private requireFuture(openAt: string, now: Date) {
    if (Date.parse(openAt) <= now.getTime()) {
      throw new BadRequestException("Letter open date must be in the future");
    }
  }
}
