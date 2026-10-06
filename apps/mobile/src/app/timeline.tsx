import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { TimelineFilter, TimelineItem } from "@mori/shared";
import {
  Choice,
  ErrorNote,
  Loading,
  MoriButton,
  MoriCard,
  MoriText,
  ScreenContainer,
  SectionHeading,
  styles,
} from "../components/ui";
import { request } from "../services/api";

const filterLabels: Record<TimelineFilter, string> = {
  all: "Tất cả",
  mood: "Tâm trạng",
  journal: "Nhật ký",
  self_care: "Chăm sóc bản thân",
  important_moment: "Khoảnh khắc quan trọng",
};

const typeLabels: Record<TimelineItem["type"], string> = {
  mood: "TÂM TRẠNG",
  journal: "NHẬT KÝ",
  conversation: "TRÒ CHUYỆN",
  self_care: "CHĂM SÓC BẢN THÂN",
  important_event: "KHOẢNH KHẮC QUAN TRỌNG",
  garden_milestone: "KHU VƯỜN",
  letter: "LÁ THƯ",
};

export default function TimelineScreen() {
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const timeline = useQuery({
    queryKey: ["reflection-timeline", filter],
    queryFn: () =>
      request<TimelineItem[]>(`/reflections/timeline?filter=${filter}`),
  });
  let month = "";

  return (
    <ScreenContainer back>
      <MoriText muted variant="small">
        LỊCH SỬ RIÊNG CỦA BẠN
      </MoriText>
      <MoriText variant="hero">Dòng thời gian</MoriText>
      <MoriText muted>
        Những điều bạn đã ghi lại, được đặt cạnh nhau để bạn có thể nhìn lại.
        Không có lượt thích hay chia sẻ công khai.
      </MoriText>
      {TimelineFilter.options.map((option) => (
        <Choice
          key={option}
          title={filterLabels[option]}
          selected={filter === option}
          onPress={() => setFilter(option)}
        />
      ))}
      <ErrorNote error={timeline.error} retry={() => void timeline.refetch()} />
      {timeline.isPending && <Loading />}
      {timeline.data?.map((item) => {
        const itemMonth = new Date(item.occurredAt).toLocaleDateString(
          "vi-VN",
          { month: "long", year: "numeric" },
        );
        const showMonth = itemMonth !== month;
        month = itemMonth;
        return (
          <View key={item.id} style={styles.stack}>
            {showMonth && <SectionHeading title={itemMonth.toUpperCase()} />}
            <MoriCard>
              <MoriText muted variant="small">
                {typeLabels[item.type]} ·{" "}
                {new Date(item.occurredAt).toLocaleDateString("vi-VN", {
                  day: "numeric",
                  month: "short",
                })}
              </MoriText>
              <MoriText translate={false}>{item.title}</MoriText>
              {!!item.detail && (
                <MoriText muted translate={false}>
                  {item.detail}
                </MoriText>
              )}
              {item.type === "journal" && (
                <MoriButton
                  secondary
                  onPress={() => router.push(`/journal/${item.sourceId}`)}
                >
                  Mở trang viết
                </MoriButton>
              )}
              {item.type === "conversation" && (
                <MoriButton
                  secondary
                  onPress={() => router.push(`/conversation/${item.sourceId}`)}
                >
                  Mở cuộc trò chuyện
                </MoriButton>
              )}
              {item.type === "important_event" && (
                <MoriButton secondary onPress={() => router.push("/life-map")}>
                  Mở bản đồ cuộc sống
                </MoriButton>
              )}
            </MoriCard>
          </View>
        );
      })}
      {timeline.data?.length === 0 && (
        <MoriText muted>Chưa có khoảnh khắc phù hợp với bộ lọc này.</MoriText>
      )}
    </ScreenContainer>
  );
}
