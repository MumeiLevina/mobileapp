import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Conversation, ConversationMode } from "@mori/shared";
import {
  MoriButton,
  MoriCard,
  MoriText,
  ScreenContainer,
  ErrorNote,
  MoriPressable,
  MoriSegmentedControl,
  SectionHeading,
} from "../../components/ui";
import { GardenScene } from "../../features/garden/GardenScene";
import { request, refresh } from "../../services/api";
import { useT } from "../../i18n";
export default function Talk() {
  const [mode, setMode] = useState<ConversationMode>("listen");
  const copy = useT();
  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: () => request<Conversation[]>("/conversations"),
  });
  const start = useMutation({
    mutationFn: () => request<Conversation>("/conversations", "POST", { mode }),
    onSuccess: (conversation) => {
      void refresh();
      router.push(`/conversation/${conversation.id}`);
    },
  });
  return (
    <ScreenContainer>
      <MoriText variant="title">Một khoảng lắng nghe.</MoriText>
      <MoriText muted>
        Bạn không cần sắp xếp mọi suy nghĩ trước khi bắt đầu.
      </MoriText>
      <MoriButton
        secondary
        icon="sparkles-outline"
        onPress={() => router.push("/ask-mori")}
      >
        Hỏi Mori về những điều mình đã lưu
      </MoriButton>
      <GardenScene />
      <MoriText>Bạn muốn cuộc trò chuyện này như thế nào?</MoriText>
      <MoriSegmentedControl
        accessibilityLabel="Cách Mori đồng hành"
        value={mode}
        options={(["listen", "understand", "think"] as const).map((value) => ({
          value,
          label: copy[value],
        }))}
        disabled={start.isPending}
        onChange={setMode}
      />
      <ErrorNote error={start.error} />
      <MoriButton
        loading={start.isPending}
        loadingLabel="Đang mở cuộc trò chuyện…"
        onPress={() => start.mutate()}
      >
        {copy.talkCta}
      </MoriButton>
      <MoriButton
        secondary
        icon="eye-off-outline"
        disabled={start.isPending}
        onPress={() => router.push("/private-conversation" as "/ask-mori")}
      >
        Trò chuyện riêng tư
      </MoriButton>
      <MoriText muted variant="small">
        Không lưu sau khi bạn rời đi, trừ khi bạn chủ động chọn Lưu.
      </MoriText>
      <MoriText muted variant="small">
        {copy.boundary}
      </MoriText>
      <SectionHeading title="Những cuộc trò chuyện trước" />
      <ErrorNote
        error={conversations.error}
        retry={() => void conversations.refetch()}
      />
      {conversations.data?.length === 0 && (
        <MoriText muted>
          Chưa có cuộc trò chuyện nào. Bạn có thể bắt đầu bất cứ khi nào sẵn
          sàng.
        </MoriText>
      )}
      {conversations.data?.map((c) => (
        <MoriPressable
          key={c.id}
          accessibilityRole="button"
          accessibilityLabel={`${c.title}, ${new Date(c.created_at).toLocaleDateString("vi-VN")}`}
          guardMs={350}
          onPress={() => router.push(`/conversation/${c.id}`)}
          style={(pressed) => ({ opacity: pressed ? 0.82 : 1 })}
        >
          <MoriCard>
            <View>
              <MoriText>{c.title}</MoriText>
              <MoriText variant="small" muted>
                {new Date(c.created_at).toLocaleDateString("vi-VN")}
              </MoriText>
            </View>
          </MoriCard>
        </MoriPressable>
      ))}
    </ScreenContainer>
  );
}
