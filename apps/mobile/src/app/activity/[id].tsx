import { useEffect, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity } from "@mori/shared";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";
import {
  MoriButton,
  MoriText,
  ScreenContainer,
  ErrorNote,
  Loading,
} from "../../components/ui";
import { GardenScene } from "../../features/garden/GardenScene";
import { request, refresh } from "../../services/api";
import { useTheme } from "../../theme";
export default function ActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const reduced = useReducedMotion();
  const [session, setSession] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const scale = useSharedValue(1);
  const list = useQuery({
    queryKey: ["self-care"],
    queryFn: () => request<Activity[]>("/self-care"),
  });
  const activity = list.data?.find((a) => a.id === id);
  const start = useMutation({
    mutationFn: () => request<{ id: string }>(`/self-care/${id}/start`, "POST"),
    onSuccess: (result) => {
      setSession(result.id);
      setRunning(true);
    },
  });
  const complete = useMutation({
    mutationFn: () =>
      request(`/self-care/${id}/complete`, "POST", { session_id: session }),
    onSuccess: () => {
      setDone(true);
      setRunning(false);
      void refresh();
    },
  });
  useEffect(() => {
    if (!running || !activity) return;
    const interval = setInterval(
      () =>
        setElapsed((n) => {
          if (n + 1 >= activity.duration) {
            setRunning(false);
            return activity.duration;
          }
          return n + 1;
        }),
      1000,
    );
    return () => clearInterval(interval);
  }, [running, activity]);
  useEffect(() => {
    if (running && !reduced)
      scale.value = withRepeat(
        withSequence(
          withTiming(1.18, {
            duration: 4000,
            easing: Easing.inOut(Easing.sin),
            reduceMotion: ReduceMotion.System,
          }),
          withTiming(1, {
            duration: 6000,
            easing: Easing.inOut(Easing.sin),
            reduceMotion: ReduceMotion.System,
          }),
        ),
        -1,
      );
    else {
      cancelAnimation(scale);
      scale.value = 1;
    }
    return () => cancelAnimation(scale);
  }, [running, reduced, scale]);
  const breathing = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  if (list.isPending)
    return (
      <ScreenContainer back>
        <Loading />
      </ScreenContainer>
    );
  if (!activity)
    return (
      <ScreenContainer back>
        <ErrorNote
          error={list.error ?? "Không tìm thấy hoạt động."}
          retry={() => void list.refetch()}
        />
      </ScreenContainer>
    );
  const remaining = Math.max(0, activity.duration - elapsed);
  return (
    <ScreenContainer back>
      <MoriText muted variant="small">
        MỘT KHOẢNG NGHỈ
      </MoriText>
      <MoriText variant="title">
        {done ? "Một chút chăm sóc đã ở lại." : activity.title}
      </MoriText>
      <MoriText muted>
        {done
          ? "Khu vườn vừa lớn thêm một chút. Bạn có thể trở về với ngày của mình."
          : activity.description}
      </MoriText>
      {activity.category === "breathing" ? (
        <View
          style={{
            height: 260,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Animated.View
            style={[
              {
                width: 180,
                height: 180,
                borderRadius: 90,
                backgroundColor: t.soft,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 16,
                borderColor: t.line,
              },
              breathing,
            ]}
          >
            <MoriText variant="subtitle">
              {running
                ? elapsed % 10 < 4
                  ? "Hít vào"
                  : "Thở ra"
                : "Thở tự nhiên"}
            </MoriText>
          </Animated.View>
        </View>
      ) : (
        <GardenScene large rain={id === "rain"} />
      )}
      {!done && (
        <>
          <MoriText
            style={{
              textAlign: "center",
              fontSize: 30,
              fontVariant: ["tabular-nums"],
            }}
          >
            {Math.floor(remaining / 60)}:
            {String(remaining % 60).padStart(2, "0")}
          </MoriText>
          {activity.steps.map((step, i) => (
            <View key={step} style={{ flexDirection: "row", gap: 14 }}>
              <MoriText muted>{i + 1}.</MoriText>
              <MoriText style={{ flex: 1 }}>{step}</MoriText>
            </View>
          ))}
          <ErrorNote error={start.error ?? complete.error} />
          {!session ? (
            <MoriButton
              loading={start.isPending}
              onPress={() => start.mutate()}
            >
              Bắt đầu khi bạn sẵn sàng
            </MoriButton>
          ) : (
            <>
              <MoriButton
                loading={complete.isPending}
                onPress={() => complete.mutate()}
              >
                {remaining === 0 ? "Hoàn thành" : "Mình đã thực hiện xong"}
              </MoriButton>
              {remaining > 0 && (
                <MoriButton secondary onPress={() => setRunning(!running)}>
                  {running ? "Tạm dừng" : "Tiếp tục"}
                </MoriButton>
              )}
            </>
          )}
          <MoriButton secondary onPress={() => router.replace("/(tabs)")}>
            Dừng ở đây cũng được
          </MoriButton>
        </>
      )}
      {done && (
        <MoriButton onPress={() => router.replace("/(tabs)")}>
          Về khu vườn
        </MoriButton>
      )}
    </ScreenContainer>
  );
}
