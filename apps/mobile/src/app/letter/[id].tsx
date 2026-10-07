import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Letter } from "@mori/shared";
import {
  ErrorNote,
  Loading,
  MoriButton,
  MoriConfirmSheet,
  MoriInput,
  MoriPressable,
  MoriText,
  ScreenContainer,
} from "../../components/ui";
import {
  LetterDelay,
  LetterDraft,
  createLetterDraft,
  letterPayload,
  readLetterDraft,
} from "../../features/letters/letter-draft";
import { useDraft } from "../../hooks/useDraft";
import { refresh, request } from "../../services/api";
import {
  cancelLetterNotification,
  scheduleLetterNotification,
} from "../../services/notifications";
import { useTheme } from "../../theme";

const choices: { value: LetterDelay; label: string }[] = [
  { value: "week", label: "1 tuần" },
  { value: "month", label: "1 tháng" },
  { value: "quarter", label: "3 tháng" },
  { value: "year", label: "1 năm" },
  { value: "custom", label: "Ngày khác" },
];

export default function LetterEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const local = useDraft(`letter.${id}`);
  const theme = useTheme();
  const initialized = useRef(false);
  const [draft, setDraft] = useState<LetterDraft>(createLetterDraft);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const existing = useQuery({
    queryKey: ["letter-edit", id],
    queryFn: () => request<Letter>(`/letters/${id}/edit`),
    enabled: id !== "new",
  });

  useEffect(() => {
    if (!local.ready || initialized.current) return;
    if (local.text) {
      setDraft(readLetterDraft(local.text));
      initialized.current = true;
      return;
    }
    if (id === "new") {
      initialized.current = true;
      return;
    }
    if (existing.data) {
      setDraft({
        title: existing.data.title,
        content: existing.data.content,
        delay: "custom",
        customDate: existing.data.open_at.slice(0, 10),
        clientId: existing.data.client_id ?? createLetterDraft().clientId,
      });
      initialized.current = true;
    }
  }, [existing.data, id, local.ready, local.text]);

  function update(patch: Partial<LetterDraft>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    local.setText(JSON.stringify(next));
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = letterPayload(draft);
      return request<Letter>(
        id === "new" ? "/letters" : `/letters/${id}`,
        id === "new" ? "POST" : "PATCH",
        id === "new"
          ? payload
          : {
              title: payload.title,
              content: payload.content,
              open_at: payload.open_at,
            },
      );
    },
    onSuccess: async (letter) => {
      await local.clear();
      await scheduleLetterNotification(letter.id, letter.open_at).catch(
        () => false,
      );
      await refresh();
      router.replace("/letters" as "/timeline");
    },
  });
  const remove = useMutation({
    mutationFn: () => request(`/letters/${id}`, "DELETE"),
    onSuccess: async () => {
      await local.clear();
      await cancelLetterNotification(id).catch(() => undefined);
      await refresh();
      router.replace("/letters" as "/timeline");
    },
  });

  if (!local.ready || (id !== "new" && existing.isPending))
    return (
      <ScreenContainer back>
        <Loading />
      </ScreenContainer>
    );
  return (
    <ScreenContainer back>
      <MoriText muted variant="small" style={{ letterSpacing: 2 }}>
        DEAR FUTURE ME
      </MoriText>
      <MoriText variant="title">Gửi một lời cho mình.</MoriText>
      <MoriText muted>
        Lá thư này là dữ liệu riêng tư. Mori không tự đọc hoặc dùng nó trong trò
        chuyện.
      </MoriText>
      <MoriInput
        accessibilityLabel="Tiêu đề lá thư"
        placeholder="Tên lá thư…"
        value={draft.title}
        onChangeText={(title) => update({ title })}
        maxLength={120}
        editable={!save.isPending && !remove.isPending}
        style={{ fontSize: 22 }}
      />
      <MoriInput
        accessibilityLabel="Nội dung lá thư"
        placeholder="Gửi mình của tương lai…"
        value={draft.content}
        onChangeText={(content) => update({ content })}
        multiline
        maxLength={20000}
        editable={!save.isPending && !remove.isPending}
        style={{ minHeight: 260, lineHeight: 27 }}
      />
      <MoriText variant="subtitle">Mở sau</MoriText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {choices.map((choice) => (
          <MoriPressable
            key={choice.value}
            accessibilityRole="button"
            accessibilityState={{ selected: draft.delay === choice.value }}
            accessibilityLabel={choice.label}
            feedback="selection"
            onPress={() => update({ delay: choice.value })}
            style={(pressed) => ({
              minHeight: 44,
              paddingHorizontal: 16,
              paddingVertical: 11,
              borderRadius: 22,
              borderWidth: 1,
              borderColor:
                draft.delay === choice.value ? theme.primary : theme.line,
              backgroundColor:
                draft.delay === choice.value ? theme.soft : theme.surface,
              opacity: pressed ? 0.76 : 1,
            })}
          >
            <MoriText>{choice.label}</MoriText>
          </MoriPressable>
        ))}
      </View>
      {draft.delay === "custom" && (
        <MoriInput
          accessibilityLabel="Ngày mở lá thư"
          placeholder="YYYY-MM-DD"
          value={draft.customDate}
          onChangeText={(customDate) => update({ customDate })}
          inputMode="numeric"
          maxLength={10}
        />
      )}
      <MoriText muted variant="small">
        Bản nháp được giữ riêng trên thiết bị khi bạn viết.
      </MoriText>
      <ErrorNote error={save.error ?? existing.error ?? local.error} />
      <MoriButton
        loading={save.isPending}
        loadingLabel="Đang cất lá thư…"
        disabled={remove.isPending}
        onPress={() => save.mutate()}
      >
        Cất lá thư
      </MoriButton>
      {id !== "new" && (
        <MoriButton
          variant="dangerGhost"
          disabled={save.isPending || remove.isPending}
          onPress={() => setConfirmDelete(true)}
        >
          Xóa lá thư
        </MoriButton>
      )}
      <MoriConfirmSheet
        visible={confirmDelete}
        title="Xóa lá thư?"
        description="Lá thư sẽ được xóa khỏi kho của bạn."
        confirmLabel="Xóa lá thư"
        loadingLabel="Đang xóa lá thư…"
        loading={remove.isPending}
        error={remove.error}
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
    </ScreenContainer>
  );
}
