import { CropStage } from "./CropSprite";
import { SeedId } from "./types";

/**
 * Giai đoạn hiển thị của cây dựa trên tiến độ thời gian.
 * 0 = mới gieo, 1 = mầm, 2 = đang lớn, 3 = chín.
 */
export function cropStageFor(
  _seedId: SeedId,
  plantedAt: number | undefined,
  readyAt: number | undefined,
  now: number,
): CropStage {
  if (plantedAt === undefined || readyAt === undefined) return 0;
  if (now >= readyAt) return 3;
  const span = readyAt - plantedAt;
  if (span <= 0) return 3;
  const progress = (now - plantedAt) / span;
  if (progress < 0.18) return 0;
  if (progress < 0.55) return 1;
  if (progress < 1) return 2;
  return 3;
}
