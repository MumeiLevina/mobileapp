import { Memory } from "@mori/shared";
import { MoriButton, MoriCard, MoriText } from "../../components/ui";
export function MemoryCard({
  memory,
  onEdit,
  onDelete,
  onApprove,
}: {
  memory: Memory;
  onEdit: () => void;
  onDelete: () => void;
  onApprove: () => void;
}) {
  return (
    <MoriCard>
      <MoriText translate={false}>{memory.content}</MoriText>
      <MoriText variant="small" muted>
        {memory.approved_by_user
          ? "Được bạn cho phép ghi nhớ"
          : "Đang chờ bạn cho phép · Chưa được sử dụng"}
      </MoriText>
      {!memory.approved_by_user && (
        <MoriButton onPress={onApprove}>Cho phép ghi nhớ</MoriButton>
      )}
      <MoriButton secondary onPress={onEdit}>
        Chỉnh sửa
      </MoriButton>
      <MoriButton secondary onPress={onDelete}>
        Quên điều này
      </MoriButton>
    </MoriCard>
  );
}
