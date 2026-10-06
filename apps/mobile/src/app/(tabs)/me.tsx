import { useState } from "react";
import { View, Switch } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CompanionStyle, Profile } from "@mori/shared";
import {
  MoriButton,
  MoriCard,
  MoriBottomSheet,
  MoriText,
  ScreenContainer,
  Choice,
  ErrorNote,
  SectionHeading,
  styles,
} from "../../components/ui";
import { usePreferences } from "../../store/preferences";
import { request, refresh, queryClient } from "../../services/api";
import { supabase } from "../../services/auth";
import { clearUserDeviceData } from "../../services/cleanup";
import { useSession } from "../../store/session";
import { config } from "../../lib/config";
import { loadDemoSamples } from "../../services/demo";
import { useT } from "../../i18n";
import { useTheme } from "../../theme";
export default function Me() {
  const t = useTheme();
  const copy = useT();
  const preferences = usePreferences();
  const user = useSession((s) => s.userId);
  const [privacy, setPrivacy] = useState(false);
  const [notice, setNotice] = useState("");
  const data = useQuery({
    queryKey: ["profile"],
    queryFn: () => request<Profile>("/profile"),
  });
  const update = useMutation({
    mutationFn: (value: Partial<Profile>) =>
      request("/profile", "PATCH", value),
    onSuccess: () => {
      void refresh();
    },
  });
  const signout = useMutation({
    mutationFn: async () => {
      await clearUserDeviceData(user!);
      const result = await supabase?.auth.signOut();
      if (result?.error) throw new Error("Chưa đăng xuất được. Hãy thử lại.");
    },
    onSuccess: () => {
      queryClient.clear();
      router.replace("/auth");
    },
  });
  const seed = useMutation({
    mutationFn: loadDemoSamples,
    onSuccess: () => {
      setNotice("Đã nạp dữ liệu mẫu, không phải dữ liệu thật.");
      void refresh();
    },
  });
  return (
    <ScreenContainer>
      <MoriText muted variant="small">
        KHÔNG GIAN CỦA BẠN
      </MoriText>
      <MoriText variant="hero">{copy.settingsTitle}</MoriText>
      <MoriText muted>{copy.noPressure}</MoriText>
      <ErrorNote
        error={data.error ?? update.error ?? seed.error ?? signout.error}
      />
      <SectionHeading title="Cách Mori trò chuyện" />
      {(
        [
          { id: "gentle", label: "Dịu dàng" },
          { id: "close_friend", label: "Gần gũi" },
          { id: "calm", label: "Tĩnh lặng" },
        ] as const
      ).map((style) => (
        <Choice
          key={style.id}
          title={style.label}
          selected={data.data?.companion_style === style.id}
          onPress={() =>
            update.mutate({ companion_style: style.id as CompanionStyle })
          }
        />
      ))}
      <MoriButton secondary onPress={() => router.push("/memories")}>
        {copy.memories}
      </MoriButton>
      <SectionHeading title="Dữ liệu của bạn" />
      <MoriButton secondary onPress={() => router.push("/privacy")}>
        Mở trung tâm dữ liệu
      </MoriButton>
      <MoriButton secondary onPress={() => router.push("/notifications")}>
        {copy.notifications}
      </MoriButton>
      <MoriCard>
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <View style={{ flex: 1 }}>
            <MoriText>Nhìn lại tuần</MoriText>
            <MoriText muted variant="small">
              Chỉ khi bạn muốn.
            </MoriText>
          </View>
          <Switch
            accessibilityLabel="Bật nhìn lại tuần"
            value={data.data?.weekly_reflection_enabled ?? false}
            onValueChange={(value) =>
              update.mutate({ weekly_reflection_enabled: value })
            }
            trackColor={{ true: t.primary }}
          />
        </View>
        {data.data?.weekly_reflection_enabled && (
          <MoriButton
            secondary
            onPress={() => router.push("/weekly-reflection")}
          >
            Nhìn lại 7 ngày qua
          </MoriButton>
        )}
      </MoriCard>
      <SectionHeading title={copy.dark} />
      {(
        [
          { id: "system", label: "Theo thiết bị" },
          { id: "light", label: "Ban ngày" },
          { id: "dark", label: "Buổi tối" },
        ] as const
      ).map((theme) => (
        <Choice
          key={theme.id}
          title={theme.label}
          selected={preferences.theme === theme.id}
          onPress={() => preferences.setTheme(theme.id)}
        />
      ))}
      <SectionHeading title={copy.language} />
      {(["vi", "en"] as const).map((locale) => (
        <Choice
          key={locale}
          title={locale === "vi" ? "Tiếng Việt" : "English (core screens)"}
          selected={preferences.locale === locale}
          onPress={() => {
            preferences.setLocale(locale);
            update.mutate({ locale });
          }}
        />
      ))}
      <MoriButton secondary onPress={() => setPrivacy(true)}>
        {copy.privacy}
      </MoriButton>
      {config.demo && (
        <>
          <MoriButton
            secondary
            loading={seed.isPending}
            onPress={() => seed.mutate()}
          >
            Nạp dữ liệu mẫu để khám phá
          </MoriButton>
          {!!notice && <MoriText>{notice}</MoriText>}
        </>
      )}
      {!config.demo && (
        <MoriButton
          secondary
          loading={signout.isPending}
          onPress={() => signout.mutate()}
        >
          Đăng xuất và xóa bản nháp thiết bị
        </MoriButton>
      )}
      <MoriText muted variant="small">
        {copy.boundary}
      </MoriText>
      <MoriBottomSheet visible={privacy} onClose={() => setPrivacy(false)}>
        <View style={styles.stack}>
          <MoriText variant="title">Bạn có quyền quyết định.</MoriText>
          <MoriText>
            Nội dung riêng tư không được đưa vào log hay analytics. Trong chế độ
            kết nối thật, nội dung bạn gửi được xử lý bởi nhà cung cấp AI cấu
            hình trên máy chủ.
          </MoriText>
          <MoriText muted>
            Ký ức chỉ được dùng khi bạn đồng ý. Xóa tài khoản sẽ xóa dữ liệu
            liên quan trong cơ sở dữ liệu đang hoạt động. Chính sách thời hạn
            bản sao lưu cần được nhà vận hành công bố trước khi phát hành.
          </MoriText>
          <MoriText muted>
            Bản nháp trên web nằm trong trình duyệt này; trên native được lưu
            bằng bộ nhớ bảo mật của hệ điều hành. Không dùng dữ liệu nhạy cảm
            thật trong demo.
          </MoriText>
          <MoriText muted>
            Bạn có thể xuất hoặc xóa dữ liệu trong mục Dữ liệu của bạn.
          </MoriText>
          <MoriButton onPress={() => setPrivacy(false)}>Đã hiểu</MoriButton>
        </View>
      </MoriBottomSheet>
    </ScreenContainer>
  );
}
