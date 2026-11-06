import { SeedDef, SeedId, TileId } from "./types";

/** Một chu kỳ nghỉ của cửa hàng (5 phút). */
export const SHOP_RESET_MS = 300_000;

/** Grid ô đất cố định: 4 cột × 5 hàng = 20 ô. */
export const GRID_COLS = 4;
export const GRID_ROWS = 5;
export const TILE_IDS: TileId[] = Array.from(
  { length: GRID_COLS * GRID_ROWS },
  (_, i) => `t${i}`,
);

/** Số ô đất tối đa người chơi có thể mở. */
export const MAX_PLOTS = TILE_IDS.length;

/** Số ô đất mở ban đầu (cấp 1). */
export const BASE_PLOTS = 9;

/** Mỗi cấp mở thêm ba ô đất. */
export const PLOTS_PER_LEVEL = 3;

export const SEEDS: SeedDef[] = [
  {
    id: "rice",
    name: "Hạt lúa",
    price: 5,
    sellPrice: 10,
    xp: 3,
    growMs: 15_000,
    shopChance: 1,
    emoji: "🌾",
  },
  {
    id: "wheat",
    name: "Lúa mì",
    price: 8,
    sellPrice: 16,
    xp: 5,
    growMs: 20_000,
    shopChance: 0.7,
    emoji: "🌿",
  },
  {
    id: "corn",
    name: "Ngô",
    price: 12,
    sellPrice: 24,
    xp: 7,
    growMs: 30_000,
    shopChance: 0.4,
    emoji: "🌽",
  },
  {
    id: "tomato",
    name: "Cà chua",
    price: 18,
    sellPrice: 36,
    xp: 9,
    growMs: 45_000,
    shopChance: 0.25,
    emoji: "🍅",
  },
  {
    id: "strawberry",
    name: "Dâu",
    price: 26,
    sellPrice: 52,
    xp: 11,
    growMs: 60_000,
    shopChance: 0.12,
    emoji: "🍓",
  },
];

export const SEED_BY_ID: Record<SeedId, SeedDef> = SEEDS.reduce(
  (acc, seed) => ({ ...acc, [seed.id]: seed }),
  {} as Record<SeedId, SeedDef>,
);

/** Số lượng hạt ngẫu nhiên mỗi lần shop restock. */
export const SHOP_MIN_QTY = 1;
export const SHOP_MAX_QTY = 5;

/** Tài nguyên khởi tạo. */
export const START_COINS = 30;
export const START_SEEDS: Record<SeedId, number> = {
  rice: 3,
  wheat: 0,
  corn: 0,
  tomato: 0,
  strawberry: 0,
};
