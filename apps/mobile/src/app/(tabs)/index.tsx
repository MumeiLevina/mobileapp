import { View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Garden } from "@mori/shared";
import { Ionicons } from "@expo/vector-icons";
import {
  ErrorNote,
  MoriButton,
  MoriCard,
  MoriIconButton,
  MoriText,
  ScreenContainer,
  SectionHeading,
} from "../../components/ui";
import { GardenScene } from "../../features/garden/GardenScene";
import { currentHomeRitual } from "../../features/home/ritual-time";
import { MoodPicker } from "../../features/mood/MoodPicker";
import { SelfCareCard } from "../../features/selfcare/SelfCareCard";
import { request } from "../../services/api";
import { useTheme } from "../../theme";
import { useT } from "../../i18n";

export default function Home() {
  const theme = useTheme();
  const copy = useT();
  const ritual = currentHomeRitual();
  const garden = useQuery({
    queryKey: ["garden"],
    queryFn: () => request<Garden>("/garden"),
  });
  return (
    <ScreenContainer>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 8,
        }}
      >
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <Ionicons name="leaf-outline" size={24} color={theme.primary} />
          <MoriText style={{ fontSize: 23, letterSpacing: 4 }}>mori</MoriText>
        </View>
        <MoriIconButton
          icon={theme.night ? "moon-outline" : "sunny-outline"}
          accessibilityLabel="Cài đặt giao diện"
          onPress={() => router.push("/(tabs)/me")}
        />
      </View>
      <View style={{ paddingTop: 12, gap: 4 }}>
        <MoriText muted>{copy.hello}</MoriText>
        <MoriText variant="title">{copy.heart}</MoriText>
      </View>
      <GardenScene
        level={garden.data?.tree_level ?? 1}
        areas={garden.data?.sanctuary_areas ?? []}
        interactive
      />
      <MoriText muted variant="small" style={{ textAlign: "center" }}>
        {copy.gardenNote}
      </MoriText>
      <ErrorNote error={garden.error} retry={() => void garden.refetch()} />

      <SectionHeading title="Bạn đang thế nào?" />
      <MoodPicker />
      <MoriButton
        icon="chatbubble-ellipses-outline"
        onPress={() => router.push("/(tabs)/talk")}
      >
        {copy.talkCta}
      </MoriButton>

      <SectionHeading title="Cho khoảnh khắc này" />
      <View style={{ marginTop: -16 }}>
        <SelfCareCard
          title="Phòng yên"
          subtitle="Không cần nói gì"
          icon="rainy-outline"
          to="/quiet-room"
        />
        <SelfCareCard
          title={copy.breathing}
          subtitle="2 phút · Chậm lại một nhịp"
          icon="flower-outline"
          to="/activity/breathing"
        />
        <SelfCareCard
          title={copy.write}
          subtitle="Không cần viết thật hay"
          icon="create-outline"
          to="/journal/new"
        />
      </View>

      {!!ritual && (
        <>
          <SectionHeading
            title={ritual === "morning" ? "Buổi sáng" : "Buổi tối"}
          />
          <MoriCard>
            <MoriText variant="subtitle">
              {ritual === "morning"
                ? "Một khởi đầu vừa đủ."
                : "Hôm nay đã đi qua rồi."}
            </MoriText>
            <MoriText muted>
              {ritual === "morning"
                ? "Chọn cảm giác bạn muốn mang theo hôm nay."
                : "Đặt xuống một điều trước khi nghỉ, nếu bạn muốn."}
            </MoriText>
            <MoriButton
              variant="secondary"
              onPress={() => router.push(`/ritual/${ritual}` as "/self-care")}
            >
              {ritual === "morning" ? "Mở Morning Ritual" : "Mở Evening Ritual"}
            </MoriButton>
          </MoriCard>
        </>
      )}

      <SectionHeading title="Khi mọi thứ khó khăn" />
      <MoriButton
        variant="dangerGhost"
        icon="heart-outline"
        onPress={() => router.push("/first-aid" as "/self-care")}
      >
        Mình đang có một lúc khó khăn
      </MoriButton>
      <MoriText
        muted
        variant="small"
        style={{ textAlign: "center", paddingVertical: 14 }}
      >
        {copy.noPressure}
      </MoriText>
    </ScreenContainer>
  );
}
