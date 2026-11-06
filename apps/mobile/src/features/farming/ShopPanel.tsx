import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  MoriBottomSheet,
  MoriButton,
  MoriCard,
  MoriText,
} from "../../components/ui";
import { useTheme } from "../../theme";
import { SEEDS } from "./constants";
import { formatCountdown } from "./format";
import { FarmShop, SeedId } from "./types";

type Props = {
  visible: boolean;
  onClose: () => void;
  coins: number;
  shop: FarmShop;
  nextReset: number;
  now: number;
  onBuy: (seedId: SeedId, qty: number) => void;
};

export function ShopPanel({
  visible,
  onClose,
  coins,
  shop,
  nextReset,
  now,
  onBuy,
}: Props) {
  const t = useTheme();
  return (
    <MoriBottomSheet visible={visible} onClose={onClose}>
      <MoriText variant="title">Cửa hàng hạt giống</MoriText>
      <MoriText muted variant="small">
        Hàng mới sẽ đầy lại sau {formatCountdown(nextReset, now)}. Hạt càng hiếm
        thì giá càng cao.
      </MoriText>
      <View style={{ height: 12 }} />
      {SEEDS.map((seed) => {
        const stock = shop[seed.id] ?? 0;
        const canBuy = stock > 0 && coins >= seed.price;
        return (
          <MoriCard key={seed.id} style={{ marginBottom: 10 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <MoriText style={{ fontSize: 26 }} translate={false}>
                  {seed.emoji}
                </MoriText>
                <View>
                  <MoriText style={{ fontWeight: "600" }}>{seed.name}</MoriText>
                  <MoriText muted variant="small">
                    {seed.price} xu · bán {seed.sellPrice} xu · +{seed.xp} kinh
                    nghiệm
                  </MoriText>
                </View>
              </View>
              <MoriText
                variant="small"
                style={{
                  color: stock > 0 ? t.primary : t.muted,
                  fontWeight: "600",
                }}
              >
                {stock > 0 ? `Còn ${stock}` : "Hết hàng"}
              </MoriText>
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <View style={{ flex: 1 }}>
                <MoriButton
                  size="medium"
                  disabled={!canBuy}
                  onPress={() => onBuy(seed.id, 1)}
                >
                  Mua 1
                </MoriButton>
              </View>
              <View style={{ flex: 1 }}>
                <MoriButton
                  size="medium"
                  variant="secondary"
                  disabled={!canBuy || coins < seed.price * 2}
                  onPress={() => onBuy(seed.id, 2)}
                >
                  Mua 2
                </MoriButton>
              </View>
              <View style={{ flex: 1 }}>
                <MoriButton
                  size="medium"
                  variant="ghost"
                  disabled={!canBuy}
                  onPress={() => onBuy(seed.id, stock)}
                >
                  Mua tất cả
                </MoriButton>
              </View>
            </View>
          </MoriCard>
        );
      })}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          paddingVertical: 10,
        }}
      >
        <Ionicons name="wallet-outline" size={16} color={t.muted} />
        <MoriText muted variant="small">
          Bạn đang có {coins} xu
        </MoriText>
      </View>
    </MoriBottomSheet>
  );
}
