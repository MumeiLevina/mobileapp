import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException("Invalid input");
  return result.data;
}
export function uuid(value: string) {
  return parse(z.string().uuid(), value);
}
