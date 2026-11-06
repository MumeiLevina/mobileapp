import {
  BASE_PLOTS,
  GRID_COLS,
  MAX_PLOTS,
  PLOTS_PER_LEVEL,
  SEEDS,
  SEED_BY_ID,
  SHOP_MAX_QTY,
  SHOP_MIN_QTY,
  SHOP_RESET_MS,
  START_COINS,
  START_SEEDS,
  TILE_IDS,
} from "./constants";
import {
  FarmShop,
  FarmState,
  Plot,
  Rng,
  SEED_IDS,
  SeedId,
  TileId,
} from "./types";

const defaultRng: Rng = () => Math.random();

/* ------------------------------------------------------------------ *
 * Cấp độ & giới hạn ô đất
 * ------------------------------------------------------------------ */

/** XP tích luỹ cần để đạt cấp `level`. Cấp 1 là 0. */
export function levelThreshold(level: number): number {
  if (level <= 1) return 0;
  return 10 * level;
}

/** Số ô đất mở khoá ở cấp `level`. */
export function plotLimit(level: number): number {
  return Math.min(MAX_PLOTS, BASE_PLOTS + (level - 1) * PLOTS_PER_LEVEL);
}

/** Cấp cao nhất mà `xp` đủ để đạt. */
export function computeLevel(xp: number): number {
  let level = 1;
  while (levelThreshold(level + 1) <= xp) level += 1;
  return level;
}

export type XpResult = {
  xp: number;
  level: number;
  /** Số ô đất mở thêm do lên cấp. */
  plotsUnlocked: number;
};

/** Cộng XP và trả về cấp mới (nếu có). */
export function addXp(currentXp: number, gained: number): XpResult {
  const xp = currentXp + gained;
  const level = computeLevel(xp);
  const before = plotLimit(computeLevel(currentXp));
  const after = plotLimit(level);
  return { xp, level, plotsUnlocked: Math.max(0, after - before) };
}

/* ------------------------------------------------------------------ *
 * Trạng thái ô đất
 * ------------------------------------------------------------------ */

export function emptyPlot(): Plot {
  return { stage: "available" };
}

/** Tạo state mới cho người chơi mới. */
export function createInitialState(now: number): FarmState {
  const plots: Record<TileId, Plot> = {};
  TILE_IDS.forEach((id, index) => {
    plots[id] = index < BASE_PLOTS ? emptyPlot() : { stage: "locked" };
  });
  const shop = rollShopStock(now, defaultRng).stock;
  return {
    level: 1,
    xp: 0,
    coins: START_COINS,
    seeds: { ...START_SEEDS },
    harvested: {
      rice: 0,
      wheat: 0,
      corn: 0,
      tomato: 0,
      strawberry: 0,
    },
    plots,
    shop,
    lastShopReset: now,
    nextShopReset: now + SHOP_RESET_MS,
    startedAt: now,
    guideSeen: false,
  };
}

/** Ô đất có sẵn sàng để trồng không. */
export function canPlant(plot: Plot | undefined): boolean {
  return !!plot && (plot.stage === "available" || plot.stage === "empty");
}

/** Cây đã chín chưa. */
export function isReady(plot: Plot | undefined, now: number): boolean {
  return (
    !!plot &&
    plot.stage === "planted" &&
    plot.readyAt !== undefined &&
    plot.readyAt <= now
  );
}

/* ------------------------------------------------------------------ *
 * Hành động trên ô đất
 * ------------------------------------------------------------------ */

export type PlantResult = {
  ok: boolean;
  plots: Record<TileId, Plot>;
  seeds: Record<SeedId, number>;
};

/** Gieo hạt lên một ô đã đào. */
export function plantCrop(
  plots: Record<TileId, Plot>,
  seeds: Record<SeedId, number>,
  tileId: TileId,
  seedId: SeedId,
  now: number,
): PlantResult {
  if (!canPlant(plots[tileId])) return { ok: false, plots, seeds };
  if ((seeds[seedId] ?? 0) <= 0) return { ok: false, plots, seeds };
  const def = SEED_BY_ID[seedId];
  return {
    ok: true,
    plots: {
      ...plots,
      [tileId]: {
        stage: "planted",
        seedId,
        plantedAt: now,
        readyAt: now + def.growMs,
      },
    },
    seeds: { ...seeds, [seedId]: seeds[seedId] - 1 },
  };
}

export type HarvestResult = {
  ok: boolean;
  plots: Record<TileId, Plot>;
  harvested: Record<SeedId, number>;
  xpGained: number;
  seedId?: SeedId;
};

/** Gặt cây đã chín: nhận XP và cấp sản phẩm vào kho. */
export function harvestCrop(
  plots: Record<TileId, Plot>,
  harvested: Record<SeedId, number>,
  tileId: TileId,
  now: number,
): HarvestResult {
  const plot = plots[tileId];
  if (!isReady(plot, now) || !plot?.seedId)
    return { ok: false, plots, harvested, xpGained: 0 };
  const seedId = plot.seedId;
  const def = SEED_BY_ID[seedId];
  return {
    ok: true,
    plots: { ...plots, [tileId]: { stage: "empty" } },
    harvested: { ...harvested, [seedId]: (harvested[seedId] ?? 0) + 1 },
    xpGained: def.xp,
    seedId,
  };
}

