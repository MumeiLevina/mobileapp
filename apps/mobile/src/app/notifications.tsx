import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { NotificationPreference, notificationSchema } from "@mori/shared";
import {
  MoriButton,
  MoriInput,
  MoriText,
  ScreenContainer,
  Choice,
  ErrorNote,
} from "../components/ui";
import { request, refresh } from "../services/api";
import { scheduleReminder } from "../services/notifications";
export default function NotificationSettings() {
  const existing = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => request<NotificationPreference>("/notification-preferences"),
  });
  const [period, setPeriod] = useState<NotificationPreference["period"]>("off");
  const [time, setTime] = useState("20:00");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (existing.data) {
      setPeriod(existing.data.period);
      setTime(
        `${String(existing.data.hour).padStart(2, "0")}:${String(existing.data.minute).padStart(2, "0")}`,
      );
    }
  }, [existing.data]);
  const save = useMutation({
    mutationFn: async () => {
      const parts = time.match(/^(\d{1,2}):(\d{2})$/);
      if (period === "custom" && !parts)
        throw new Error("Hãy nhập giờ theo dạng 20:30.");
      const value = notificationSchema.safeParse({
        period,
        hour:
          period === "morning"
            ? 8
            : period === "evening"
              ? 20
              : period === "off"
                ? 20
                : Number(parts?.[1]),
        minute: period === "custom" ? Number(parts?.[2]) : 0,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if (!value.success) throw new Error("Giờ cần từ 00:00 đến 23:59.");
      await scheduleReminder(value.data);
      try {
        await request("/notification-preferences", "PATCH", value.data);
      } catch (error) {
        await scheduleReminder(
          existing.data ?? {
            period: "off",
            hour: 20,
            minute: 0,
            timezone: "Asia/Ho_Chi_Minh",
          },
        );
        throw error;
      }
    },
    onSuccess: () => {
      setNotice("Đã lưu lựa chọn của bạn.");
      void refresh();
    },
  });
  return (
    <ScreenContainer back>
      <MoriText variant="title">Một lời nhắc nhẹ.</MoriText>
      <MoriText muted>
        Không thúc giục. Không làm bạn thấy có lỗi. Bạn có thể tắt bất cứ lúc
        nào.
      </MoriText>
      {(
        [
          { id: "off", title: "Tắt", subtitle: "Ghé lại khi bạn muốn." },
          {
            id: "morning",
            title: "Buổi sáng",
            subtitle: "08:00 · Một chút cho ngày mới.",
          },
          {
            id: "evening",
            title: "Buổi tối",
            subtitle: "20:00 · Một khoảng dừng cuối ngày.",
          },
          {
            id: "custom",
            title: "Giờ của bạn",
            subtitle: "Theo giờ địa phương của thiết bị.",
          },
        ] as const
      ).map((p) => (
        <Choice
          key={p.id}
          title={p.title}
          subtitle={p.subtitle}
          selected={period === p.id}
          onPress={() => {
            setPeriod(p.id);
            setNotice("");
          }}
        />
      ))}
      {period === "custom" && (
        <MoriInput
          accessibilityLabel="Giờ lời nhắc"
          placeholder="20:30"
          value={time}
          onChangeText={setTime}
          maxLength={5}
        />
      )}
      <ErrorNote error={save.error ?? existing.error} />
      {!!notice && (
        <MoriText accessibilityLiveRegion="polite">{notice}</MoriText>
      )}
      <MoriButton loading={save.isPending} onPress={() => save.mutate()}>
        Lưu lựa chọn
      </MoriButton>
    </ScreenContainer>
  );
}
