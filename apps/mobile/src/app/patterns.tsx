import { useQuery } from "@tanstack/react-query";
import { LifePatternsResponse } from "@mori/shared";
import {
  ErrorNote,
  Loading,
  MoriCard,
  MoriText,
  ScreenContainer,
  SectionHeading,
} from "../components/ui";
import { request } from "../services/api";

const labels: Record<LifePatternsResponse["patterns"][number]["type"], string> =
  {
    recurring_topic: "CHỦ ĐỀ LẶP LẠI",
    helpful_activity: "HOẠT ĐỘNG THƯỜNG CHỌN",
    time_pattern: "THỜI GIAN",
    recurring_thought: "CỤM TỪ LẶP LẠI",
    mood_activity: "TÂM TRẠNG & HOẠT ĐỘNG",
  };

export default function PatternsScreen() {
  const data = useQuery({
    queryKey: ["life-patterns"],
    queryFn: () => request<LifePatternsResponse>("/insights/patterns"),
  });
  return (
    <ScreenContainer back>
      <MoriText muted variant="small">
        NHỮNG ĐIỀU XUẤT HIỆN NHIỀU LẦN
      </MoriText>
      <MoriText variant="hero">Nhịp sống của mình</MoriText>
      <MoriText muted>
        Mori chỉ hiện một quan sát khi có ít nhất 5 ghi chép liên quan. Không có
        điểm số sức khỏe tinh thần.
      </MoriText>
      <ErrorNote error={data.error} retry={() => void data.refetch()} />
      {data.isPending && <Loading />}
      {data.data?.message && (
        <MoriCard>
          <MoriText>Chưa có đủ thông tin.</MoriText>
          <MoriText muted>
            Khi có thêm ghi chép, những điều lặp lại có thể xuất hiện ở đây.
          </MoriText>
        </MoriCard>
      )}
      {!!data.data?.patterns.length && (
        <SectionHeading title="Những quan sát gần đây" />
      )}
      {data.data?.patterns.map((pattern) => (
        <MoriCard key={pattern.id}>
          <MoriText muted variant="small">
            {labels[pattern.type]}
          </MoriText>
          <MoriText>{pattern.title}</MoriText>
          <MoriText translate={false}>{pattern.observation}</MoriText>
          <MoriText muted variant="small">
            Dựa trên {pattern.evidenceCount} ghi chép liên quan
          </MoriText>
        </MoriCard>
      ))}
      {data.data && (
        <MoriCard>
          <MoriText variant="small" translate={false}>
            {data.data.disclaimer}
          </MoriText>
          <MoriText muted variant="small">
            Đây là một mẫu trong ghi chép của bạn, không phải bằng chứng về
            nguyên nhân hay chẩn đoán.
          </MoriText>
        </MoriCard>
      )}
    </ScreenContainer>
  );
}
