import { useEffect } from "react";
import { View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";
import { useTheme } from "../../theme";
function Tree({
  x,
  y,
  scale = 1,
  color = "#75906A",
}: {
  x: number;
  y: number;
  scale?: number;
  color?: string;
}) {
  return (
    <G transform={`translate(${x} ${y}) scale(${scale})`}>
      <Path
        d="M0 24 Q4 -10 0 -65 M1 -20 L-17 -38 M2 -10 L18 -35"
        stroke="#6C7150"
        strokeWidth="4"
        fill="none"
      />
      <Ellipse cx="0" cy="-58" rx="36" ry="38" fill={color} />
      <Ellipse cx="-24" cy="-43" rx="25" ry="25" fill={color} />
      <Ellipse cx="25" cy="-39" rx="26" ry="28" fill={color} />
      <Path
        d="M0 19 L0 -46 M0 -15 L-13 -28 M0 -7 L15 -23"
        stroke="#68784D"
        strokeWidth="2.5"
        fill="none"
        opacity=".7"
      />
    </G>
  );
}
export function GardenScene({
  level = 1,
  large = false,
  rain = false,
}: {
  level?: number;
  large?: boolean;
  rain?: boolean;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const movement = useSharedValue(0);
  useEffect(() => {
    if (!reduced)
      movement.value = withRepeat(
        withTiming(1, {
          duration: 9000,
          easing: Easing.inOut(Easing.sin),
          reduceMotion: ReduceMotion.System,
        }),
        -1,
        true,
      );
    return () => cancelAnimation(movement);
  }, [movement, reduced]);
  const cloudStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: movement.value * 13 }],
  }));
  const fireflyStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + movement.value * 0.5,
    transform: [{ translateY: -movement.value * 7 }],
  }));
  return (
    <View
      accessible
      accessibilityLabel={`Khu vườn yên bình, cây ở giai đoạn ${level}.`}
      style={{
        height: large ? 310 : 250,
        overflow: "hidden",
        borderRadius: 30,
        backgroundColor: t.night ? "#243E3A" : "#E7EBDD",
      }}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 400 280"
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={t.night ? "#263E3B" : "#E6EAD9"} />
            <Stop offset="1" stopColor={t.night ? "#3C5547" : "#F0EEDC"} />
          </LinearGradient>
          <LinearGradient id="lake" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={t.night ? "#48685F" : "#B9D0BF"} />
            <Stop offset="1" stopColor={t.night ? "#304C48" : "#DEE3CF"} />
          </LinearGradient>
        </Defs>
        <Rect width="400" height="280" fill="url(#sky)" />
        <Circle
          cx="310"
          cy="59"
          r="23"
          fill={t.night ? "#E7E6B6" : "#FAF5D8"}
          opacity=".9"
        />
        <Path
          d="M-20 162 Q45 88 123 140 Q196 93 270 149 Q346 101 420 151 L420 280 L-20 280Z"
          fill={t.night ? "#3D5545" : "#C5D1B2"}
        />
        <Path
          d="M-10 189 Q49 131 135 171 Q208 135 277 171 Q340 142 414 173 L414 280 L-10 280Z"
          fill={t.night ? "#304D39" : "#A8BA90"}
        />
        <Tree
          x={51}
          y={175}
          scale={0.58}
          color={t.night ? "#34523E" : "#91A681"}
        />
        <Tree
          x={347}
          y={179}
          scale={0.7}
          color={t.night ? "#36543F" : "#91A681"}
        />
        <Path
          d="M0 218 Q100 181 180 211 Q268 174 400 220 L400 280 L0 280Z"
          fill={t.night ? "#48613F" : "#BAC698"}
        />
        <Ellipse cx="252" cy="235" rx="111" ry="27" fill="url(#lake)" />
        <Path
          d="M213 227 Q252 224 288 227 M240 236 L301 236 M220 244 L257 244"
          stroke={t.night ? "#78958A" : "#E7EBDB"}
          strokeWidth="1.5"
          fill="none"
        />
        <Ellipse
          cx="132"
          cy="223"
          rx="72"
          ry="20"
          fill={t.night ? "#536846" : "#D4D9AA"}
        />
        <Tree
          x={135}
          y={202}
          scale={0.95 + level * 0.045}
          color={t.night ? "#68865A" : "#7E9B67"}
        />
        <Ellipse
          cx="139"
          cy="152"
          rx="27"
          ry="30"
          fill={t.night ? "#809469" : "#9BB57C"}
          opacity=".6"
        />
        <Path
          d="M0 263 Q82 224 148 264 L159 280 H0Z"
          fill={t.night ? "#365038" : "#91A776"}
        />
        <Path
          d="M314 280 Q352 238 405 255 L405 280Z"
          fill={t.night ? "#365038" : "#9CAF81"}
        />
        {level > 1 &&
          [67, 89, 166, 322, 344].map((x, i) => (
            <G key={x}>
              <Path
                d={`M${x} ${240 + (i % 2) * 9} l0 -9`}
                stroke="#728853"
                strokeWidth="1.4"
              />
              <Circle
                cx={x}
                cy={230 + (i % 2) * 9}
                r="3"
                fill={i % 2 ? "#E7D7A2" : "#F5E8CB"}
              />
            </G>
          ))}
        <Ellipse cx="191" cy="250" rx="8" ry="4" fill="#AAA88B" />
        <Ellipse cx="181" cy="255" rx="6" ry="3" fill="#C1BDA1" />
        {rain &&
          Array.from({ length: 25 }, (_, i) => (
            <Path
              key={i}
              d={`M${(i * 19) % 400} ${(i * 37) % 260} l-4 14`}
              stroke="#C4D6C9"
              opacity=".7"
            />
          ))}
      </Svg>
      <Animated.View
        pointerEvents="none"
        style={[
          { position: "absolute", top: 27, left: 20, width: 160, height: 60 },
          cloudStyle,
        ]}
      >
        <Svg viewBox="0 0 160 60">
          <Path
            d="M10 40 Q14 28 35 31 Q42 10 61 24 Q79 20 88 35 Q107 32 112 42Z"
            fill={t.night ? "#A0B5A3" : "#FFFFFF"}
            opacity=".25"
          />
        </Svg>
      </Animated.View>
      {t.night && (
        <Animated.View
          pointerEvents="none"
          style={[{ position: "absolute", inset: 0 }, fireflyStyle]}
        >
          <Svg width="100%" height="100%" viewBox="0 0 400 280">
            {[75, 175, 204, 287, 334].map((x, i) => (
              <Circle
                key={x}
                cx={x}
                cy={165 + (i % 3) * 23}
                r="2"
                fill="#E5E7A5"
              />
            ))}
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}
