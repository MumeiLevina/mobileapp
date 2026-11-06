export const SEED_IDS = ["rice", "wheat", "corn", "tomato", "strawberry"] as const;
export type SeedId = (typeof SEED_IDS)[number];

export type SeedDef = {
  id: SeedId;
  /** Tên hiển thị. */
  name: string;
  /** Giá mua (xu). */
  price: number;
  /** Giá bán (xu) = 2 × price. */
  sellPrice: number;
  /** XP thu được khi gặt. */
  xp: number;
  /** Thời gian chín (ms). */
  growMs: number;
  /** Khả năng hiện có trong shop mỗi lần restock (0–1). */
  shopChance: number;
  /** Biểu tượng. */
  emoji: string;
};

export type TileId = string;

export type PlotStage =
  /** Chưa mở khoá (cần lên cấp). */
  | "locked"
  /** Đã mở khoá nhưng chưa đào đất. */
  | "available"
  /** Đã đào đất, sẵn sàng gieo hạt. */
  | "empty"
  /** Đang có cây. Trạng thái chín suy ra từ `readyAt`. */
  | "planted";

export type Plot = {
  stage: PlotStage;
  seedId?: SeedId;
  plantedAt?: number;
  readyAt?: number;
};

export type FarmShop = Record<SeedId, number>;

export type FarmState = {
  level: number;
  xp: number;
  coins: number;
  /** Số lượng hạt giống có trong túi. */
  seeds: Record<SeedId, number>;
  /** Số lượng cây đã gặt, chờ bán cho cửa thu mua. */
  harvested: Record<SeedId, number>;
  plots: Record<TileId, Plot>;
  shop: FarmShop;
  lastShopReset: number;
  nextShopReset: number;
  startedAt: number;
  /** Đã xem hướng dẫn lần đầu chưa. */
  guideSeen: boolean;
};

/** Nguồn ngẫu nhiên có thể thay thế để test. */
export type Rng = () => number;
