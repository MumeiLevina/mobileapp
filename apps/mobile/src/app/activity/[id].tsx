import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { activities } from "@mori/shared";
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
} from "../../components/ui";
import { GardenScene } from "../../features/garden/GardenScene";
import { request, refresh } from "../../services/api";
import { useTheme } from "../../theme";
import { useSession } from "../../store/session";
export default function ActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const owner = useSession((s) => s.userId);
  return <ActivitySession key={`${owner}:${id}`} id={id} owner={owner} />;
}
function ActivitySession({
  id,
  owner,
}: {
  id: string;
  owner: string | null;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const [session, setSession] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [localSession, setLocalSession] = useState(false);
  const lock = useRef(false);
  const scale = useSharedValue(1);
  const activity = activities.find((a) => a.id === id && a.enabled);
  function assertOwner() {
    if (!owner || useSession.getState().userId !== owner)
      throw new Error("Tài khoản đã thay đổi. Hãy mở lại màn hình để tiếp tục.");
  }
  const start = useMutation({
    networkMode: "always",
    mutationFn: () => {
      assertOwner();
      return request<{ id: string }>(`/self-care/${id}/start`, "POST", undefined, {
        owner,
      });
    },
    onSuccess: (result) => {
      if (useSession.getState().userId !== owner) return;
      setSession(result.id);
      setRunning(true);
    },
    onSettled: () => {
      lock.current = false;
    },
  });
  const complete = useMutation({
    networkMode: "always",
    mutationFn: () => {
      assertOwner();
      return request(`/self-care/${id}/complete`, "POST", { session_id: session }, {
        owner,
      });
    },
    onSuccess: () => {
      if (useSession.getState().userId !== owner) return;
      setDone(true);
      setRunning(false);
      void refresh();
    },
    onSettled: () => {
      lock.current = false;
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
  if (!activity)
    return (
      <ScreenContainer back>
        <ErrorNote error="Không tìm thấy hoạt động." />
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
          ? localSession
            ? "Khoảng nghỉ này chỉ diễn ra trên thiết bị. Chưa gửi lên tài khoản hay ghi nhận tiến triển khu vườn."
            : "Máy chủ đã xác nhận hoàn thành. Bạn có thể trở về với ngày của mình."
          : activity.description}
      </MoriText>
      {localSession && !done && (
        <MoriText muted variant="small" accessibilityLiveRegion="polite">
          Đang thực hành trên thiết bị. Không gửi dữ liệu lên tài khoản.
        </MoriText>
      )}
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
          {!session && !localSession ? (
            <>
              <MoriButton
                loading={start.isPending}
                onPress={() => {
                  if (!lock.current) {
                    lock.current = true;
                    start.mutate();
                  }
                }}
              >
                Bắt đầu khi bạn sẵn sàng
              </MoriButton>
              <MoriButton
                secondary
                disabled={start.isPending}
                onPress={() => {
                  setLocalSession(true);
                  setRunning(true);
                  start.reset();
                }}
              >
                Thực hành không lưu
              </MoriButton>
              <MoriText muted variant="small">
                Thực hành không lưu không gửi yêu cầu hoàn thành, không đồng bộ
                và không thay đổi khu vườn.
              </MoriText>
            </>
          ) : (
            <>
              <MoriButton
                loading={complete.isPending}
                onPress={() => {
                  if (lock.current) return;
                  if (localSession) {
                    setDone(true);
                    setRunning(false);
                  } else {
                    lock.current = true;
                    complete.mutate();
                  }
                }}
              >
                {remaining === 0 ? "Hoàn thành" : "Mình đã thực hiện xong"}
              </MoriButton>
              {remaining > 0 && (
                <MoriButton
                  secondary
                  disabled={complete.isPending}
                  onPress={() => setRunning(!running)}
                >
                  {running ? "Tạm dừng" : "Tiếp tục"}
                </MoriButton>
              )}
            </>
          )}
          <MoriButton
            secondary
            disabled={start.isPending || complete.isPending}
            onPress={() => router.replace("/(tabs)")}
          >
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
