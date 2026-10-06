import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Garden } from "@mori/shared";
import { Ionicons } from "@expo/vector-icons";
import {
  MoriButton,
  MoriText,
  ScreenContainer,
  SectionHeading,
  ErrorNote,
} from "../../components/ui";
import { GardenScene } from "../../features/garden/GardenScene";
import { MoodPicker } from "../../features/mood/MoodPicker";
import { SelfCareCard } from "../../features/selfcare/SelfCareCard";
import { request } from "../../services/api";
import { useTheme } from "../../theme";
import { useT } from "../../i18n";
export default function Home() {
  const t = useTheme();
  const copy = useT();
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
          <Ionicons name="leaf-outline" size={24} color={t.primary} />
          <MoriText style={{ fontSize: 23, letterSpacing: 4 }}>mori</MoriText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cài đặt giao diện"
          onPress={() => router.push("/(tabs)/me")}
          style={{ padding: 10 }}
        >
          <Ionicons
            name={t.night ? "moon-outline" : "sunny-outline"}
            size={24}
            color={t.muted}
          />
        </Pressable>
      </View>
      <View style={{ paddingTop: 12, gap: 4 }}>
        <MoriText muted>{copy.hello}</MoriText>
        <MoriText variant="title">{copy.heart}</MoriText>
        <MoriText muted variant="small">
          {copy.homeNote}
        </MoriText>
      </View>
      <GardenScene level={garden.data?.tree_level ?? 1} />
      <MoriText
        muted
        variant="small"
        style={{ textAlign: "center", fontSize: 12 }}
      >
        {copy.gardenNote}
      </MoriText>
      <ErrorNote error={garden.error} retry={() => void garden.refetch()} />
      <MoodPicker />
      <MoriButton
        icon="chatbubble-ellipses-outline"
        onPress={() => router.push("/(tabs)/talk")}
      >
        {copy.talkCta}
      </MoriButton>
      <SectionHeading
        title={copy.smallCare}
        action={
          <Pressable onPress={() => router.push("/self-care")}>
            <MoriText muted variant="small">
              {copy.all} ↗
            </MoriText>
          </Pressable>
        }
      />
      <View style={{ marginTop: -16 }}>
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
        <SelfCareCard
          title={copy.rain}
          subtitle="3 phút · Một khoảng lặng"
          icon="rainy-outline"
          to="/activity/rain"
        />
      </View>
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
