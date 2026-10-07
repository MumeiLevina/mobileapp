import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { MoodType } from "@mori/shared";
import {
  MoriBottomSheet,
  MoriButton,
  MoriChip,
  MoriInput,
  MoriPressable,
  MoriText,
  ErrorNote,
  styles,
} from "../../components/ui";
import { useTheme } from "../../theme";
import { useT } from "../../i18n";
import { newId } from "../../lib/id";
import { request, refresh } from "../../services/api";
import { interactionFeedback } from "../../services/interaction-feedback";
import { momentDestination, MomentAction } from "../moments/moment-actions";
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
    <MoriPressable
      accessibilityRole="radio"
      accessibilityLabel={mood.label}
      aria-checked={selected}
      accessibilityState={{ checked: selected }}
      feedback="selection"
      onPress={onPress}
      wrapperStyle={{ flex: 1 }}
      style={(pressed) => ({
        alignItems: "center",
        gap: 8,
        minHeight: 82,
        paddingVertical: 8,
        borderRadius: 15,
        backgroundColor: selected ? t.soft : "transparent",
        opacity: pressed ? 0.82 : 1,
      })}
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
    </MoriPressable>
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
  const copy = useT();
  const mutation = useMutation({
    mutationFn: (includeDetails: boolean) =>
      request("/moods", "POST", {
        mood,
        intensity,
        tags: includeDetails ? selected : [],
        optional_note: includeDetails ? note : "",
        client_id: id,
      }),
    onSuccess: () => {
      setSaved(true);
      void interactionFeedback.success();
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
  const chooseMoment = (action: MomentAction) => {
    const destination = momentDestination(action);
    setMood(null);
    setSaved(false);
    setNote("");
    setSelected([]);
    setId(newId());
    router.push(destination as "/self-care");
  };
  return (
    <>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Cảm xúc hiện tại"
        style={{ flexDirection: "row", gap: 3 }}
      >
        {moods.map((m) => (
          <MoodButton
            key={m.value}
            mood={m}
            selected={mood === m.value}
            onPress={() => setMood(m.value)}
          />
        ))}
      </View>
      <MoriBottomSheet
        visible={mood !== null}
        onClose={mutation.isPending ? () => undefined : close}
      >
        <View style={styles.stack}>
          {saved ? (
            <>
              <MoriText variant="title">Cảm ơn bạn đã lắng nghe mình.</MoriText>
              <MoriText muted>
                Bạn muốn điều gì lúc này? Không có cảm xúc nào cần phải sửa
                ngay.
              </MoriText>
              <MoriButton
                icon="chatbubble-ellipses-outline"
                onPress={() => chooseMoment(MomentAction.talk)}
              >
                Nói một chút
              </MoriButton>
              <MoriButton
                variant="secondary"
                icon="book-outline"
                onPress={() => chooseMoment(MomentAction.write)}
              >
                Viết ra
              </MoriButton>
              <MoriButton
                variant="secondary"
                icon="rainy-outline"
                onPress={() => chooseMoment(MomentAction.quiet)}
              >
                Ngồi yên
              </MoriButton>
              <MoriButton
                variant="secondary"
                icon="leaf-outline"
                onPress={() => chooseMoment(MomentAction.breathe)}
              >
                Thở
              </MoriButton>
              <MoriButton
                variant="secondary"
                icon="phone-portrait-outline"
                onPress={() => chooseMoment(MomentAction.break)}
              >
                Rời màn hình một chút
              </MoriButton>
              <MoriButton
                variant="secondary"
                icon="people-outline"
                onPress={() => chooseMoment(MomentAction.reachOut)}
              >
                Tìm một người mình tin tưởng
              </MoriButton>
              <MoriButton variant="ghost" onPress={close}>
                Để sau
              </MoriButton>
            </>
          ) : (
            <>
              <MoriText variant="title">{copy.moodMore}</MoriText>
              <MoriText muted>Điều gì đang ở trong tâm trí bạn?</MoriText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {tags.map(([value, label]) => (
                  <MoriChip
                    key={value}
                    label={label}
                    selected={selected.includes(value)}
                    disabled={mutation.isPending}
                    onPress={() =>
                      setSelected(
                        selected.includes(value)
                          ? selected.filter((s) => s !== value)
                          : [...selected, value],
                      )
                    }
                  />
                ))}
              </View>
              <MoriText variant="small" muted>
                Mức độ cảm nhận
              </MoriText>
              <View style={styles.row}>
                {[0.25, 0.5, 0.75, 1].map((n, i) => (
                  <MoriChip
                    key={n}
                    label={["Nhẹ", "Vừa", "Nhiều", "Rất nhiều"][i]}
                    selected={intensity === n}
                    disabled={mutation.isPending}
                    role="radio"
                    onPress={() => setIntensity(n)}
                  />
                ))}
              </View>
              <MoriInput
                accessibilityLabel="Ghi chú cảm xúc"
                placeholder={copy.note}
                value={note}
                onChangeText={setNote}
                editable={!mutation.isPending}
                multiline
                maxLength={2000}
                style={{ minHeight: 90 }}
              />
              <ErrorNote error={mutation.error} />
              <MoriButton
                loading={mutation.isPending}
                loadingLabel="Đang lưu cảm xúc…"
                onPress={() => mutation.mutate(true)}
              >
                {copy.save}
              </MoriButton>
              <MoriButton
                variant="ghost"
                disabled={mutation.isPending}
                onPress={() => mutation.mutate(false)}
              >
                Chỉ lưu cảm xúc
              </MoriButton>
            </>
          )}
        </View>
      </MoriBottomSheet>
    </>
  );
}
