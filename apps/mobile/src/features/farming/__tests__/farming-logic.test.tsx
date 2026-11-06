import {
  SEED_BY_ID,
  SEEDS,
  SHOP_MAX_QTY,
  TILE_IDS,
} from "../constants";
import {
  addXp,
  buySeed,

  computeLevel,
  createInitialState,
  harvestCrop,
  isReady,
  levelThreshold,
  plantCrop,
  plotLimit,
  reconcileOfflineNow,
  rollShopStock,
  sellHarvest,
} from "../logic";
import { SeedId } from "../types";
import { isoPosition, tileDrawOrder } from "../logic";

const RICE = SEED_BY_ID.rice;

describe("level thresholds & plot limits", () => {
  // Công thức tích luỹ: XP tổng để đạt cấp L = 10 × L.
  test.each([
    [1, 0],
    [2, 20],
    [3, 30],
    [4, 40],
    [5, 50],
  ])("level %i threshold is %i", (level, expected) => {
    expect(levelThreshold(level)).toBe(expected);
  });

  test.each([
    [1, 9],
    [2, 12],
    [3, 15],
    [4, 18],
    [5, 20],
    [10, 20], // capped
  ])("level %i unlocks %i plots", (level, expected) => {
    expect(plotLimit(level)).toBe(expected);
  });

  test("computeLevel maps xp to level", () => {
    expect(computeLevel(0)).toBe(1);
    expect(computeLevel(19)).toBe(1);
    expect(computeLevel(20)).toBe(2);
    expect(computeLevel(29)).toBe(2);
    expect(computeLevel(30)).toBe(3);
  });

  test("addXp reports level-up and new plots", () => {
    // 9 XP rồi +5 = 14 → vẫn cấp 1 (cần 20 XP để lên cấp 2).
    const r1 = addXp(9, 5);
    expect(r1.xp).toBe(14);
    expect(r1.level).toBe(1);
    expect(r1.plotsUnlocked).toBe(0);

    // 16 + 5 = 21 → vượt ngưỡng 20, lên cấp 2, mở thêm 3 ô (9 → 12).
    const r2 = addXp(16, 5);
    expect(r2.xp).toBe(21);
    expect(r2.level).toBe(2);
    expect(r2.plotsUnlocked).toBe(3);

    const r3 = addXp(0, 3);
    expect(r3.level).toBe(1);
    expect(r3.plotsUnlocked).toBe(0);
  });
});

describe("shop restock", () => {
  test("rice is always present", () => {
    for (let i = 0; i < 50; i++) {
      const { stock } = rollShopStock(0, () => i / 50);
      expect(stock.rice).toBeGreaterThanOrEqual(1);
    }
  });

  test("quantities stay within 1..5", () => {
    for (let i = 0; i < 200; i++) {
      const { stock } = rollShopStock(0, () => Math.random());
      SEEDS.forEach((seed) => {
        const q = stock[seed.id];
        expect(q >= 0 && q <= SHOP_MAX_QTY).toBe(true);
      });
    }
  });

  test("rarer seeds appear less often on average", () => {
    // Với rng ngẫu nhiên, độ hiếm phản ánh shopChance: tỷ lệ "hiện có" xấp xỉ shopChance.
    let present = 0;
    const runs = 2000;
    for (let i = 0; i < runs; i++) {
      const { stock } = rollShopStock(0, () => Math.random());
      if (stock.strawberry > 0) present++;
    }
    const observed = present / runs;
    expect(observed).toBeLessThan(0.3); // strawberry = 12%
    expect(observed).toBeGreaterThan(0.05);
  });
});

describe("buySeed", () => {
  const seeds: Record<SeedId, number> = {
    rice: 0,
    wheat: 0,
    corn: 0,
    tomato: 0,
    strawberry: 0,
  };
  const shop = { rice: 3, wheat: 0, corn: 1, tomato: 2, strawberry: 0 };

  test("buys when affordable and in stock", () => {
    const r = buySeed(30, seeds, shop, "rice", 2);
    expect(r.ok).toBe(true);
    expect(r.coins).toBe(30 - RICE.price * 2);
    expect(r.seeds.rice).toBe(2);
    expect(r.shop.rice).toBe(1);
  });

  test("cannot buy when out of stock", () => {
    const r = buySeed(30, seeds, shop, "wheat", 1);
    expect(r.ok).toBe(false);
    expect(r.coins).toBe(30);
  });

  test("cannot buy when poor", () => {
    const r = buySeed(4, seeds, shop, "rice", 1);
    expect(r.ok).toBe(false);
    expect(r.seeds.rice).toBe(0);
  });
});

