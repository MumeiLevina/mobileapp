import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Conversation, ConversationMode } from "@mori/shared";
import {
  MoriButton,
  MoriCard,
  MoriText,
  ScreenContainer,
  Choice,
  ErrorNote,
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
      {(["listen", "understand", "think"] as const).map((m) => (
        <Choice
          key={m}
          title={copy[m]}
          selected={mode === m}
          onPress={() => setMode(m)}
        />
      ))}
      <ErrorNote error={start.error} />
      <MoriButton loading={start.isPending} onPress={() => start.mutate()}>
        {copy.talkCta}
      </MoriButton>
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
        <Pressable
          key={c.id}
          onPress={() => router.push(`/conversation/${c.id}`)}
        >
          <MoriCard>
            <View>
              <MoriText>{c.title}</MoriText>
              <MoriText variant="small" muted>
                {new Date(c.created_at).toLocaleDateString("vi-VN")}
              </MoriText>
            </View>
          </MoriCard>
        </Pressable>
      ))}
    </ScreenContainer>
  );
}
