import { useMutation, useQuery } from "@tanstack/react-query";
import {
  PersonalMilestone,
  PersonalMilestoneKey,
} from "@mori/shared";
import {
  ErrorNote,
  Loading,
  MoriButton,
  MoriCard,
  MoriText,
  ScreenContainer,
} from "../components/ui";
import { refresh, request } from "../services/api";

const copy: Record<
  PersonalMilestoneKey,
  { title: string; detail: string }
> = {
  quiet_cottage_appeared: {
    title: "Nhà yên đã có mặt trong khu vườn.",
    detail: "Một góc nhỏ để trở về khi bạn muốn chậm lại.",
  },
  reflection_lake_appeared: {
    title: "Hồ phản chiếu đã xuất hiện.",
    detail: "Những trang viết của bạn đã mở ra góc này.",
  },
  memory_garden_appeared: {
    title: "Vườn ký ức đã xuất hiện.",
    detail: "Chỉ những ký ức bạn cho phép mới ở lại đây.",
  },
  first_letter: {
    title: "Bạn đã viết lá thư đầu tiên cho chính mình.",
    detail: "Lá thư vẫn riêng tư trong Cây thư.",
  },
  wind_chimes_appeared: {
    title: "Chuông gió đã xuất hiện.",
    detail: "Một nhịp thở chậm đã để lại âm thanh nhỏ trong vườn.",
  },
  first_weekly_reflection: {
    title: "Bạn đã dành thời gian nhìn lại tuần đầu tiên.",
    detail: "Đom đóm vừa ghé qua khu vườn.",
  },
  first_soft_goal: {
    title: "Bạn đã hoàn thành ý định nhỏ đầu tiên.",
    detail: "Một viên đá nhỏ đã xuất hiện trên lối đi.",
  },
  moon_hill_appeared: {
    title: "Đồi trăng đã xuất hiện.",
    detail: "Một khoảng rộng hơn đang dần mở ra trong thế giới của bạn.",
  },
};

const date = (value: string) =>
  new Date(value).toLocaleDateString("vi-VN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default function PersonalMilestonesScreen() {
  const milestones = useQuery({
    queryKey: ["personal-milestones"],
    queryFn: () => request<PersonalMilestone[]>("/personal-milestones"),
  });
  const acknowledge = useMutation({
    mutationFn: (id: string) =>
      request(`/personal-milestones/${id}/acknowledge`, "POST"),
    onSuccess: () => refresh(),
  });

  return (
    <ScreenContainer back>
      <MoriText muted variant="small" style={{ letterSpacing: 2 }}>
        THẾ GIỚI CỦA MÌNH
      </MoriText>
      <MoriText variant="title">Những dấu mốc nhỏ</MoriText>
      <MoriText muted>
        Một vài khoảnh khắc đáng nhớ, không có thứ hạng hay điều gì phải đuổi
        theo.
      </MoriText>
      <ErrorNote
        error={milestones.error ?? acknowledge.error}
        retry={() => void milestones.refetch()}
      />
      {milestones.isPending && <Loading />}
      {milestones.data?.map((milestone) => {
        const words = copy[milestone.milestone_key];
        return (
          <MoriCard key={milestone.id}>
            <MoriText variant="subtitle">{words.title}</MoriText>
            <MoriText muted>{words.detail}</MoriText>
            <MoriText muted variant="small">
              {date(milestone.created_at)}
            </MoriText>
            {!milestone.acknowledged_at && (
              <MoriButton
                secondary
                loading={
                  acknowledge.isPending &&
                  acknowledge.variables === milestone.id
                }
                onPress={() => acknowledge.mutate(milestone.id)}
              >
                Mình đã nhìn thấy
              </MoriButton>
            )}
          </MoriCard>
        );
      })}
      {!milestones.isPending && !milestones.data?.length && (
        <MoriText muted>
          Những dấu mốc sẽ nhẹ nhàng xuất hiện khi thế giới của bạn dần mở ra.
        </MoriText>
      )}
    </ScreenContainer>
  );
}
