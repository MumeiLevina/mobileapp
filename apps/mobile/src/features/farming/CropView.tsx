import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Crop from "./CropSprite";
import { CropStage } from "./CropSprite";
import { SeedId } from "./types";

/**
 * Cây trồng đặt trên ô đất. Độ nghiêng nhẹ (sway) để cảnh có sức sống;
 * tôn trọng thiết lập giảm chuyển động của hệ điều hành.
 */
export function CropView({
  seedId,
  stage,
  left,
  top,
  size = 48,
  ready = false,
}: {
  seedId: SeedId;
  stage: CropStage;
  left: number;
  top: number;
  size?: number;
  ready?: boolean;
}) {
  const reduced = useReducedMotion();
  const sway = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    sway.value = withRepeat(
      withTiming(1, {
        duration: 2200,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
    return () => cancelAnimation(sway);
  }, [sway, reduced]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${sway.value * (ready ? 3 : 1.6)}deg` }],
    opacity: ready ? 0.92 + sway.value * 0.08 : 1,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.crop,
        { left, top, width: size, height: size },
        style,
      ]}
    >
      <Crop seedId={seedId} stage={stage} size={size} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  crop: { position: "absolute" },
});
