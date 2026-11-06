# Farming Minigame (trang trại isometric)

Minigame trồng trọt góc nhìn isometric, kiểu Hay Day, chạy **độc lập** với các
tính năng wellness khác. State lưu trên máy (local-first) bằng
`zustand` + `persist`/`AsyncStorage`; timer dùng timestamp tường nên không cần
server đếm giờ.

## Vị trí

- Code: [`apps/mobile/src/features/farming/`](../apps/mobile/src/features/farming/)
- Route: [`apps/mobile/src/app/farming-game/`](../apps/mobile/src/app/farming-game/)
- Entry point: card **"Trang trại"** trong section "Cho khoảnh khắc này" của Home
  ([`apps/mobile/src/app/(tabs)/index.tsx`](../apps/mobile/src/app/(tabs)/index.tsx)).

## Kiến trúc

Tách logic thuần khỏi React để dễ test:

| File | Trách nhiệm |
|---|---|
| `logic.ts` | Các hàm **pure** (không phụ thuộc React/zustand): roll shop, mua, gieo, gặt, bán, XP/cấp, offline reconcile, toạ độ isometric. Đây là core testable. |
| `store.ts` | Zustand store (persist + AsyncStorage). State: `level, xp, coins, seeds, harvested, plots, shop, lastShopReset, nextShopReset, guideSeen`. |
| `constants.ts` | 5 định nghĩa giống, ngưỡng cấp, giới hạn ô đất, chu kỳ reset cửa hàng. |
| `FarmScene.tsx` / `CropView.tsx` / `CropSprite.tsx` | Renderer isometric (SVG + reanimated), 4 giai đoạn cây, sway nhẹ, tôn trọng reduced-motion. |
| `FarmScreen.tsx` | HUD (xu, cấp, XP bar) + điều phối 3 panel (cửa hàng, thu mua, ô đất). |
| `ShopPanel` / `SellerPanel` / `PlotActionSheet` | Các modal con. |

## Cân bằng

| Giống | Giá mua | Bán (2×) | XP | Chín | Tỷ lệ shop |
|---|---|---|---|---|---|
| Lúa | 5 | 10 | +3 | 15s | 100% (luôn có) |
| Lúa mì | 8 | 16 | +5 | 20s | 70% |
| Ngô | 12 | 24 | +7 | 30s | 40% |
| Cà chua | 18 | 36 | +9 | 45s | 25% |
| Dâu | 26 | 52 | +11 | 60s | 12% |

- Số lượng mỗi lần restock: ngẫu nhiên 1–5. Chu kỳ restock: 5 phút.
- **XP tích luỹ để đạt cấp L = 10 × L** (cấp 1 = 0, cấp 2 = 20, cấp 3 = 30…).
- **Giới hạn ô đất = 9 + (L − 1) × 3**, capped 20 (grid cố định 4 × 5).
- Khởi tạo: 30 xu, 3 hạt lúa, 9 ô đất mở.

> Giá + thời gian chín + độ hiếm là thiết kế bổ sung theo nguyên tắc
> "cây hiếm giá càng cao, xuất hiện càng ít, cho kinh nghiệm càng nhiều".
> Chỉ cần append vào `SEEDS` trong `constants.ts` để thêm giống thứ 6+.

## Kiểm tra

```
npm run typecheck -w @mori/mobile
npm run test:mobile            # farming: logic + store + screen
```

## Ghi chú kỹ thuật

- Ô đất isometric là **hình thoi** (tỷ lệ 2:1). Nền SVG tĩnh + lớp cây/ tương
  tác render bằng toạ độ pixel đo được (`onLayout`), không dùng percentage so với
  viewBox đã crop.
- Càng hiếm → `shopChance` càng thấp; `rollShopStock` roll độc lập mỗi loại.
- `reconcileOfflineNow` restock shop khi quá hạn, không "mất" thời gian cây (cây
  vẫn chín theo `plantedAt`/`readyAt`).
