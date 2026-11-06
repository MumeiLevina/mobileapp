import { SEED_BY_ID } from "../constants";
import { useFarming } from "../store";

const RICE = SEED_BY_ID.rice;

function resetFarm(now = Date.now()) {
  useFarming.setState(useFarming.getState());
  useFarming.getState().reset(now);
}

describe("farming store", () => {
  beforeEach(() => {
    resetFarm(1_000_000);
  });

  test("starts with 30 coins, 3 rice seeds and 9 unlocked plots", () => {
    const s = useFarming.getState();
    expect(s.coins).toBe(30);
    expect(s.seeds.rice).toBe(3);
    expect(s.level).toBe(1);
    expect(s.xp).toBe(0);
    const unlocked = Object.values(s.plots).filter(
      (p) => p.stage !== "locked",
    );
    expect(unlocked.length).toBe(9);
  });

  test("plant → harvest → sell full loop", () => {
    const now = 1_000_000;
    const farm = useFarming.getState();

    farm.plant("t0", "rice", now);
    expect(useFarming.getState().seeds.rice).toBe(2);
    expect(useFarming.getState().plots.t0.stage).toBe("planted");

    // Chưa chín → gặt không được
    useFarming.getState().harvest("t0", now + RICE.growMs - 1);
    expect(useFarming.getState().harvested.rice).toBe(0);

    // Đã chín
    useFarming.getState().harvest("t0", now + RICE.growMs);
    const afterHarvest = useFarming.getState();
    expect(afterHarvest.harvested.rice).toBe(1);
    expect(afterHarvest.xp).toBe(RICE.xp);
    expect(afterHarvest.plots.t0.stage).toBe("empty");

    // Bán
    useFarming.getState().sell("rice", 1);
    expect(useFarming.getState().coins).toBe(30 + RICE.sellPrice);
    expect(useFarming.getState().harvested.rice).toBe(0);
  });

  test("level up unlocks three more plots", () => {
    const now = 1_000_000;
    // Cần 20 XP (tích luỹ) để lên cấp 2. Rice = +3 XP → 7 cây (21 XP).
    // Cấp giống trực tiếp để test không phụ thuộc số lượng ngẫu nhiên trong shop.
    for (let i = 0; i < 7; i++) {
      useFarming.setState((s) => ({
        seeds: { ...s.seeds, rice: 3 },
        coins: 100,
      }));
      useFarming.getState().plant(`t${i}`, "rice", now);
      useFarming.getState().harvest(`t${i}`, now + RICE.growMs);
    }

    const s = useFarming.getState();
    expect(s.xp).toBe(21);
    expect(s.level).toBe(2);
    const unlocked = Object.values(s.plots).filter(
      (p) => p.stage !== "locked",
    );
    expect(unlocked.length).toBe(12);
  });

  test("buying requires coins and stock", () => {
    const farm = useFarming.getState();
    const wheatStock = useFarming.getState().shop.wheat;
    farm.buy("wheat", 1);
    expect(useFarming.getState().seeds.wheat).toBe(wheatStock > 0 ? 1 : 0);

    // Mua lúa với số lượng vô hạn → bị giới hạn bởi số tiền và tồn kho.
    const before = useFarming.getState();
    useFarming.getState().buy("rice", 99);
    const after = useFarming.getState();
    const bought = after.seeds.rice - before.seeds.rice;
    expect(bought).toBeGreaterThan(0);
    expect(bought).toBeLessThanOrEqual(before.shop.rice);
    expect(after.coins).toBe(before.coins - bought * SEED_BY_ID.rice.price);
  });

  test("shop restocks after the reset window", () => {
    const now = 1_000_000;
    const before = { ...useFarming.getState().shop };
    useFarming.getState().reconcile(now + 300_001);
    const after = useFarming.getState();
    expect(after.lastShopReset).toBe(now + 300_001);
    expect(after.nextShopReset).toBe(now + 300_001 + 300_000);
    expect(after.shop).not.toBe(before);
    expect(after.shop.rice).toBeGreaterThan(0);
  });

  test("reconcile before due keeps the shop untouched", () => {
    const before = { ...useFarming.getState().shop };
    useFarming.getState().reconcile(1_000_000 + 1000);
    expect(useFarming.getState().shop).toEqual(before);
  });

  test("sellAll empties the whole inventory", () => {
    const now = 1_000_000;
    useFarming.getState().plant("t0", "rice", now);
    useFarming.getState().harvest("t0", now + RICE.growMs);
    useFarming.getState().sellAll();
    const s = useFarming.getState();
    expect(s.harvested.rice).toBe(0);
    expect(s.coins).toBe(30 + RICE.sellPrice);
  });
});
