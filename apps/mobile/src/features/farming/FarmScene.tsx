import { memo, useState } from "react";
import { LayoutChangeEvent, Pressable, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Polygon,
  Rect,
  Stop,
  Text,
} from "react-native-svg";
import { useTheme } from "../../theme";
import { TILE_IDS } from "./constants";
import {
  isReady,
  isoPosition,
  tileDrawOrder,
  TILE_HEIGHT,
  TILE_WIDTH,
} from "./logic";
import { Plot, SeedId, TileId } from "./types";
import { CropView } from "./CropView";
import { cropStageFor } from "./crop-stage";

const VIEW_W = 420;
const VIEW_H = 340;

const CROP_SIZE = 40;

type FarmSceneProps = {
  plots: Record<TileId, Plot>;
  now: number;
  selectedTile: TileId | null;
  onSelectTile: (tileId: TileId | null) => void;
};

export const FarmScene = memo(function FarmScene({
  plots,
  now,
  selectedTile,
  onSelectTile,
}: FarmSceneProps) {
  const t = useTheme();
  const night = t.night;
  // Ước lượng chiều rộng màn hình để render ngay (onLayout tinh chỉnh sau).
  const [width, setWidth] = useState(360);
  const scale = width / VIEW_W;
  const sceneH = (width * VIEW_H) / VIEW_W;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && Math.abs(w - width) > 1) setWidth(w);
  };

  const originX = VIEW_W / 2;
  const originY = 60;
  const positions = TILE_IDS.map((id) => ({
    id,
    pos: isoPosition(id, originX, originY),
  }));

  // Convert viewBox units → measured scene pixels.
  const px = (units: number) => units * scale;
  const tileWpx = px(TILE_WIDTH);
  const tileHpx = px(TILE_HEIGHT);

  return (
    <View onLayout={onLayout} style={{ width: "100%" }}>
      <View
        accessibilityLabel="Trang trại của bạn"
        style={{
          width: "100%",
          height: sceneH,
          borderRadius: 24,
          overflow: "hidden",
          backgroundColor: night ? "#22393A" : "#DCE8CF",
        }}
      >
        <Svg
          width={width}
          height={sceneH}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
        >
          <Defs>
            <LinearGradient id="f-sky" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={night ? "#243E3B" : "#C9DBBF"} />
              <Stop offset="1" stopColor={night ? "#31524A" : "#EDF3DA"} />
            </LinearGradient>
            <LinearGradient id="f-far" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={night ? "#48685F" : "#8FA98B"} />
              <Stop offset="1" stopColor={night ? "#345544" : "#B6CBA2"} />
            </LinearGradient>
          </Defs>

          <Rect width={VIEW_W} height={VIEW_H} fill="url(#f-sky)" />
          <Circle
            cx={night ? 330 : 320}
            cy={night ? 44 : 34}
            r={night ? 18 : 22}
            fill={night ? "#E7E6B6" : "#FAF5D8"}
            opacity={night ? 0.9 : 0.85}
          />
          {/* Núi xa */}
          <Path
            d={`M0 ${originY - 22} L${VIEW_W} ${originY - 22} L${VIEW_W} ${originY + 26} L0 ${originY + 26}Z`}
            fill="url(#f-far)"
            opacity="0.75"
          />

          <GroundPlane night={night} />
          <Decorations night={night} />

          {/* Ô đất (vẽ theo đúng chiều sâu) */}
          {tileDrawOrder().map((id) => {
            const { pos } = positions.find((p) => p.id === id)!;
            const plot = plots[id];
            return (
              <G key={id}>
                <IsoTile
                  cx={pos.x}
                  cy={pos.y}
                  isDug={plot?.stage === "planted" || plot?.stage === "empty"}
                  isSelected={selectedTile === id}
                  isLocked={plot?.stage === "locked"}
                />
              </G>
            );
          })}
        </Svg>

        {/* Lớp tương tác + cây trồng, cùng không gian toạ độ với SVG */}
        <View
          pointerEvents="box-none"
          style={{ position: "absolute", top: 0, left: 0, right: 0 }}
        >
          {positions.map(({ id, pos }) => {
            const plot = plots[id];
            const cx = px(pos.x);
            const cy = px(pos.y);
            const locked = plot?.stage === "locked";
            return (
              <Pressable
                key={id}
                accessibilityRole="button"
                accessibilityLabel={
                  locked
                    ? "Ô đất đang khoá"
                    : plot?.stage === "planted"
                      ? `Ô đất đang trồng ${plot.seedId}`
                      : "Ô đất trống, chạm để chọn"
                }
                accessibilityState={{ disabled: false }}
                onPress={() => onSelectTile(locked ? null : id)}
                style={({ pressed }) => ({
                  position: "absolute",
                  left: cx - tileWpx / 2,
                  top: cy - tileHpx / 2,
                  width: tileWpx,
                  height: tileHpx,
                  borderRadius: 10,
                  backgroundColor: pressed ? "#FFFFFF14" : "transparent",
                  opacity: locked ? 0.45 : 1,
                })}
              />
            );
          })}

          {positions.map(({ id, pos }) => {
            const plot = plots[id];
            if (plot?.stage !== "planted" || !plot.seedId) return null;
            const cx = px(pos.x);
            const cy = px(pos.y);
            const stage = cropStageFor(
              plot.seedId,
              plot.plantedAt,
              plot.readyAt,
              now,
            );
            return (
              <CropView
                key={id}
                seedId={plot.seedId as SeedId}
                stage={stage}
                left={cx - CROP_SIZE / 2}
                top={cy - CROP_SIZE * 0.7}
                size={CROP_SIZE}
                ready={isReady(plot, now)}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
});

function GroundPlane({ night }: { night: boolean }) {
  const fill = night ? "#2E4C3B" : "#C6D5A9";
  const stroke = night ? "#203A2C" : "#A9BD85";
  const points = "210,41 362,117 172,212 20,136";
  return (
    <G>
      <Polygon
        points={points}
        fill={fill}
        stroke={stroke}
        strokeWidth="1.5"
        opacity="0.92"
      />
    </G>
  );
}

function IsoTile({
  cx,
  cy,
  isDug,
  isSelected,
  isLocked,
}: {
  cx: number;
  cy: number;
  isDug: boolean;
  isSelected: boolean;
  isLocked: boolean;
}) {
  const t = useTheme();
  const night = t.night;
  const w = TILE_WIDTH / 2;
  const h = TILE_HEIGHT / 2;
  const points = `${cx},${cy - h} ${cx + w},${cy} ${cx},${cy + h} ${cx - w},${cy}`;
  const base = isLocked
    ? night
      ? "#253B2E"
      : "#B0BFA1"
    : isDug
      ? night
        ? "#3E2F24"
        : "#8B6F4C"
      : night
        ? "#35584A"
        : "#B3CB90";
  const edge = isSelected
    ? t.primary
    : isLocked
      ? night
        ? "#1A2C24"
        : "#97A98F"
      : night
        ? "#1E3527"
        : "#8FA878";

  return (
    <G>
      <Polygon
        points={points}
        fill={base}
        stroke={edge}
        strokeWidth={isSelected ? 2 : 1}
      />
      {isSelected && (
        <Polygon
          points={points}
          fill="none"
          stroke={t.primary}
          strokeWidth="1.5"
          opacity="0.5"
          transform="translate(0 -2)"
        />
      )}
      {isDug && !isLocked && (
        <G opacity="0.6">
          <Path
            d={`M${cx - w + 10} ${cy} L${cx + w - 10} ${cy}`}
            stroke={night ? "#5A4635" : "#6B503A"}
            strokeWidth="1"
          />
          <Path
            d={`M${cx - w + 15} ${cy - 4} L${cx + w - 15} ${cy - 4}`}
            stroke={night ? "#5A4635" : "#6B503A"}
            strokeWidth="1"
            opacity="0.6"
          />
          <Path
            d={`M${cx - w + 15} ${cy + 4} L${cx + w - 15} ${cy + 4}`}
            stroke={night ? "#5A4635" : "#6B503A"}
            strokeWidth="1"
            opacity="0.6"
          />
        </G>
      )}
      {isLocked && (
        <G opacity="0.55">
          <Circle
            cx={cx}
            cy={cy}
            r="6"
            fill="none"
            stroke={edge}
            strokeWidth="1.2"
          />
          <Path
            d={`M${cx - 3} ${cy + 4} L${cx} ${cy - 3} L${cx + 3} ${cy + 4}Z`}
            fill="none"
            stroke={edge}
            strokeWidth="1"
          />
        </G>
      )}
    </G>
  );
}

function Decorations({ night }: { night: boolean }) {
  return (
    <G opacity={0.96}>
      <FarmBuilding x={58} y={150} label="SHOP" night={night} />
      <FarmBuilding x={362} y={150} label="SELL" night={night} />
      <DecorTree x={40} y={262} scale={0.58} night={night} />
      <DecorTree x={380} y={282} scale={0.62} night={night} />
      <DecorTree x={210} y={300} scale={0.5} night={night} />
    </G>
  );
}

function FarmBuilding({
  x,
  y,
  label,
  night,
}: {
  x: number;
  y: number;
  label: string;
  night: boolean;
}) {
  const isShop = label === "SHOP";
  const fill = night
    ? isShop
      ? "#5A4F3B"
      : "#4A5B54"
    : isShop
      ? "#E0D2B4"
      : "#D9E4CE";
  const roof = night
    ? isShop
      ? "#705A3B"
      : "#68806C"
    : isShop
      ? "#A2754E"
      : "#8B9E7F";
  const door = night
    ? isShop
      ? "#E0D49A"
      : "#A0B8A8"
    : isShop
      ? "#776653"
      : "#405E48";
  const textFill = night ? "#C9C0A0" : "#5A4A34";
  return (
    <G transform={`translate(${x} ${y})`}>
      <Path d="M-22 16 L-22 -6 L0 -20 L22 -6 L22 16Z" fill={fill} />
      <Path
        d="M-27 -4 L0 -24 L27 -4"
        stroke={roof}
        strokeWidth="5"
        fill="none"
      />
      <Rect x="-6" y="0" width="12" height="16" rx="2" fill={door} />
      <Text
        x={0}
        y={-26}
        fontSize={8}
        fill={textFill}
        textAnchor="middle"
        fontWeight="600"
      >
        {label}
      </Text>
    </G>
  );
}

function DecorTree({
  x,
  y,
  scale,
  night,
}: {
  x: number;
  y: number;
  scale: number;
  night: boolean;
}) {
  const trunk = night ? "#4C5745" : "#6C7150";
  const leaf = night ? "#34523E" : "#91A681";
  const leafDark = night ? "#2E4C38" : "#7E9B67";
  return (
    <G transform={`translate(${x} ${y}) scale(${scale})`}>
      <Path
        d="M0 24 Q4 -10 0 -65 M1 -20 L-17 -38 M2 -10 L18 -35"
        stroke={trunk}
        strokeWidth="4"
        fill="none"
      />
      <Ellipse cx="0" cy="-58" rx="36" ry="38" fill={leaf} />
      <Ellipse cx="-24" cy="-43" rx="25" ry="25" fill={leaf} />
      <Ellipse cx="25" cy="-39" rx="26" ry="28" fill={leafDark} />
    </G>
  );
}

export type { FarmSceneProps };
