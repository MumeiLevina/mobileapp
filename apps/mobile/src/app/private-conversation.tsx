import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import {
  Conversation,
  ConversationMode,
  EphemeralMessage,
  PrivateChatResult,
} from "@mori/shared";
import {
  ErrorNote,
  MoriBottomSheet,
  MoriButton,
  MoriIconButton,
  MoriInput,
  MoriSegmentedControl,
  MoriText,
  ScreenContainer,
  styles,
} from "../components/ui";
import { ConversationBubble } from "../features/conversation/ConversationBubble";
import { newId } from "../lib/id";
import { refresh, request } from "../services/api";
import { useT } from "../i18n";

export default function PrivateConversation() {
  const copy = useT();
  const sessionId = useRef(newId());
  const [mode, setMode] = useState<ConversationMode>("listen");
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<EphemeralMessage[]>([]);
  const [end, setEnd] = useState(false);
  const [crisis, setCrisis] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const send = useMutation({
    mutationFn: async () => {
      const clientId = newId();
      const input: EphemeralMessage = {
        id: newId(),
        role: "user",
        content: text.trim(),
      };
      const result = await request<PrivateChatResult>(
        "/private-conversations/messages",
        "POST",
        {
          content: text,
          mode,
          client_id: clientId,
          history: messages.slice(-12),
        },
      );
      return { input, result };
    },
    onSuccess: ({ input, result }) => {
      setMessages((current) => [...current, input, result.message]);
      setText("");
      setCrisis(["elevated", "crisis"].includes(result.safetyLevel));
    },
  });
  const save = useMutation({
    mutationFn: () =>
      request<Conversation>("/private-conversations/save", "POST", {
        client_id: sessionId.current,
        mode,
        messages,
      }),
    onSuccess: async (conversation) => {
      await refresh();
      router.replace(`/conversation/${conversation.id}`);
    },
  });
  const leave = () => {
    setMessages([]);
    setText("");
    router.replace("/(tabs)/talk");
  };
  return (
    <ScreenContainer scroll={false}>
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <MoriIconButton
          icon="arrow-back"
          accessibilityLabel={copy.back}
          onPress={() => setEnd(true)}
        />
        <View style={{ flex: 1 }}>
          <MoriText variant="subtitle">Riêng tư</MoriText>
          <MoriText variant="small" muted>
            Không lưu sau khi bạn rời đi
          </MoriText>
        </View>
        <MoriIconButton
          icon="exit-outline"
          accessibilityLabel="Rời cuộc trò chuyện riêng tư"
          onPress={() => setEnd(true)}
        />
      </View>
      <MoriSegmentedControl
        accessibilityLabel="Chế độ trò chuyện riêng tư"
        value={mode}
        options={(["listen", "understand", "think"] as const).map((value) => ({
          value,
          label: copy[value],
        }))}
        disabled={send.isPending}
        onChange={setMode}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scroll}
          contentContainerStyle={{ paddingBottom: 20, gap: 10 }}
          onContentSizeChange={() =>
            scroll.current?.scrollToEnd({ animated: false })
          }
        >
          {messages.length === 0 && (
            <View style={{ paddingVertical: 38, gap: 12 }}>
              <MoriText variant="title">
                Một khoảng chỉ thuộc phiên này.
              </MoriText>
              <MoriText muted>
                Safety vẫn hoạt động. Nội dung không vào ký ức, nhật ký, dòng
                thời gian hay Ask Mori.
              </MoriText>
            </View>
          )}
          {messages.map((message) => (
            <ConversationBubble
              key={message.id}
              message={{
                ...message,
                user_id: "ephemeral",
                conversation_id: "ephemeral",
                created_at: "",
              }}
            />
          ))}
          {crisis && (
            <MoriText muted>
              Nếu có nguy hiểm ngay lúc này, hãy liên hệ dịch vụ cấp cứu tại nơi
              bạn sống hoặc một người bạn tin tưởng.
            </MoriText>
          )}
        </ScrollView>
        <ErrorNote error={send.error} />
        <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
          <MoriInput
            accessibilityLabel="Nội dung riêng tư"
            value={text}
            onChangeText={setText}
            placeholder="Bạn có thể bắt đầu từ bất cứ đâu…"
            multiline
            maxLength={6000}
            editable={!send.isPending}
            style={{ flex: 1, maxHeight: 150 }}
          />
          <MoriIconButton
            icon="arrow-up"
            accessibilityLabel={copy.send}
            variant="primary"
            loading={send.isPending}
            disabled={!text.trim() || send.isPending}
            onPress={() => send.mutate()}
          />
        </View>
      </KeyboardAvoidingView>
      <MoriBottomSheet visible={end} onClose={() => setEnd(false)}>
        <View style={styles.stack}>
          <MoriText variant="title">Giữ lại cuộc trò chuyện này?</MoriText>
          <MoriText muted>
            Mặc định Mori sẽ rời đi mà không lưu. Nếu chọn Lưu, toàn bộ tin nhắn
            trong phiên sẽ thành một cuộc trò chuyện thường.
          </MoriText>
          <ErrorNote error={save.error} />
          <MoriButton
            loading={save.isPending}
            loadingLabel="Đang lưu cuộc trò chuyện…"
            disabled={messages.length < 2}
            onPress={() => save.mutate()}
          >
            Lưu
          </MoriButton>
          <MoriButton
            variant="dangerGhost"
            disabled={save.isPending}
            onPress={leave}
          >
            Rời đi mà không lưu
          </MoriButton>
          <MoriButton variant="ghost" onPress={() => setEnd(false)}>
            Tiếp tục trò chuyện
          </MoriButton>
        </View>
      </MoriBottomSheet>
    </ScreenContainer>
  );
}
