import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { DesiredFeeling, RitualEntry } from "@mori/shared";
import {
  ErrorNote,
  Loading,
  MoriButton,
  MoriChip,
  MoriInput,
  MoriText,
  ScreenContainer,
  SectionHeading,
  styles,
} from "../../components/ui";
import { MoodPicker } from "../../features/mood/MoodPicker";
import {
  MorningRitualDraft,
  readMorningRitualDraft,
} from "../../features/rituals/morning-draft";
import { useDraft } from "../../hooks/useDraft";
import { refresh, request } from "../../services/api";
import { interactionFeedback } from "../../services/interaction-feedback";
import { useTheme } from "../../theme";

const feelings: { value: DesiredFeeling; label: string }[] = [
  { value: "peaceful", label: "Bình yên" },
  { value: "focused", label: "Tập trung" },
  { value: "gentle", label: "Nhẹ nhàng" },
  { value: "brave", label: "Can đảm" },
];

export default function MorningRitual() {
  const theme = useTheme();
  const localDraft = useDraft("ritual.morning");
  const initialized = useRef(false);
  const [draft, setDraft] = useState<MorningRitualDraft | null>(null);

  useEffect(() => {
    if (!localDraft.ready || initialized.current) return;
    initialized.current = true;
    setDraft(readMorningRitualDraft(localDraft.text));
  }, [localDraft.ready, localDraft.text]);

  const save = useMutation({
    mutationFn: () => {
      if (!draft?.desiredFeeling) {
        throw new Error("Hãy chọn cảm giác bạn muốn mang theo hôm nay.");
      }
      return request<RitualEntry>("/rituals", "POST", {
        type: "morning",
        desired_feeling: draft.desiredFeeling,
        small_intention: draft.smallIntention,
        reflection: "",
        client_id: draft.clientId,
      });
    },
    onSuccess: async () => {
      await localDraft.clear();
      await refresh();
      await interactionFeedback.success();
      router.replace("/(tabs)");
    },
  });

  if (!localDraft.ready || !draft) {
    return (
      <ScreenContainer back>
        <Loading />
      </ScreenContainer>
    );
  }

  const persist = (next: MorningRitualDraft) => {
    setDraft(next);
    localDraft.setText(JSON.stringify(next));
  };

  return (
    <ScreenContainer back>
      <View
        accessible
        accessibilityLabel="Mặt trời buổi sáng"
        style={{
          width: 88,
          height: 88,
          borderRadius: 44,
          alignSelf: "center",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.peach,
          marginTop: 8,
        }}
      >
        <Ionicons name="sunny-outline" size={42} color={theme.primary} />
      </View>

      <View style={{ gap: 7, alignItems: "center" }}>
        <MoriText variant="title" style={{ textAlign: "center" }}>
          Một khởi đầu vừa đủ.
        </MoriText>
        <MoriText muted style={{ textAlign: "center" }}>
          Không cần hoàn thành thật nhiều. Chỉ cần chọn cách bạn muốn đi cùng
          hôm nay.
        </MoriText>
      </View>

      <View style={styles.stack}>
        <MoriText style={{ fontWeight: "600" }}>
          Hôm nay bạn muốn cảm thấy thế nào?
        </MoriText>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Cảm giác mong muốn hôm nay"
          style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
        >
          {feelings.map((feeling) => (
            <MoriChip
              key={feeling.value}
              label={feeling.label}
              role="radio"
              selected={draft.desiredFeeling === feeling.value}
              disabled={save.isPending}
              onPress={() =>
                persist({ ...draft, desiredFeeling: feeling.value })
              }
            />
          ))}
        </View>
      </View>

      <View style={styles.stack}>
        <MoriText style={{ fontWeight: "600" }}>
          Một điều nhỏ bạn muốn dành cho mình?
        </MoriText>
        <MoriInput
          accessibilityLabel="Ý định nhỏ cho hôm nay"
          value={draft.smallIntention}
          editable={!save.isPending}
          onChangeText={(smallIntention) =>
            persist({ ...draft, smallIntention })
          }
          multiline
          maxLength={1000}
          placeholder="Ví dụ: ra ngoài hít thở mười phút…"
          style={{ minHeight: 112, lineHeight: 25 }}
        />
      </View>

      <ErrorNote error={save.error ?? localDraft.error} />
      <MoriButton
        disabled={!draft.desiredFeeling}
        loading={save.isPending}
        loadingLabel="Đang giữ lại ý định…"
        onPress={() => save.mutate()}
      >
        Bắt đầu ngày mới
      </MoriButton>
      <MoriButton
        variant="ghost"
        disabled={save.isPending}
        onPress={() => router.replace("/(tabs)")}
      >
        Để sau
      </MoriButton>

      <SectionHeading title="Nếu bạn muốn, hãy nghe mình một chút" />
      <MoriText muted variant="small">
        Phần này hoàn toàn tùy chọn và được lưu riêng như một lần check-in cảm
        xúc.
      </MoriText>
      <MoodPicker />
    </ScreenContainer>
  );
}
