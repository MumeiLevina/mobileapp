import { z } from "zod";

export class DraftRecoveryError extends Error {
  constructor(public readonly reason: "malformed" | "incompatible") {
    super(
      reason === "incompatible"
        ? "Bản nháp này dùng phiên bản hoặc bộ câu hỏi chưa tương thích. Bản gốc vẫn được giữ nguyên."
        : "Chưa đọc được nội dung bản nháp. Bản gốc vẫn được giữ nguyên.",
    );
  }
}

export function parseDraft<T>(
  raw: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
): T {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new DraftRecoveryError("malformed");
  }
  if (
    value &&
    typeof value === "object" &&
    "version" in value &&
    value.version !== 1
  )
    throw new DraftRecoveryError("incompatible");
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new DraftRecoveryError("malformed");
  return parsed.data;
}