/* ------------------------------------------------------------------ *
 * Cửa hàng
 * ------------------------------------------------------------------ */

/**
 * Roll lượng hàng trong cửa hàng. Lúa luôn có (100%), các loại hiếm hơn
 * xuất hiện với xác suất thấp hơn. Số lượng mỗi loại ngẫu nhiên 1–5.
 */
export function rollShopStock(
  now: number,
  rng: Rng = defaultRng,
): { stock: FarmShop; nextReset: number } {
  const stock = SEED_IDS.reduce((acc, id) => {
    const def = SEED_BY_ID[id];
    if (rng() > def.shopChance) return { ...acc, [id]: 0 };
    const qty =
      SHOP_MIN_QTY +
      Math.floor(rng() * (SHOP_MAX_QTY - SHOP_MIN_QTY + 1));
    return { ...acc, [id]: qty };
  }, {} as FarmShop);
  return { stock, nextReset: now + SHOP_RESET_MS };
}

export type BuyResult = {
  ok: boolean;
  coins: number;
  seeds: Record<SeedId, number>;
  shop: FarmShop;
};

/** Mua `qty` hạt giống từ cửa hàng. */
export function buySeed(
  coins: number,
  seeds: Record<SeedId, number>,
  shop: FarmShop,
  seedId: SeedId,
  qty = 1,
): BuyResult {
  const def = SEED_BY_ID[seedId];
  const available = shop[seedId] ?? 0;
  const amount = Math.min(qty, available);
  if (amount <= 0) return { ok: false, coins, seeds, shop };
  const cost = def.price * amount;
  if (coins < cost) return { ok: false, coins, seeds, shop };
  return {
    ok: true,
    coins: coins - cost,
    seeds: { ...seeds, [seedId]: (seeds[seedId] ?? 0) + amount },
    shop: { ...shop, [seedId]: available - amount },
  };
}

/** Thời điểm shop restock tiếp theo. */
export function nextShopResetAt(lastReset: number): number {
  return lastReset + SHOP_RESET_MS;
}

/** Shop đã đến giờ restock chưa. */
export function isShopDue(state: FarmState, now: number): boolean {
  return now >= state.nextShopReset;
}

/**
 * Đồng bộ lại state sau khi app đóng/mở: shop quá hạn thì restock,
 * cây đã chín vẫn giữ nguyên (dựa trên timestamp) nên không mất thời gian.
 */
export function reconcileOfflineNow(
  state: FarmState,
  now: number,
  rng: Rng = defaultRng,
): FarmState {
  if (!isShopDue(state, now)) return state;
  const { stock } = rollShopStock(now, rng);
  return {
    ...state,
    shop: stock,
    lastShopReset: now,
    nextShopReset: nextShopResetAt(now),
  };
}

/* ------------------------------------------------------------------ *
 * Cửa thu mua
 * ------------------------------------------------------------------ */

export type SellResult = {
  ok: boolean;
  coins: number;
  harvested: Record<SeedId, number>;
  earned: number;
};

/** Bán sản phẩm trong kho cho cửa thu mua, giá = 2 × giá hạt giống. */
export function sellHarvest(
  coins: number,
  harvested: Record<SeedId, number>,
  seedId: SeedId,
  qty = Number.MAX_SAFE_INTEGER,
): SellResult {
  const have = harvested[seedId] ?? 0;
  const amount = Math.min(qty, have);
  if (amount <= 0) return { ok: false, coins, harvested, earned: 0 };
  const earned = SEED_BY_ID[seedId].sellPrice * amount;
  return {
    ok: true,
    coins: coins + earned,
    harvested: { ...harvested, [seedId]: have - amount },
    earned,
  };
}

/** Tổng giá trị sản phẩm đang nằm trong kho. */
export function harvestedValue(harvested: Record<SeedId, number>): number {
  return SEEDS.reduce(
    (sum, seed) => sum + seed.sellPrice * (harvested[seed.id] ?? 0),
    0,
  );
}

/* ------------------------------------------------------------------ *
 * Toạ độ isometric
 * ------------------------------------------------------------------ */

export const TILE_WIDTH = 76;
export const TILE_HEIGHT = 38;

/** Vị trí ô đất trong lưới theo thứ tự đọc (hàng trên → dưới). */
export function tileGridPosition(tileId: TileId): {
  row: number;
  col: number;
} {
  const index = Math.max(0, TILE_IDS.indexOf(tileId));
  return { row: Math.floor(index / GRID_COLS), col: index % GRID_COLS };
}

/**
 * Toạ độ isometric trong SVG. Ô đất là hình thoi (2:1), các ô cùng hàng
 * lệch nhau một nửa bề ngang và nửa chiều cao.
 */
export function isoPosition(tileId: TileId, originX: number, originY: number) {
  const { row, col } = tileGridPosition(tileId);
  return {
    x: originX + (col - row) * (TILE_WIDTH / 2),
    y: originY + (col + row) * (TILE_HEIGHT / 2),
    row,
    col,
  };
}

/** Thứ tự vẽ đúng chiều sâu: ô phía trên vẽ trước, ô phía dưới vẽ sau. */
export function tileDrawOrder(): TileId[] {
  return [...TILE_IDS].sort((a, b) => {
    const pa = tileGridPosition(a);
    const pb = tileGridPosition(b);
    return pa.row + pa.col - (pb.row + pb.col);
  });
}
