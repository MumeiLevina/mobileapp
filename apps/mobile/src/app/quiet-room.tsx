import { useEffect, useState } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  MoriButton,
  MoriCard,
  MoriChip,
  MoriText,
  ScreenContainer,
  styles,
} from "../components/ui";
import {
  formatQuietTimer,
  nextQuietTimer,
  quietTimerOptions,
  soundscapes,
} from "../features/quiet/soundscapes";
import { useTheme } from "../theme";

type QuietMode = "sit" | "breathe" | "write";

export default function QuietRoom() {
  const theme = useTheme();
  const [soundscape, setSoundscape] = useState(soundscapes[0]);
  const [mode, setMode] = useState<QuietMode>("sit");
  const [duration, setDuration] =
    useState<(typeof quietTimerOptions)[number]>(0);
  const [remaining, setRemaining] = useState(0);
  const [active, setActive] = useState(false);
  const done = active && duration > 0 && remaining === 0;

  useEffect(() => {
    if (!active || duration === 0 || remaining === 0) return;
    const timer = setInterval(() => setRemaining(nextQuietTimer), 1000);
    return () => clearInterval(timer);
  }, [active, duration, remaining]);

  const start = () => {
    if (mode === "write") return router.push("/journal/new");
    setRemaining(duration);
    setActive(true);
  };

  if (active) {
    return (
      <ScreenContainer scroll={false}>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            gap: 24,
          }}
        >
          <View
            accessible
            accessibilityLabel={soundscape.title}
            style={{
              width: 164,
              height: 164,
              borderRadius: 82,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.soft,
              borderWidth: 1,
              borderColor: theme.line,
            }}
          >
            <Ionicons name={soundscape.icon} size={64} color={theme.primary} />
          </View>
          <MoriText variant="title" style={{ textAlign: "center" }}>
            {done
              ? "Khoảng nghỉ đã kết thúc."
              : mode === "breathe"
                ? "Thở chậm theo nhịp của riêng bạn."
                : "Không cần làm gì cả."}
          </MoriText>
          {!done && (
            <MoriText muted style={{ textAlign: "center" }}>
              {duration === 0
                ? "Dừng ở đây cũng được."
                : formatQuietTimer(remaining)}
            </MoriText>
          )}
          {done ? (
            <View style={[styles.stack, { alignSelf: "stretch" }]}>
              <MoriButton
                onPress={() => {
                  setDuration(0);
                  setRemaining(0);
                }}
              >
                Ở lại thêm
              </MoriButton>
              <MoriButton
                variant="ghost"
                onPress={() => router.replace("/(tabs)")}
              >
                Trở về
              </MoriButton>
            </View>
          ) : (
            <MoriButton
              variant="ghost"
              onPress={() => router.replace("/(tabs)")}
            >
              Rời phòng yên
            </MoriButton>
          )}
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer back>
      <MoriText variant="title">Phòng yên.</MoriText>
      <MoriText muted>
        Một nơi để dừng lại. Không có tin nhắn, không có điều gì cần hoàn thành.
      </MoriText>
      <MoriText style={{ fontWeight: "600" }}>Chọn một khung cảnh</MoriText>
      <View style={styles.stack}>
        {soundscapes.map((item) => (
          <MoriButton
            key={item.id}
            variant={soundscape.id === item.id ? "primary" : "secondary"}
            icon={item.icon}
            onPress={() => setSoundscape(item)}
          >
            {item.title}
          </MoriButton>
        ))}
      </View>
      <MoriText muted variant="small">
        Phiên bản này không phát âm thanh. Khung cảnh vẫn hoạt động như một
        khoảng nhìn yên tĩnh.
      </MoriText>
      <MoriCard>
        <MoriText style={{ fontWeight: "600" }}>
          Bạn muốn ở đây thế nào?
        </MoriText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(
            [
              ["sit", "Chỉ ngồi yên"],
              ["breathe", "Thở cùng nhịp"],
              ["write", "Viết vài dòng"],
            ] as const
          ).map(([value, label]) => (
            <MoriChip
              key={value}
              label={label}
              role="radio"
              selected={mode === value}
              onPress={() => setMode(value)}
            />
          ))}
        </View>
      </MoriCard>
      {mode !== "write" && (
        <MoriCard>
          <MoriText style={{ fontWeight: "600" }}>
            Hẹn giờ, nếu bạn muốn
          </MoriText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {quietTimerOptions.map((seconds) => (
              <MoriChip
                key={seconds}
                label={seconds === 0 ? "Không hẹn giờ" : `${seconds / 60} phút`}
                role="radio"
                selected={duration === seconds}
                onPress={() => setDuration(seconds)}
              />
            ))}
          </View>
        </MoriCard>
      )}
      <MoriButton onPress={start}>
        {mode === "write" ? "Mở trang viết" : "Vào phòng yên"}
      </MoriButton>
    </ScreenContainer>
  );
}
