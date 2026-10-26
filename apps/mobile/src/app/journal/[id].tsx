import { useOwnerRequest } from "../../hooks/useOwnerRequest";
import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Journal, journalSchema } from "@mori/shared";
import {
  MoriButton,
  MoriInput,
  MoriText,
  MoriConfirmSheet,
  ScreenContainer,
  ErrorNote,
  Loading,
} from "../../components/ui";
import { refresh } from "../../services/api";
import { useDraft } from "../../hooks/useDraft";
import { newId } from "../../lib/id";
import { useT } from "../../i18n";
import { DraftStatus } from "../../components/DraftStatus";
import { DraftRecovery } from "../../components/DraftRecovery";
import {
  EntryDraft,
  readJournalDraft,
} from "../../features/journal/journal-draft";
import { useSession } from "../../store/session";
export default function JournalEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const owner = useSession((s) => s.userId);
  return <JournalEntry key={`${owner}:${id}`} id={id} />;
}
function JournalEntry({ id }: { id: string }) {
  const { request, isCurrent } = useOwnerRequest();
  const owner = useSession((s) => s.userId);
  const draft = useDraft(`journal.${id}`);
  const copy = useT();
  const [entry, setEntry] = useState<EntryDraft>({
    title: "",
    content: "",
    source: "manual",
    client_id: newId(),
    version: 1,
  });
  const [initialized, setInitialized] = useState(false);
  const [recovery, setRecovery] = useState<unknown>(null);
  const [confirm, setConfirm] = useState<"delete" | "discard" | null>(null);
  const existing = useQuery({
    queryKey: ["journals", owner],
    queryFn: () => request<Journal[]>("/journals", "GET", undefined),
    enabled: id !== "new",
  });
  useEffect(() => {
    if (!draft.ready || initialized) return;
    if (draft.text) {
      try {
        setEntry(readJournalDraft(draft.text));
        setRecovery(null);
        setInitialized(true);
        return;
      } catch (error) {
        setRecovery(error);
        return;
      }
    }
    if (id === "new") {
      setInitialized(true);
      return;
    }
    if (existing.data) {
      const journal = existing.data.find((j) => j.id === id);
      if (journal) {
        setEntry(journal);
        setInitialized(true);
      }
    }
  }, [draft.ready, existing.data, id, draft.text, initialized]);
  function update(patch: Partial<EntryDraft>) {
    const value = { ...entry, ...patch, version: 1 as const };
    setEntry(value);
    draft.setText(JSON.stringify(value));
  }
  const save = useMutation({
    mutationFn: async () => {
      const valid = journalSchema.safeParse(entry);
      if (!valid.success)
        throw new Error(
          "Bạn hãy thêm tiêu đề và vài dòng nội dung trước khi lưu.",
        );
      await draft.persist(JSON.stringify(entry));
      return request(
        `/journals${id === "new" ? "" : `/${id}`}`,
        id === "new" ? "POST" : "PATCH",
        valid.data,
      );
    },
    onSuccess: async () => {
      if (!isCurrent()) return;
      await draft.clear();
      await refresh();
      if (!isCurrent()) return;
      router.replace("/(tabs)/journal");
    },
  });
  const remove = useMutation({
    mutationFn: () => request(`/journals/${id}`, "DELETE", undefined),
    onSuccess: async () => {
      if (!isCurrent()) return;
      await draft.clear();
      await refresh();
      if (!isCurrent()) return;
      router.replace("/(tabs)/journal");
    },
  });
  const discard = useMutation({
    mutationFn: draft.clear,
    onSuccess: () => router.replace("/(tabs)/journal"),
  });
  if (!draft.ready)
    return (
      <ScreenContainer back>
        <DraftStatus draft={draft} />
      </ScreenContainer>
    );
  if (recovery)
    return (
      <DraftRecovery
        draft={draft}
        error={recovery}
        onDiscarded={() => {
          setRecovery(null);
        }}
      />
    );
  if (!initialized)
    return (
      <ScreenContainer back>
        <ErrorNote
          error={existing.error}
          retry={() => void existing.refetch()}
        />
        {existing.isPending && <Loading />}
        {existing.isSuccess && (
          <MoriText>Không tìm thấy trang viết này.</MoriText>
        )}
      </ScreenContainer>
    );
  return (
    <ScreenContainer back>
      <MoriText muted variant="small">
        {entry.source === "conversation"
          ? "BẢN NHÁP TỪ CUỘC TRÒ CHUYỆN"
          : "MỘT TRANG CHO MÌNH"}
      </MoriText>
      <MoriText variant="title">Không cần viết thật hay.</MoriText>
      {entry.source !== "manual" && (
        <MoriText muted>
          Bản nháp chưa được lưu vào nhật ký. Hãy sửa những gì chưa đúng với
          bạn, rồi chọn Lưu lại.
        </MoriText>
      )}
      <MoriInput
        accessibilityLabel="Tiêu đề nhật ký"
        placeholder="Đặt tên cho trang viết…"
        value={entry.title}
        onChangeText={(title) => update({ title })}
        editable={!save.isPending && !remove.isPending && !discard.isPending}
        maxLength={120}
        style={{ fontSize: 23 }}
      />
      <MoriInput
        accessibilityLabel="Nội dung nhật ký"
        placeholder="Hôm nay, mình…"
        value={entry.content}
        onChangeText={(content) => update({ content })}
        editable={!save.isPending && !remove.isPending && !discard.isPending}
        multiline
        maxLength={20000}
        style={{ minHeight: 300, lineHeight: 27 }}
      />
      <DraftStatus draft={draft} />
      <ErrorNote error={save.error} />
      <MoriButton
        loading={save.isPending}
        loadingLabel="Đang lưu trang viết…"
        disabled={remove.isPending || discard.isPending}
        onPress={() => save.mutate()}
      >
        {copy.save}
      </MoriButton>
      <MoriButton
        variant="ghost"
        disabled={save.isPending || remove.isPending || discard.isPending}
        onPress={() => setConfirm("discard")}
      >
        Bỏ bản nháp
      </MoriButton>
      {id !== "new" && (
        <MoriButton
          variant="dangerGhost"
          disabled={save.isPending || remove.isPending || discard.isPending}
          onPress={() => setConfirm("delete")}
        >
          Xóa trang viết
        </MoriButton>
      )}
      <MoriConfirmSheet
        visible={confirm !== null}
        title={confirm === "delete" ? "Xóa trang viết?" : "Bỏ bản nháp này?"}
        description={
          confirm === "delete"
            ? "Trang viết này sẽ bị xóa và không thể khôi phục."
            : "Những thay đổi đang lưu trên thiết bị sẽ bị xóa."
        }
        confirmLabel={confirm === "delete" ? "Xóa trang viết" : "Bỏ bản nháp"}
        loadingLabel={
          confirm === "delete" ? "Đang xóa trang viết…" : "Đang bỏ bản nháp…"
        }
        loading={remove.isPending || discard.isPending}
        error={confirm === "delete" ? remove.error : discard.error}
        onConfirm={() =>
          confirm === "delete" ? remove.mutate() : discard.mutate()
        }
        onCancel={() => setConfirm(null)}
      />
    </ScreenContainer>
  );
}
