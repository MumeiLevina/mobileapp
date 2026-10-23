import { useDraft } from "../hooks/useDraft";
import { ErrorNote, MoriText } from "./ui";

export function DraftStatus({ draft }: { draft: ReturnType<typeof useDraft> }) {
  if (draft.error)
    return (
      <ErrorNote
        error={draft.error}
        retry={() => {
          void draft.retry().catch(() => undefined);
        }}
      />
    );
  if (draft.status === "idle") return null;
  return (
    <MoriText muted variant="small" accessibilityLiveRegion="polite">
      {draft.status === "loading"
        ? "Đang khôi phục bản nháp…"
        : draft.status === "saving"
          ? "Đang giữ bản nháp trên thiết bị…"
          : "Đã giữ bản nháp trên thiết bị. Chưa lưu lên tài khoản."}
    </MoriText>
  );
}
