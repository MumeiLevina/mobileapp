import { View } from "react-native";
import {
  MoriBottomSheet,
  MoriButton,
  MoriCard,
  MoriText,
} from "../../components/ui";
import { SEEDS } from "./constants";
import { formatDuration } from "./format";
import { Plot, SeedId } from "./types";

type Props = {
  visible: boolean;
  onClose: () => void;
  plot: Plot | undefined;
  now: number;
  seeds: Record<SeedId, number>;
  onPlant: (seedId: SeedId) => void;
  onHarvest: () => void;
};

export function PlotActionSheet({
  visible,
  onClose,
  plot,
  now,
  seeds,
  onPlant,
  onHarvest,
}: Props) {
  const ready =
    !!plot && plot.stage === "planted" && plot.readyAt !== undefined && plot.readyAt <= now;
  const growing =
    !!plot && plot.stage === "planted" && plot.readyAt !== undefined && plot.readyAt > now;

  return (
    <MoriBottomSheet visible={visible} onClose={onClose}>
      <MoriText variant="title">
        {ready ? "Cây đã chín" : growing ? "Cây đang lớn" : "Ô đất của bạn"}
      </MoriText>

      {ready && (
        <>
          <MoriText muted variant="small">
            Cây đã chín rồi. Gặt xong bạn sẽ nhận kinh nghiệm và một sản
            phẩm để bán cho cửa thu mua.
          </MoriText>
          <View style={{ height: 12 }} />
          <MoriButton icon="basket-outline" onPress={onHarvest}>
            Gặt cây
          </MoriButton>
        </>
      )}

      {growing && plot?.readyAt && (
        <>
          <MoriText muted variant="small">
            Còn {formatDuration(plot.readyAt - now)} nữa cây sẽ chín.
          </MoriText>
        </>
      )}

      {!plot || plot.stage === "available" || plot.stage === "empty" ? (
        <>
          <MoriText muted variant="small">
            Chọn một loại hạt giống để gieo xuống ô đất này.
          </MoriText>
          <View style={{ height: 12 }} />
          {SEEDS.map((seed) => {
            const have = seeds[seed.id] ?? 0;
            const disabled = have <= 0;
            return (
              <MoriCard key={seed.id} style={{ marginBottom: 8 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <MoriText style={{ fontSize: 24 }} translate={false}>
                      {seed.emoji}
                    </MoriText>
                    <View>
                      <MoriText style={{ fontWeight: "600" }}>{seed.name}</MoriText>
                      <MoriText muted variant="small">
                        Còn {have} hạt · chín sau {formatDuration(seed.growMs)}
                      </MoriText>
                    </View>
                  </View>
                  <View style={{ minWidth: 92 }}>
                    <MoriButton
                      size="medium"
                      disabled={disabled}
                      onPress={() => onPlant(seed.id)}
                    >
                      Gieo
                    </MoriButton>
                  </View>
                </View>
              </MoriCard>
            );
          })}
          {SEEDS.every((seed) => (seeds[seed.id] ?? 0) <= 0) && (
            <MoriText muted variant="small" style={{ textAlign: "center" }}>
              Bạn chưa có hạt giống nào. Ghé cửa hàng để mua nhé.
            </MoriText>
          )}
        </>
      ) : null}
    </MoriBottomSheet>
  );
}
