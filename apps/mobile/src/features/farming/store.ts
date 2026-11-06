import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MAX_PLOTS, SEEDS, SHOP_RESET_MS, TILE_IDS } from "./constants";
import {
  addXp,
  buySeed,
  createInitialState,
  harvestCrop,
  plantCrop,
  plotLimit,
  rollShopStock,
  sellHarvest,
} from "./logic";
import { FarmState, SeedId, TileId } from "./types";

type FarmActions = {
  /** Đồng bộ state khi app mở (restock shop nếu quá hạn). */
  reconcile: (now?: number) => void;
  buy: (seedId: SeedId, qty?: number) => void;
  plant: (tileId: TileId, seedId: SeedId, now?: number) => void;
  harvest: (tileId: TileId, now?: number) => void;
  sell: (seedId: SeedId, qty?: number) => void;
  sellAll: () => void;
  /** Đánh dấu đã xem hướng dẫn lần đầu. */
  markGuideSeen: () => void;
  reset: (now?: number) => void;
};

export type FarmStore = FarmState & FarmActions;

/**
 * Bảo đảm đủ 20 ô trong `plots` và mở khoá những ô nằm trong giới hạn
 * của cấp hiện tại (dùng khi lên cấp hoặc khi nạp state cũ).
 */
function syncPlots(
  plots: FarmState["plots"],
  limit: number,
): FarmState["plots"] {
  const next = { ...plots };
  TILE_IDS.forEach((id, index) => {
    const existing = next[id];
    if (!existing) {
      next[id] = index < limit ? { stage: "available" } : { stage: "locked" };
      return;
    }
    if (existing.stage === "locked" && index < limit)
      next[id] = { stage: "available" };
  });
  return Object.keys(next).length === MAX_PLOTS ? next : next;
}

export const useFarming = create<FarmStore>()(
  persist(
    (set, get) => ({
      ...createInitialState(Date.now()),

      reconcile: (now = Date.now()) => {
        const s = get();
        if (now < s.nextShopReset) return;
        const { stock } = rollShopStock(now);
        set({
          shop: stock,
          lastShopReset: now,
          nextShopReset: now + SHOP_RESET_MS,
        });
      },

      buy: (seedId, qty = 1) => {
        const s = get();
        const result = buySeed(s.coins, s.seeds, s.shop, seedId, qty);
        if (result.ok)
          set({ coins: result.coins, seeds: result.seeds, shop: result.shop });
      },

      plant: (tileId, seedId, now = Date.now()) => {
        const s = get();
        const result = plantCrop(s.plots, s.seeds, tileId, seedId, now);
        if (result.ok) set({ plots: result.plots, seeds: result.seeds });
      },

      harvest: (tileId, now = Date.now()) => {
        const s = get();
        const result = harvestCrop(s.plots, s.harvested, tileId, now);
        if (!result.ok) return;
        const xp = addXp(s.xp, result.xpGained);
        const limit = plotLimit(xp.level);
        set({
          plots: syncPlots(result.plots, limit),
          harvested: result.harvested,
          xp: xp.xp,
          level: xp.level,
        });
      },

      sell: (seedId, qty) => {
        const s = get();
        const result = sellHarvest(s.coins, s.harvested, seedId, qty);
        if (result.ok) set({ coins: result.coins, harvested: result.harvested });
      },

      sellAll: () => {
        let coins = get().coins;
        let harvested = { ...get().harvested };
        SEEDS.forEach((seed) => {
          const result = sellHarvest(
            coins,
            harvested,
            seed.id,
            Number.MAX_SAFE_INTEGER,
          );
          coins = result.coins;
          harvested = result.harvested;
        });
        set({ coins, harvested });
      },

      markGuideSeen: () => {
        set({ guideSeen: true });
      },

      reset: (now = Date.now()) => {
        set(createInitialState(now));
      },
    }),
    {
      name: "mori-farming",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
