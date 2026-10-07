import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { guidedJournalTemplates, Journal } from "@mori/shared";
import { Ionicons } from "@expo/vector-icons";
import {
  ErrorNote,
  Loading,
  MoriButton,
  MoriCard,
  MoriIconButton,
  MoriInput,
  MoriPressable,
  MoriText,
  ScreenContainer,
  SectionHeading,
} from "../../components/ui";
import { GuidedJournalCard } from "../../features/journal/GuidedJournalCard";
import { request } from "../../services/api";
import { useT } from "../../i18n";
import { useTheme } from "../../theme";
export default function JournalList() {
  const copy = useT();
  const t = useTheme();
  const [search, setSearch] = useState("");
  const [calendar, setCalendar] = useState(false);
  const [day, setDay] = useState<number | null>(null);
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const journals = useQuery({
    queryKey: ["journals"],
    queryFn: () => request<Journal[]>("/journals"),
  });
  const entries = journals.data?.filter(
    (j) =>
      `${j.title} ${j.content}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()) &&
      (!day ||
        (new Date(j.created_at).getDate() === day &&
          new Date(j.created_at).getMonth() === month.getMonth() &&
          new Date(j.created_at).getFullYear() === month.getFullYear())),
  );
  return (
    <ScreenContainer>
      <MoriText muted variant="small" style={{ letterSpacing: 2 }}>
        NHẬT KÝ CỦA BẠN
      </MoriText>
      <MoriText variant="hero">{copy.journalTitle}</MoriText>
      <MoriText muted>{copy.journalNote}</MoriText>
      <MoriButton
        icon="create-outline"
        onPress={() => router.push("/journal/new")}
      >
        Viết tự do
      </MoriButton>
      <SectionHeading title="Gợi ý để bắt đầu" />
      {guidedJournalTemplates
        .filter((template) =>
          ["cuoi-ngay", "khi-moi-thu-hoi-nang", "hieu-minh-hon"].includes(
            template.slug,
          ),
        )
        .map((template) => (
          <GuidedJournalCard key={template.id} template={template} />
        ))}
      <MoriButton
        variant="ghost"
        onPress={() => router.push("/guided-journals" as "/self-care")}
      >
        Xem tất cả gợi ý
      </MoriButton>
      <MoriButton
        secondary
        icon="time-outline"
        onPress={() => router.push("/timeline")}
      >
        Xem dòng thời gian của mình
      </MoriButton>
      <MoriButton
        secondary
        icon="mail-outline"
        onPress={() => router.push("/letters" as "/timeline")}
      >
        Thư gửi chính mình
      </MoriButton>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <MoriInput
          accessibilityLabel={copy.search}
          placeholder={copy.search}
          value={search}
          onChangeText={setSearch}
          style={{ flex: 1 }}
        />
        <MoriIconButton
          icon="calendar-outline"
          accessibilityLabel="Lịch nhật ký"
          selected={calendar}
          onPress={() => {
            setCalendar(!calendar);
            setDay(null);
          }}
        />
      </View>
      {calendar && (
        <MoriCard>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <MoriIconButton
              icon="chevron-back"
              accessibilityLabel="Tháng trước"
              onPress={() => {
                setMonth(
                  new Date(month.getFullYear(), month.getMonth() - 1, 1),
                );
                setDay(null);
              }}
            />
            <MoriText>
              {month.toLocaleDateString("vi-VN", {
                month: "long",
                year: "numeric",
              })}
            </MoriText>
            <MoriIconButton
              icon="chevron-forward"
              accessibilityLabel="Tháng sau"
              onPress={() => {
                setMonth(
                  new Date(month.getFullYear(), month.getMonth() + 1, 1),
                );
                setDay(null);
              }}
            />
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((d) => (
              <MoriText
                key={d}
                variant="small"
                muted
                style={{
                  width: "14.28%",
                  textAlign: "center",
                  paddingVertical: 8,
                }}
              >
                {d}
              </MoriText>
            ))}
            {Array.from({ length: (month.getDay() + 6) % 7 }, (_, i) => (
              <View key={`blank-${i}`} style={{ width: "14.28%" }} />
            ))}
            {Array.from(
              {
                length: new Date(
                  month.getFullYear(),
                  month.getMonth() + 1,
                  0,
                ).getDate(),
              },
              (_, i) => i + 1,
            ).map((n) => {
              const hasEntry = journals.data?.some((j) => {
                const d = new Date(j.created_at);
                return (
                  d.getFullYear() === month.getFullYear() &&
                  d.getMonth() === month.getMonth() &&
                  d.getDate() === n
                );
              });
              return (
                <MoriPressable
                  key={n}
                  accessibilityRole="button"
                  accessibilityLabel={`Ngày ${n}${hasEntry ? ", có nhật ký" : ""}`}
                  accessibilityState={{ selected: day === n }}
                  feedback="selection"
                  onPress={() => setDay(day === n ? null : n)}
                  wrapperStyle={{ width: "14.28%" }}
                  style={(pressed) => ({
                    minHeight: 44,
                    paddingVertical: 9,
                    borderRadius: 12,
                    backgroundColor: day === n ? t.soft : "transparent",
                    opacity: pressed ? 0.72 : 1,
                  })}
                >
                  <MoriText
                    style={{
                      textAlign: "center",
                      fontWeight: hasEntry ? "700" : "400",
                      textDecorationLine: hasEntry ? "underline" : "none",
                    }}
                  >
                    {n}
                  </MoriText>
                </MoriPressable>
              );
            })}
          </View>
        </MoriCard>
      )}
      <ErrorNote error={journals.error} retry={() => void journals.refetch()} />
      {journals.isPending && <Loading />}
      {entries?.length === 0 && (
        <View style={{ paddingVertical: 40, gap: 16 }}>
          <Ionicons name="book-outline" size={35} color={t.muted} />
          <MoriText muted>
            {search || day ? "Không có trang viết phù hợp." : copy.emptyJournal}
          </MoriText>
        </View>
      )}
      {entries?.map((entry) => (
        <MoriPressable
          key={entry.id}
          accessibilityRole="button"
          accessibilityLabel={`${entry.title}, ${new Date(entry.created_at).toLocaleDateString("vi-VN")}`}
          guardMs={350}
          onPress={() => router.push(`/journal/${entry.id}`)}
          style={(pressed) => ({ opacity: pressed ? 0.82 : 1 })}
        >
          <MoriCard>
            <MoriText variant="small" muted>
              {new Date(entry.created_at).toLocaleDateString("vi-VN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </MoriText>
            <MoriText translate={false} variant="subtitle">
              {entry.title}
            </MoriText>
            <MoriText translate={false} muted numberOfLines={3}>
              {entry.content}
            </MoriText>
            <MoriText variant="small" muted>
              {entry.source === "manual"
                ? "Một trang tự viết"
                : entry.source === "guided"
                  ? "Nhật ký có hướng dẫn"
                  : "Từ một khoảng suy ngẫm"}{" "}
              ↗
            </MoriText>
          </MoriCard>
        </MoriPressable>
      ))}
    </ScreenContainer>
  );
}
