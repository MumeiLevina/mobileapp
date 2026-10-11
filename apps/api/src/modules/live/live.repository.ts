import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  sessionSchema,
  turnRequestSchema,
  turnResponseSchema,
} from "@mori/live-protocol";

export const storedTurnSchema = z.object({
  request: turnRequestSchema.optional(),
  fingerprint: z.string().optional(),
  response: turnResponseSchema,
  state: z.enum(["pending", "complete", "cancelled"]),
  safety: z.string().max(40).default("not_run"),
  reservedMicros: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  personaVersion: z.string(),
  modelId: z.string(),
});
const sessionRecordSchema = z.object({
  owner: z.string(),
  createEventId: z.string().uuid(),
  session: sessionSchema,
  turns: z.record(z.string().uuid(), storedTurnSchema),
});
const storeSchema = z
  .object({
    version: z.literal(1),
    spentMicros: z.number().int().nonnegative(),
    sessions: z.record(z.string().uuid(), sessionRecordSchema),
  })
  .strict();
export type PublicLiveState = z.infer<typeof storeSchema>;
export type StoredTurn = z.infer<typeof storedTurnSchema>;

// No Supabase client, table selector, user ID or private-domain data access.
export class PublicLiveRepository {
  private state: PublicLiveState;
  private readonly file: string;
  private readonly lock: string;
  private lockFd: number | undefined;
  private healthy = true;
  constructor(directory: string) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.file = join(directory, "public-live.json");
    this.lock = join(directory, "writer.lock");
    // Never steal a lock: operator must verify a crashed process before recovery.
    this.lockFd = openSync(this.lock, "wx", 0o600);
    writeFileSync(this.lockFd, String(process.pid));
    try {
      if (existsSync(this.file) && statSync(this.file).size > 64 * 1024 * 1024)
        throw new Error("Public store capacity exceeded");
      this.state = existsSync(this.file)
        ? storeSchema.parse(JSON.parse(readFileSync(this.file, "utf8")))
        : { version: 1, spentMicros: 0, sessions: {} };
      this.transaction((state) => {
        for (const session of Object.values(state.sessions))
          for (const turn of Object.values(session.turns)) {
            if (turn.state === "pending") {
              turn.state = "cancelled";
              turn.response.status = "cancelled";
              turn.response.text = "";
              turn.safety = "interrupted_restart";
            }
          }
      });
    } catch {
      this.close();
      throw new Error(
        "Public store unavailable or invalid; preserve it for recovery",
      );
    }
  }
  snapshot(): PublicLiveState {
    if (!this.healthy || this.lockFd === undefined)
      throw new Error("Public store unavailable");
    return structuredClone(this.state);
  }
  transaction<T>(mutate: (state: PublicLiveState) => T): T {
    const next = this.snapshot();
    const result = mutate(next);
    const serialized = JSON.stringify(storeSchema.parse(next));
    if (Buffer.byteLength(serialized) > 64 * 1024 * 1024)
      throw new Error("Public store capacity exceeded");
    const temporary = `${this.file}.next`;
    try {
      const fd = openSync(temporary, "w", 0o600);
      try {
        writeFileSync(fd, serialized);
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      renameSync(temporary, this.file);
      this.state = next;
    } catch {
      this.healthy = false;
      throw new Error("Public store write failed");
    }
    return structuredClone(result);
  }
  close() {
    if (this.lockFd !== undefined) {
      closeSync(this.lockFd);
      this.lockFd = undefined;
      unlinkSync(this.lock);
    }
  }
}
