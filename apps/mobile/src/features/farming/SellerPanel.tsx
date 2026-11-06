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
import { harvestedValue } from "./logic";
import { SeedId } from "./types";

type Props = {
  visible: boolean;
  onClose: () => void;
  coins: number;
  harvested: Record<SeedId, number>;
  onSell: (seedId: SeedId, qty: number) => void;
  onSellAll: () => void;
};

export function SellerPanel({
  visible,
  onClose,
  coins,
  harvested,
  onSell,
  onSellAll,
}: Props) {
  const t = useTheme();
  const total = harvestedValue(harvested);
  const hasAny = SEEDS.some((seed) => (harvested[seed.id] ?? 0) > 0);

  return (
    <MoriBottomSheet visible={visible} onClose={onClose}>
      <MoriText variant="title">Cửa thu mua</MoriText>
      <MoriText muted variant="small">
        Người thu mua trả gấp đôi giá hạt giống cho mỗi sản phẩm.
      </MoriText>
      <View style={{ height: 12 }} />

      {!hasAny && (
        <MoriCard>
          <MoriText muted>
            Kho của bạn còn trống. Gặt cây chín rồi bán ở đây nhé.
          </MoriText>
        </MoriCard>
      )}

      {SEEDS.filter((seed) => (harvested[seed.id] ?? 0) > 0).map((seed) => {
        const count = harvested[seed.id] ?? 0;
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
                    {count} sản phẩm · {seed.sellPrice} xu mỗi cái
                  </MoriText>
                </View>
              </View>
              <MoriText
                variant="small"
                style={{ color: t.primary, fontWeight: "600" }}
              >
                +{seed.sellPrice * count} xu
              </MoriText>
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <View style={{ flex: 1 }}>
                <MoriButton
                  size="medium"
                  onPress={() => onSell(seed.id, 1)}
                >
                  Bán 1
                </MoriButton>
              </View>
              <View style={{ flex: 1 }}>
                <MoriButton
                  size="medium"
                  variant="secondary"
                  onPress={() => onSell(seed.id, count)}
                >
                  Bán tất cả
                </MoriButton>
              </View>
            </View>
          </MoriCard>
        );
      })}

      {hasAny && (
        <MoriButton onPress={onSellAll} icon="cash-outline">
          Bán toàn bộ · +{total} xu
        </MoriButton>
      )}

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
