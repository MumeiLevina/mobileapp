import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  MoriBottomSheet,
  MoriButton,
  MoriCard,
  MoriPressable,
  MoriText,
  ScreenContainer,
  SectionHeading,
} from "../../components/ui";
import { useTheme } from "../../theme";
import { useFarming } from "./store";
import { SEEDS } from "./constants";
import { levelThreshold, plotLimit } from "./logic";
import { FarmScene } from "./FarmScene";
import { ShopPanel } from "./ShopPanel";
import { SellerPanel } from "./SellerPanel";
import { PlotActionSheet } from "./PlotActionSheet";
import { useNow } from "./useNow";
import { formatCountdown } from "./format";
import { SeedId } from "./types";

export function FarmScreen() {
  const t = useTheme();
  const now = useNow(500);
  const farm = useFarming();
  const [selectedTile, setSelectedTile] = useState<string | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [sellerOpen, setSellerOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    farm.reconcile(Date.now());
  }, [farm.reconcile]);

  useEffect(() => {
    if (!farm.guideSeen) setGuideOpen(true);
  }, [farm.guideSeen]);

  const selectedPlot = selectedTile ? farm.plots[selectedTile] : undefined;

  const xpIntoLevel = farm.xp - levelThreshold(farm.level);
  const xpSpan = Math.max(
    1,
    levelThreshold(farm.level + 1) - levelThreshold(farm.level),
  );
  const xpPercent = Math.min(100, (xpIntoLevel / xpSpan) * 100);
  const limit = plotLimit(farm.level);
  const usedPlots = Object.values(farm.plots).filter(
    (p) => p.stage !== "locked",
  ).length;

  const hasHarvest = useMemo(
    () => SEEDS.some((seed) => (farm.harvested[seed.id] ?? 0) > 0),
    [farm.harvested],
  );

  const closePlot = () => setSelectedTile(null);

  return (
    <ScreenContainer>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <MoriText variant="title">Trang trại của bạn</MoriText>
          <MoriText muted variant="small">
            Cao nguyên nhỏ, mùa nào cũng có ngày đẹp.
          </MoriText>
        </View>
        <MoriPressable
          accessibilityRole="button"
          accessibilityLabel="Mở túi hạt giống"
          onPress={() => setShopOpen(true)}
          style={(pressed) => ({
            alignItems: "center",
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 16,
            backgroundColor: t.soft,
            borderWidth: 1,
            borderColor: t.line,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Ionicons name="wallet-outline" size={18} color={t.primary} />
          <MoriText style={{ fontWeight: "700", marginTop: 2 }}>
            {farm.coins}
          </MoriText>
        </MoriPressable>
      </View>

      {/* Thanh kinh nghiệm */}
      <MoriCard style={{ marginTop: 16 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <MoriText style={{ fontWeight: "600" }}>Cấp {farm.level}</MoriText>
          <MoriText muted variant="small">
            {farm.xp} kinh nghiệm · {usedPlots}/{limit} ô đất
          </MoriText>
        </View>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={`Kinh nghiệm cấp ${farm.level}`}
          accessibilityValue={{ min: 0, max: xpSpan, now: xpIntoLevel }}
          style={{
            height: 8,
            borderRadius: 4,
            backgroundColor: t.soft,
            marginTop: 10,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${xpPercent}%`,
              height: "100%",
              borderRadius: 4,
              backgroundColor: t.primary,
            }}
          />
        </View>
      </MoriCard>

      <View style={{ height: 14 }} />

      <FarmScene
        plots={farm.plots}
        now={now}
        selectedTile={selectedTile}
        onSelectTile={(id) => setSelectedTile(id === selectedTile ? null : id)}
      />

      <View
        style={{
          flexDirection: "row",
          gap: 10,
          marginTop: 16,
        }}
      >
        <View style={{ flex: 1 }}>
          <MoriButton
            icon="leaf-outline"
            onPress={() => {
              if (!selectedTile) setSelectedTile(firstEmptyTile(farm.plots));
              else setSelectedTile(null);
            }}
          >
            Trồng cây
          </MoriButton>
        </View>
        <View style={{ flex: 1 }}>
          <MoriButton
            variant="secondary"
            icon="storefront-outline"
            onPress={() => setShopOpen(true)}
          >
            Cửa hàng
          </MoriButton>
        </View>
        <View style={{ flex: 1 }}>
          <MoriButton
            variant="secondary"
            icon="basket-outline"
            onPress={() => setSellerOpen(true)}
          >
            Bán ({hasHarvest ? "có hàng" : "kho"})
          </MoriButton>
        </View>
      </View>

      <SectionHeading title="Túi hạt giống" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {SEEDS.map((seed) => {
          const have = farm.seeds[seed.id] ?? 0;
          return (
            <MoriCard
              key={seed.id}
              style={{ paddingVertical: 10, paddingHorizontal: 12, minWidth: 108 }}
            >
              <MoriText style={{ fontSize: 22 }} translate={false}>
                {seed.emoji}
              </MoriText>
              <MoriText variant="small" style={{ fontWeight: "600" }}>
                {seed.name}
              </MoriText>
              <MoriText
                variant="small"
                style={{ color: have > 0 ? t.primary : t.muted }}
              >
                {have} hạt
              </MoriText>
            </MoriCard>
          );
        })}
      </View>

      <MoriText muted variant="small" style={{ textAlign: "center", paddingVertical: 16 }}>
        Cửa hàng làm mới hàng sau {formatCountdown(farm.nextShopReset, now)}.
      </MoriText>

      <PlotActionSheet
        visible={!!selectedTile}
        onClose={closePlot}
        plot={selectedPlot}
        now={now}
        seeds={farm.seeds}
        onPlant={(seedId: SeedId) => {
          if (!selectedTile) return;
          farm.plant(selectedTile, seedId, Date.now());
          closePlot();
        }}
        onHarvest={() => {
          if (!selectedTile) return;
          farm.harvest(selectedTile, Date.now());
          closePlot();
        }}
      />

      <ShopPanel
        visible={shopOpen}
        onClose={() => setShopOpen(false)}
        coins={farm.coins}
        shop={farm.shop}
        nextReset={farm.nextShopReset}
        now={now}
        onBuy={(seedId, qty) => farm.buy(seedId, qty)}
      />

      <SellerPanel
        visible={sellerOpen}
        onClose={() => setSellerOpen(false)}
        coins={farm.coins}
        harvested={farm.harvested}
        onSell={(seedId, qty) => farm.sell(seedId, qty)}
        onSellAll={() => farm.sellAll()}
      />

      <MoriBottomSheet
        visible={guideOpen}
        onClose={() => {
          setGuideOpen(false);
          farm.markGuideSeen();
        }}
      >
        <MoriText variant="title">Chào mừng đến trang trại</MoriText>
        <MoriText muted>
          Chạm vào một ô đất để gieo hạt. Cây lớn dần và chín sau ít giây,
          bạn sẽ nhận được kinh nghiệm và một sản phẩm.
        </MoriText>
        <View style={{ height: 10 }} />
        <MoriText muted>
          Mang sản phẩm đến cửa thu mua để đổi lấy xu, dùng xu mua hạt giống
          đẹp hơn. Lên cấp sẽ mở thêm ô đất.
        </MoriText>
        <View style={{ height: 16 }} />
        <MoriButton
          onPress={() => {
            setGuideOpen(false);
            farm.markGuideSeen();
          }}
        >
          Bắt đầu
        </MoriButton>
      </MoriBottomSheet>
    </ScreenContainer>
  );
}

/** Chọn ô trống đầu tiên để gieo hạt nhanh. */
function firstEmptyTile(
  plots: Record<string, { stage: string }>,
): string | null {
  const entry = Object.entries(plots).find(
    ([, plot]) => plot.stage === "available" || plot.stage === "empty",
  );
  return entry ? entry[0] : null;
}
