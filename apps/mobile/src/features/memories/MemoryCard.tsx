import { Memory } from "@mori/shared";
import { MoriButton, MoriCard, MoriText } from "../../components/ui";
export function MemoryCard({
  memory,
  onEdit,
  onDelete,
  onApprove,
  disabled = false,
}: {
  memory: Memory;
  onEdit: () => void;
  onDelete: () => void;
  onApprove: () => void;
  disabled?: boolean;
}) {
  const source = memory.memory_sources?.[0];
  const sourceLabels = {
    manual: "Bạn tự thêm",
    conversation: "Trò chuyện",
    journal: "Nhật ký",
    mood: "Tâm trạng",
    weekly_reflection: "Nhìn lại tuần",
    life_map: "Bản đồ cuộc sống",
  };
  return (
    <MoriCard>
      <MoriText translate={false}>{memory.content}</MoriText>
      <MoriText variant="small" muted>
        {memory.approved_by_user
          ? "Được bạn cho phép ghi nhớ"
          : "Đang chờ bạn cho phép · Chưa được sử dụng"}
      </MoriText>
      {source && (
        <>
          <MoriText variant="small">Vì sao Mori ghi nhớ điều này?</MoriText>
          <MoriText variant="small" muted translate={false}>
            {source.reason}
          </MoriText>
          <MoriText variant="small" muted>
            Nguồn: {sourceLabels[source.source_type]} ·{" "}
            {new Date(source.created_at).toLocaleDateString("vi-VN")}
          </MoriText>
        </>
      )}
      {memory.approved_at && (
        <MoriText variant="small" muted>
          Được bạn duyệt ngày{" "}
          {new Date(memory.approved_at).toLocaleDateString("vi-VN")}
        </MoriText>
      )}
      {!memory.approved_by_user && (
        <MoriButton disabled={disabled} onPress={onApprove}>
          Cho phép ghi nhớ
        </MoriButton>
      )}
      <MoriButton secondary disabled={disabled} onPress={onEdit}>
        Chỉnh sửa
      </MoriButton>
      <MoriButton variant="dangerGhost" disabled={disabled} onPress={onDelete}>
        Quên điều này
      </MoriButton>
    </MoriCard>
  );
}
