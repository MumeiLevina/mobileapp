import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { MoodType } from "@mori/shared";
import {
  MoriBottomSheet,
  MoriButton,
  MoriInput,
  MoriText,
  ErrorNote,
  styles,
} from "../../components/ui";
import { useTheme } from "../../theme";
import { useT } from "../../i18n";
import { newId } from "../../lib/id";
import { request, refresh } from "../../services/api";
import Svg, { Circle, Path } from "react-native-svg";
export const moods: {
  value: MoodType;
  label: string;
  en: string;
  color: string;
  curve: string;
}[] = [
  {
    value: "joyful",
    label: "Rạng rỡ",
    en: "Joyful",
    color: "#E5D99E",
    curve: "M12 20 Q20 32 28 20",
  },
  {
    value: "good",
    label: "Dễ chịu",
    en: "Good",
    color: "#C8D7B1",
    curve: "M13 22 Q20 28 27 22",
  },
  {
    value: "okay",
    label: "Bình thường",
    en: "Okay",
    color: "#DDD8CA",
    curve: "M14 24 L26 24",
  },
  {
    value: "low",
    label: "Chùng xuống",
    en: "Low",
    color: "#C6D4D6",
    curve: "M13 26 Q20 19 27 26",
  },
  {
    value: "overwhelmed",
    label: "Quá tải",
    en: "Overwhelmed",
    color: "#D6C9CF",
    curve: "M14 25 Q20 18 26 25",
  },
];
export function MoodButton({
  mood,
  selected,
  onPress,
}: {
  mood: (typeof moods)[number];
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={mood.label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        flex: 1,
        alignItems: "center",
        gap: 8,
        paddingVertical: 8,
        borderRadius: 15,
        backgroundColor: selected ? t.soft : "transparent",
      }}
    >
      <View
        style={{
          width: 47,
          height: 47,
          borderRadius: 24,
          backgroundColor: mood.color,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Svg width={35} height={35} viewBox="0 0 40 40">
          <Circle cx="13" cy="15" r="1.5" fill="#455347" />
          <Circle cx="27" cy="15" r="1.5" fill="#455347" />
          <Path
            d={mood.curve}
            stroke="#455347"
            strokeWidth="1.7"
            fill="none"
            strokeLinecap="round"
          />
        </Svg>
      </View>
      <MoriText
        variant="small"
        muted
        style={{ textAlign: "center", fontSize: 11 }}
      >
        {mood.label}
      </MoriText>
    </Pressable>
  );
}
const tags = [
  ["Work", "Công việc"],
  ["Relationship", "Mối quan hệ"],
  ["Family", "Gia đình"],
  ["Myself", "Bản thân"],
  ["Health", "Sức khỏe"],
  ["Just tired", "Chỉ hơi mệt"],
  ["Other", "Khác"],
] as const;
export function MoodPicker({ onComplete }: { onComplete?: () => void }) {
  const [mood, setMood] = useState<MoodType | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [intensity, setIntensity] = useState(0.5);
  const [id, setId] = useState(newId);
  const [saved, setSaved] = useState(false);
  const t = useTheme();
  const copy = useT();
  const mutation = useMutation({
    mutationFn: () =>
      request("/moods", "POST", {
        mood,
        intensity,
        tags: selected,
        optional_note: note,
        client_id: id,
      }),
    onSuccess: () => {
      setSaved(true);
      void refresh();
    },
  });
  const close = () => {
    setMood(null);
    if (saved) {
      setSaved(false);
      setNote("");
      setSelected([]);
      setId(newId());
      onComplete?.();
    }
  };
  return (
    <>
      <View style={{ flexDirection: "row", gap: 3 }}>
        {moods.map((m) => (
          <MoodButton
            key={m.value}
            mood={m}
            selected={mood === m.value}
            onPress={() => setMood(m.value)}
          />
        ))}
      </View>
      <MoriBottomSheet visible={mood !== null} onClose={close}>
        <View style={styles.stack}>
          {saved ? (
            <>
              <MoriText variant="title">Cảm ơn bạn đã lắng nghe mình.</MoriText>
              <MoriText muted>
                Không có cảm xúc nào cần phải sửa ngay lúc này.
              </MoriText>
              <MoriButton
                onPress={() => {
                  close();
                  router.push("/(tabs)/talk");
                }}
              >
                {copy.talkCta}
              </MoriButton>
              <MoriButton
                secondary
                onPress={() => {
                  close();
                  router.push("/activity/rain");
                }}
              >
                {copy.stay}
              </MoriButton>
              <MoriButton secondary onPress={close}>
                Về khu vườn
              </MoriButton>
            </>
          ) : (
            <>
              <MoriText variant="title">{copy.moodMore}</MoriText>
              <MoriText muted>Điều gì đang ở trong tâm trí bạn?</MoriText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {tags.map(([value, label]) => (
                  <Pressable
                    key={value}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected.includes(value) }}
                    onPress={() =>
                      setSelected(
                        selected.includes(value)
                          ? selected.filter((s) => s !== value)
                          : [...selected, value],
                      )
                    }
                    style={{
                      padding: 12,
                      borderRadius: 20,
                      backgroundColor: selected.includes(value)
                        ? t.primary
                        : t.soft,
                    }}
                  >
                    <MoriText
                      variant="small"
                      style={{
                        color: selected.includes(value) ? t.onPrimary : t.text,
                      }}
                    >
                      {label}
                    </MoriText>
                  </Pressable>
                ))}
              </View>
              <MoriText variant="small" muted>
                Mức độ cảm nhận
              </MoriText>
              <View style={styles.row}>
                {[0.25, 0.5, 0.75, 1].map((n, i) => (
                  <Pressable
                    key={n}
                    onPress={() => setIntensity(n)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: intensity === n }}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 10,
                      backgroundColor: intensity === n ? t.soft : t.surface,
                    }}
                  >
                    <MoriText variant="small" style={{ textAlign: "center" }}>
                      {["Nhẹ", "Vừa", "Nhiều", "Rất nhiều"][i]}
                    </MoriText>
                  </Pressable>
                ))}
              </View>
              <MoriInput
                accessibilityLabel="Ghi chú cảm xúc"
                placeholder={copy.note}
                value={note}
                onChangeText={setNote}
                multiline
                maxLength={2000}
                style={{ minHeight: 90 }}
              />
              <ErrorNote error={mutation.error} />
              <MoriButton
                loading={mutation.isPending}
                onPress={() => mutation.mutate()}
              >
                {copy.save}
              </MoriButton>
              <MoriButton secondary onPress={() => mutation.mutate()}>
                Bỏ qua chi tiết và lưu cảm xúc
              </MoriButton>
            </>
          )}
        </View>
      </MoriBottomSheet>
    </>
  );
}
