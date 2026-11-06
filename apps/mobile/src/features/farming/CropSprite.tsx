import { memo } from "react";
import Svg, { Circle, Ellipse, G, Path } from "react-native-svg";
import { SeedId } from "./types";

/**
 * Sprite cây trồng theo 4 giai đoạn:
 * 0 = mới gieo (mô đất), 1 = mầm, 2 = đang lớn, 3 = chín (có trái).
 */
export type CropStage = 0 | 1 | 2 | 3;

type Props = {
  seedId: SeedId;
  stage: CropStage;
  size?: number;
};

/** Màu từng loại cây: lá, trái, thân. */
const palette: Record<
  SeedId,
  { leaf: string; leafDark: string; fruit: string; stem: string }
> = {
  rice: { leaf: "#9BC46B", leafDark: "#7FAE52", fruit: "#E7CE7E", stem: "#C9B96B" },
  wheat: { leaf: "#A9C867", leafDark: "#8FB355", fruit: "#E3C878", stem: "#D6C479" },
  corn: { leaf: "#8CC168", leafDark: "#71A550", fruit: "#F2C94C", stem: "#9BBF5C" },
  tomato: { leaf: "#7FB861", leafDark: "#639C4A", fruit: "#E2614B", stem: "#87AE5A" },
  strawberry: { leaf: "#84BC66", leafDark: "#689E4E", fruit: "#DE4E63", stem: "#9C6B4E" },
};

const Crop = memo(function Crop({
  seedId,
  stage,
  size = 48,
}: Props) {
  const c = palette[seedId];
  if (stage === 0)
    return (
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Ellipse cx="24" cy="34" rx="13" ry="5" fill="#8A6A4F" opacity="0.35" />
        <Ellipse cx="24" cy="32" rx="11" ry="4" fill="#7C5F46" opacity="0.6" />
        <Circle cx="24" cy="29" r="2.4" fill="#C9A47C" />
      </Svg>
    );

  const height = stage === 1 ? 12 : stage === 2 ? 21 : 27;
  const baseY = 34;

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Ellipse cx="24" cy={baseY + 3} rx="12" ry="4.5" fill="#7C5F46" opacity="0.3" />
      {/* Thân */}
      <Path
        d={`M24 ${baseY} L24 ${baseY - height}`}
        stroke={c.stem}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      {/* Lá */}
      <Path
        d={`M24 ${baseY - height * 0.5} Q12 ${baseY - height * 0.72} 9 ${baseY - height * 0.42} Q18 ${baseY - height * 0.3} 24 ${baseY - height * 0.44}Z`}
        fill={c.leaf}
      />
      <Path
        d={`M24 ${baseY - height * 0.66} Q36 ${baseY - height * 0.88} 39 ${baseY - height * 0.58} Q30 ${baseY - height * 0.46} 24 ${baseY - height * 0.6}Z`}
        fill={c.leafDark}
      />
      {stage >= 2 && (
        <Path
          d={`M24 ${baseY - height * 0.78} Q16 ${baseY - height * 0.96} 13 ${baseY - height * 0.74} Q21 ${baseY - height * 0.62} 24 ${baseY - height * 0.72}Z`}
          fill={c.leaf}
        />
      )}
      {/* Trái / hoa */}
      {seedId === "rice" && stage >= 2 && (
        <>
          <Ellipse
            cx="24"
            cy={baseY - height - 2}
            rx="3.2"
            ry="7"
            fill={c.fruit}
            transform={`rotate(-8 24 ${baseY - height - 2})`}
          />
          <Ellipse
            cx="24"
            cy={baseY - height - 2}
            rx="3.2"
            ry="7"
            fill={c.fruit}
            transform={`rotate(8 24 ${baseY - height - 2})`}
          />
        </>
      )}
      {seedId === "wheat" && stage >= 2 && (
        <>
          <Ellipse cx="24" cy={baseY - height - 2} rx="4" ry="8" fill={c.fruit} />
          <Path
            d={`M24 ${baseY - height - 9} L24 ${baseY - height + 5}`}
            stroke="#C2A85F"
            strokeWidth="1.2"
          />
        </>
      )}
      {seedId === "corn" && stage >= 2 && (
        <>
          <Ellipse
            cx="24"
            cy={baseY - height * 0.62}
            rx="5"
            ry="9"
            fill={c.fruit}
          />
          <Path
            d={`M20 ${baseY - height * 0.62} L28 ${baseY - height * 0.62}`}
            stroke="#D8B23C"
            strokeWidth="1"
            opacity="0.6"
          />
        </>
      )}
      {seedId === "tomato" && stage >= 2 && (
        <>
          <Circle cx="20" cy={baseY - height * 0.78} r="4.6" fill={c.fruit} />
          <Circle cx="28" cy={baseY - height * 0.66} r="3.6" fill="#EE7A63" />
          <Path
            d={`M20 ${baseY - height * 0.78 - 4} l-2 -2 M20 ${baseY - height * 0.78 - 4} l2 -2`}
            stroke={c.leafDark}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </>
      )}
      {seedId === "strawberry" && stage >= 2 && (
        <>
          <Path
            d={`M20 ${baseY - height * 0.72} q-4 6 0 10 q4 -4 0 -10Z`}
            fill={c.fruit}
          />
          <Path
            d={`M28 ${baseY - height * 0.6} q-3.4 5 0 8.4 q3.4 -3.4 0 -8.4Z`}
            fill="#EE6B7C"
          />
          <Path
            d={`M16 ${baseY - height * 0.76} l4 1 l4 -1`}
            stroke={c.leafDark}
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </>
      )}
      {stage === 3 && (
        <G>
          <Circle cx="35" cy="16" r="2" fill="#FFF0A8" opacity="0.9" />
          <Circle cx="11" cy="20" r="1.5" fill="#FFF0A8" opacity="0.7" />
        </G>
      )}
    </Svg>
  );
});

export default Crop;
