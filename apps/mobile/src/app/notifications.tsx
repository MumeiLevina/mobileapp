import { useEffect, useState } from "react";
import { Switch, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { NotificationPreference, notificationSchema } from "@mori/shared";
import {
  ErrorNote,
  MoriButton,
  MoriCard,
  MoriInput,
  MoriNotice,
  MoriText,
  ScreenContainer,
  styles,
} from "../components/ui";
import { request, refresh } from "../services/api";
import { scheduleReminder } from "../services/notifications";
import { useTheme } from "../theme";

const defaults = notificationSchema.parse({
  period: "off",
  hour: 20,
  minute: 0,
  timezone: "Asia/Ho_Chi_Minh",
});

function readTime(value: string, label: string) {
  const parts = value.match(/^(\d{1,2}):(\d{2})$/);
  const hour = Number(parts?.[1]);
  const minute = Number(parts?.[2]);
  if (!parts || hour > 23 || minute > 59) {
    throw new Error(`${label} cần theo dạng 08:30.`);
  }
  return { hour, minute };
}

export default function NotificationSettings() {
  const theme = useTheme();
  const existing = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => request<NotificationPreference>("/notification-preferences"),
  });
  const [morningEnabled, setMorningEnabled] = useState(false);
  const [eveningEnabled, setEveningEnabled] = useState(false);
  const [morningTime, setMorningTime] = useState("08:00");
  const [eveningTime, setEveningTime] = useState("20:00");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!existing.data) return;
    const value = notificationSchema.parse(existing.data);
    setMorningEnabled(value.morning_enabled);
    setEveningEnabled(value.evening_enabled);
    setMorningTime(
      `${String(value.morning_hour).padStart(2, "0")}:${String(value.morning_minute).padStart(2, "0")}`,
    );
    setEveningTime(
      `${String(value.evening_hour).padStart(2, "0")}:${String(value.evening_minute).padStart(2, "0")}`,
    );
  }, [existing.data]);

  const save = useMutation({
    mutationFn: async () => {
      const morning = readTime(morningTime, "Giờ buổi sáng");
      const evening = readTime(eveningTime, "Giờ buổi tối");
      const value = notificationSchema.parse({
        ...defaults,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        morning_enabled: morningEnabled,
        morning_hour: morning.hour,
        morning_minute: morning.minute,
        evening_enabled: eveningEnabled,
        evening_hour: evening.hour,
        evening_minute: evening.minute,
      });
      await scheduleReminder(value);
      try {
        await request("/notification-preferences", "PATCH", value);
      } catch (error) {
        await scheduleReminder(
          notificationSchema.parse(existing.data ?? defaults),
        );
        throw error;
      }
    },
    onSuccess: () => {
      setNotice("Đã lưu lựa chọn của bạn. Bạn có thể tắt bất cứ lúc nào.");
      void refresh();
    },
  });

  return (
    <ScreenContainer back>
      <MoriText variant="title">Những lời nhắc nhẹ.</MoriText>
      <MoriText muted>
        Hoàn toàn tùy chọn. Không chuỗi ngày, không nhắc về ngày bạn đã bỏ lỡ.
      </MoriText>
      <MoriCard>
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <View style={{ flex: 1 }}>
            <MoriText>Khoảnh khắc buổi sáng</MoriText>
            <MoriText muted variant="small">
              “🌿 Một khoảnh khắc cho ngày mới?”
            </MoriText>
          </View>
          <Switch
            accessibilityLabel="Bật lời nhắc buổi sáng"
            value={morningEnabled}
            disabled={save.isPending}
            onValueChange={(value) => {
              setMorningEnabled(value);
              setNotice("");
            }}
            trackColor={{ true: theme.primary }}
          />
        </View>
        {morningEnabled && (
          <MoriInput
            accessibilityLabel="Giờ lời nhắc buổi sáng"
            value={morningTime}
            editable={!save.isPending}
            onChangeText={setMorningTime}
            placeholder="08:00"
            maxLength={5}
          />
        )}
      </MoriCard>
      <MoriCard>
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <View style={{ flex: 1 }}>
            <MoriText>Khoảnh khắc buổi tối</MoriText>
            <MoriText muted variant="small">
              “🌙 Có điều gì bạn muốn đặt xuống tối nay?”
            </MoriText>
          </View>
          <Switch
            accessibilityLabel="Bật lời nhắc buổi tối"
            value={eveningEnabled}
            disabled={save.isPending}
            onValueChange={(value) => {
              setEveningEnabled(value);
              setNotice("");
            }}
            trackColor={{ true: theme.primary }}
          />
        </View>
        {eveningEnabled && (
          <MoriInput
            accessibilityLabel="Giờ lời nhắc buổi tối"
            value={eveningTime}
            editable={!save.isPending}
            onChangeText={setEveningTime}
            placeholder="20:00"
            maxLength={5}
          />
        )}
      </MoriCard>
      <MoriText muted variant="small">
        Giờ được lưu theo múi giờ hiện tại của thiết bị. Lời nhắc mặc định luôn
        tắt.
      </MoriText>
      <ErrorNote error={save.error ?? existing.error} />
      {!!notice && <MoriNotice>{notice}</MoriNotice>}
      <MoriButton
        loading={save.isPending}
        loadingLabel="Đang lưu lời nhắc…"
        onPress={() => save.mutate()}
      >
        Lưu lời nhắc
      </MoriButton>
    </ScreenContainer>
  );
}
