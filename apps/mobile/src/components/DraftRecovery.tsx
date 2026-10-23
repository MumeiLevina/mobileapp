import { useState } from "react";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { useDraft } from "../hooks/useDraft";
import {
  ErrorNote,
  MoriButton,
  MoriConfirmSheet,
  MoriText,
  ScreenContainer,
} from "./ui";

// Recovery never rewrites a payload. The original remains in its owner-scoped
// encrypted slot until explicit discard succeeds, or account cleanup removes it.
export function DraftRecovery({
  draft,
  error,
  onDiscarded,
}: {
  draft: ReturnType<typeof useDraft>;
  error: unknown;
  onDiscarded: () => void;
}) {
  const [showOriginal, setShowOriginal] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const reload = useMutation({
    mutationFn: draft.reload,
    networkMode: "always",
  });
  const discard = useMutation({
    networkMode: "always",
    mutationFn: draft.clear,
    onSuccess: onDiscarded,
  });
  const busy = reload.isPending || discard.isPending;
  return (
    <ScreenContainer back>
      <MoriText variant="title">Giữ lại những gì bạn đã viết.</MoriText>
      <ErrorNote error={error} />
      <MoriText muted>
        Đọc lại không thay đổi dữ liệu. Bạn có thể xem và sao chép bản gốc trước
        khi quyết định; nội dung không được gửi đi.
      </MoriText>
      <MoriButton
        secondary
        disabled={busy}
        onPress={() => setShowOriginal(!showOriginal)}
      >
        {showOriginal ? "Ẩn bản gốc" : "Xem bản gốc để sao chép"}
      </MoriButton>
      {showOriginal && (
        <MoriText selectable translate={false}>
          {draft.text}
        </MoriText>
      )}
      <ErrorNote error={reload.error ?? (confirm ? null : discard.error)} />
      <MoriButton
        loading={reload.isPending}
        disabled={discard.isPending}
        onPress={() => reload.mutate()}
      >
        Đọc lại bản nháp
      </MoriButton>
      <MoriButton
        variant="ghost"
        disabled={busy}
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace("/(tabs)/journal")
        }
      >
        Giữ nguyên và quay lại
      </MoriButton>
      <MoriButton
        variant="dangerGhost"
        disabled={busy}
        onPress={() => setConfirm(true)}
      >
        Bỏ bản nháp lỗi
      </MoriButton>
      <MoriConfirmSheet
        visible={confirm}
        title="Bỏ bản nháp lỗi?"
        description="Bản gốc trên thiết bị sẽ bị xóa và không thể khôi phục. Chỉ tiếp tục sau khi bạn đã giữ lại nội dung cần thiết."
        confirmLabel="Xóa bản nháp trên thiết bị"
        cancelLabel="Giữ bản gốc"
        loading={discard.isPending}
        error={discard.error}
        onConfirm={() => discard.mutate()}
        onCancel={() => setConfirm(false)}
      />
    </ScreenContainer>
  );
}