describe("plant & harvest loop", () => {
  test("plant → ready → harvest awards xp and product", () => {
    const now = 1_000_000;
    const seeds: Record<SeedId, number> = { ...createInitialState(0).seeds };
    const plots = createInitialState(0).plots;

    const planted = plantCrop(plots, seeds, "t0", "rice", now);
    expect(planted.ok).toBe(true);
    expect(planted.plots["t0"].stage).toBe("planted");
    expect(planted.seeds.rice).toBe(seeds.rice - 1);

    const t = planted.plots["t0"];
    expect(isReady(t, now + RICE.growMs - 1)).toBe(false);
    expect(isReady(t, now + RICE.growMs)).toBe(true);

    const harvested = harvestCrop(
      planted.plots,
      createInitialState(0).harvested,
      "t0",
      now + RICE.growMs,
    );
    expect(harvested.ok).toBe(true);
    expect(harvested.xpGained).toBe(RICE.xp);
    expect(harvested.harvested.rice).toBe(1);
    expect(harvested.plots["t0"].stage).toBe("empty");
  });

  test("cannot plant twice on the same tile", () => {
    const seeds: Record<SeedId, number> = { rice: 2, wheat: 0, corn: 0, tomato: 0, strawberry: 0 };
    const first = plantCrop({} as never, seeds, "t0", "rice", 0);
    const second = plantCrop(first.plots, first.seeds, "t0", "rice", 0);
    expect(second.ok).toBe(false);
  });

  test("cannot plant without seeds", () => {
    const seeds: Record<SeedId, number> = { rice: 0, wheat: 0, corn: 0, tomato: 0, strawberry: 0 };
    const r = plantCrop({} as never, seeds, "t0", "rice", 0);
    expect(r.ok).toBe(false);
  });
});

describe("selling", () => {
  test("sell pays double the seed price", () => {
    const harvested = { rice: 3, wheat: 0, corn: 0, tomato: 0, strawberry: 0 };
    const r = sellHarvest(0, harvested, "rice", Number.MAX_SAFE_INTEGER);
    expect(r.ok).toBe(true);
    expect(r.earned).toBe(RICE.sellPrice * 3);
    expect(r.coins).toBe(RICE.sellPrice * 3);
    expect(r.harvested.rice).toBe(0);
    expect(RICE.sellPrice).toBe(RICE.price * 2);
  });

  test("cannot sell what you do not have", () => {
    const harvested = { rice: 0, wheat: 0, corn: 0, tomato: 0, strawberry: 0 };
    const r = sellHarvest(0, harvested, "rice", 1);
    expect(r.ok).toBe(false);
    expect(r.earned).toBe(0);
  });
});

describe("offline reconcile", () => {
  test("restocks shop when overdue", () => {
    const state = createInitialState(0);
    const later = state.nextShopReset + 1;
    const reconciled = reconcileOfflineNow(state, later);
    expect(reconciled.lastShopReset).toBe(later);
    expect(reconciled.nextShopReset).toBe(later + 300_000);
    expect(reconciled.plots).toBe(state.plots); // không xoá cây
  });

  test("does nothing when not due", () => {
    const state = createInitialState(0);
    const reconciled = reconcileOfflineNow(state, 1000);
    expect(reconciled).toBe(state);
  });
});

describe("isometric helpers", () => {
  test("draw order is sorted by depth (row+col)", () => {
    const order = tileDrawOrder();
    expect(order.length).toBe(TILE_IDS.length);
    expect(new Set(order).size).toBe(TILE_IDS.length);
    const first = order[0];
    expect(first).toBe("t0"); // row0 col0 = (0,0)
  });

  test("isoPosition places corner tiles correctly", () => {
    const p = isoPosition("t0", 210, 60);
    expect(p.x).toBe(210);
    expect(p.y).toBe(60);
  });
});
