import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ChatResult,
  Conversation,
  ConversationMode,
  Message,
} from "@mori/shared";
import { Ionicons } from "@expo/vector-icons";
import {
  MoriButton,
  MoriText,
  MoriInput,
  MoriCard,
  MoriBottomSheet,
  ScreenContainer,
  ErrorNote,
  styles,
} from "../../components/ui";
import { ConversationBubble } from "../../features/conversation/ConversationBubble";
import { request, refresh } from "../../services/api";
import { newId } from "../../lib/id";
import { useDraft } from "../../hooks/useDraft";
import { useTheme } from "../../theme";
import { useT } from "../../i18n";
import { privateStorage } from "../../lib/storage";
import { useSession } from "../../store/session";
import { registerDraft } from "../../services/cleanup";
import { SelfCareCard } from "../../features/selfcare/SelfCareCard";
export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const copy = useT();
  const draft = useDraft(`chat.${id}`);
  const user = useSession((s) => s.userId);
  const [mode, setMode] = useState<ConversationMode>("listen");
  const [clientId, setClientId] = useState(newId);
  const [end, setEnd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [candidate, setCandidate] = useState<ChatResult["memory"]>();
  const [crisis, setCrisis] = useState(false);
  const [activity, setActivity] = useState<ChatResult["activity"]>();
  const [voiceNote, setVoiceNote] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const data = useQuery({
    queryKey: ["conversation", id],
    queryFn: () =>
      request<{ conversation: Conversation; messages: Message[] }>(
        `/conversations/${id}`,
      ),
  });
  useEffect(() => {
    if (data.data?.conversation) setMode(data.data.conversation.mode);
  }, [data.data?.conversation.id]);
  const send = useMutation({
    mutationFn: () =>
      request<ChatResult>(`/conversations/${id}/messages`, "POST", {
        content: draft.text,
        mode,
        client_id: clientId,
      }),
    onSuccess: async (result) => {
      await draft.clear();
      setClientId(newId());
      setCandidate(result.memory);
      setActivity(result.activity);
      setCrisis(["crisis", "elevated"].includes(result.safetyLevel));
      await refresh();
    },
  });
  const memory = useMutation({
    mutationFn: (approve: boolean) =>
      request(
        `/memories/${candidate!.id}${approve ? "/approve" : ""}`,
        approve ? "POST" : "DELETE",
      ),
    onSuccess: () => {
      setCandidate(undefined);
      void refresh();
    },
  });
  const reflect = useMutation({
    mutationFn: async () => {
      const reflection = await request<{ title: string; content: string }>(
        `/conversations/${id}/journal-draft`,
        "POST",
      );
      await registerDraft(user ?? "guest", `mori.${user}.journal.new`);
      await privateStorage.setItem(
        `mori.${user}.journal.new`,
        JSON.stringify({
          ...reflection,
          source: "conversation",
          client_id: newId(),
        }),
      );
    },
    onSuccess: () => {
      setEnd(false);
      router.push("/journal/new");
    },
  });
  const remove = useMutation({
    mutationFn: () => request(`/conversations/${id}`, "DELETE"),
    onSuccess: async () => {
      await draft.clear();
      await refresh();
      router.replace("/(tabs)/talk");
    },
  });
  return (
    <ScreenContainer scroll={false}>
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <Pressable
          accessibilityLabel={copy.back}
          onPress={() => router.back()}
          style={{ padding: 8 }}
        >
          <Ionicons name="arrow-back" size={23} color={t.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <MoriText variant="subtitle">Mori</MoriText>
          <MoriText variant="small" muted>
            AI · Một khoảng lắng nghe
          </MoriText>
        </View>
        <Pressable
          accessibilityLabel="Tùy chọn cuộc trò chuyện"
          onPress={() => setEnd(true)}
          style={{ padding: 10 }}
        >
          <Ionicons name="ellipsis-horizontal" size={23} color={t.text} />
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", gap: 5, flexWrap: "wrap" }}>
        {(["listen", "understand", "think"] as const).map((m) => (
          <Pressable
            key={m}
            accessibilityRole="radio"
            accessibilityState={{ selected: mode === m }}
            onPress={() => setMode(m)}
            style={{
              padding: 9,
              borderRadius: 15,
              backgroundColor: mode === m ? t.soft : "transparent",
            }}
          >
            <MoriText variant="small">{copy[m]}</MoriText>
          </Pressable>
        ))}
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() =>
            scroll.current?.scrollToEnd({ animated: false })
          }
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          <ErrorNote error={data.error} retry={() => void data.refetch()} />
          {data.data?.messages.length === 0 && (
            <View style={{ paddingVertical: 38, gap: 15 }}>
              <MoriText variant="title">Bạn cứ bắt đầu từ bất cứ đâu.</MoriText>
              <MoriText muted>
                Không cần một câu chuyện hoàn chỉnh. Một cảm xúc, một điều nhỏ
                cũng được.
              </MoriText>
            </View>
          )}
          {data.data?.messages.map((message) => (
            <ConversationBubble key={message.id} message={message} />
          ))}
          {send.isPending && (
            <MoriText
              accessibilityLiveRegion="polite"
              muted
              style={{ padding: 16 }}
            >
              Mori đang chuẩn bị phản hồi · · ·
            </MoriText>
          )}
          {crisis && (
            <MoriCard>
              <MoriText>Ưu tiên sự an toàn của bạn lúc này.</MoriText>
              <MoriText muted>
                Liên hệ một người bạn tin tưởng hoặc dịch vụ cấp cứu tại nơi bạn
                sống nếu có nguy hiểm ngay lập tức.
              </MoriText>
            </MoriCard>
          )}
          {activity && !crisis && (
            <SelfCareCard
              title={activity.title}
              subtitle={activity.description}
              icon="flower-outline"
              to={`/activity/${activity.id}`}
            />
          )}
          {candidate && (
            <MoriCard>
              <MoriText variant="small" muted>
                MORI MUỐN XIN PHÉP GHI NHỚ
              </MoriText>
              <MoriText translate={false}>{candidate.content}</MoriText>
              <ErrorNote error={memory.error} />
              <MoriButton
                loading={memory.isPending}
                onPress={() => memory.mutate(true)}
              >
                Ghi nhớ điều này
              </MoriButton>
              <MoriButton
                secondary
                disabled={memory.isPending}
                onPress={() => memory.mutate(false)}
              >
                Không lưu
              </MoriButton>
            </MoriCard>
          )}
          {(data.data?.messages.length ?? 0) >= 10 && !crisis && (
            <MoriCard>
              <MoriText muted>
                Bạn có thể nghỉ một chút, uống nước hoặc nhắn cho một người tin
                tưởng. Bạn cũng có thể tiếp tục ở đây.
              </MoriText>
              <MoriButton secondary onPress={() => setEnd(true)}>
                Nghỉ một chút
              </MoriButton>
            </MoriCard>
          )}
        </ScrollView>
        <ErrorNote error={send.error ?? draft.error} />
        <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
          <MoriInput
            accessibilityLabel="Nội dung tin nhắn"
            value={draft.text}
            onChangeText={(value) => {
              draft.setText(value);
              if (send.isError) setClientId(newId());
            }}
            placeholder={copy.input}
            multiline
            maxLength={6000}
            editable={!send.isPending && draft.ready}
            style={{ flex: 1, maxHeight: 150 }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.send}
            disabled={!draft.text.trim() || send.isPending}
            onPress={() => send.mutate()}
            style={{
              backgroundColor: t.primary,
              width: 51,
              height: 54,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              opacity: !draft.text.trim() || send.isPending ? 0.4 : 1,
            }}
          >
            <Ionicons name="arrow-up" size={23} color={t.onPrimary} />
          </Pressable>
        </View>
        <Pressable
          onPress={() => setVoiceNote(!voiceNote)}
          style={{ paddingVertical: 9 }}
        >
          <MoriText muted variant="small">
            {voiceNote
              ? "Gửi giọng nói chưa có trong MVP. Bạn có thể nhập văn bản."
              : "Micro · Sắp có"}
          </MoriText>
        </Pressable>
      </KeyboardAvoidingView>
      <MoriBottomSheet visible={end} onClose={() => setEnd(false)}>
        <View style={styles.stack}>
          <MoriText variant="title">Giữ lại một điều, rồi nghỉ nhé?</MoriText>
          <MoriText muted>
            Bản nháp AI sẽ mở để bạn sửa. Chỉ lưu khi bạn chọn Lưu lại.
          </MoriText>
          <ErrorNote error={reflect.error ?? remove.error} />
          <MoriButton
            loading={reflect.isPending}
            disabled={!data.data?.messages.length}
            onPress={() => reflect.mutate()}
          >
            {copy.journalDraft}
          </MoriButton>
          <MoriButton
            secondary
            onPress={() => {
              setEnd(false);
              router.push("/activity/water");
            }}
          >
            Uống một chút nước
          </MoriButton>
          <MoriButton
            secondary
            onPress={() => {
              setEnd(false);
              router.replace("/(tabs)");
            }}
          >
            Về khu vườn
          </MoriButton>
          <MoriButton secondary onPress={() => setEnd(false)}>
            Tiếp tục tâm sự
          </MoriButton>
          {confirmDelete ? (
            <>
              <MoriText>
                Xóa cuộc trò chuyện này và toàn bộ tin nhắn? Không thể hoàn tác.
              </MoriText>
              <MoriButton
                loading={remove.isPending}
                onPress={() => remove.mutate()}
              >
                Xác nhận xóa
              </MoriButton>
            </>
          ) : (
            <MoriButton secondary onPress={() => setConfirmDelete(true)}>
              Xóa cuộc trò chuyện
            </MoriButton>
          )}
        </View>
      </MoriBottomSheet>
    </ScreenContainer>
  );
}
