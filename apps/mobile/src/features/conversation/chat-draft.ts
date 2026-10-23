import { z } from "zod";
import { newId } from "../../lib/id";

const schema = z.object({
  version: z.literal(1),
  content: z.string().max(6000),
  clientId: z.string().uuid(),
  mode: z.enum(["listen", "understand", "think"]),
});

// The previous draft format was plain message text. Preserve it verbatim.
export function readChatDraft(stored: string) {
  try {
    const parsed = schema.safeParse(JSON.parse(stored));
    if (parsed.success) return parsed.data;
  } catch {
    /* Legacy plain-text draft. */
  }
  return {
    version: 1 as const,
    content: stored,
    clientId: newId(),
    mode: "listen" as const,
  };
}
