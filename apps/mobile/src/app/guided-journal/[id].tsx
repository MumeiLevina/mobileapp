import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { getGuidedJournalTemplate } from "@mori/shared";
import {
  ErrorNote,
  Loading,
  MoriButton,
  MoriCard,
  MoriIconButton,
  MoriInput,
  MoriText,
  ScreenContainer,
  styles,
} from "../../components/ui";
import {
  buildGuidedJournalContent,
  GuidedJournalDraft,
  readGuidedJournalDraft,
} from "../../features/journal/guided-draft";
import { useDraft } from "../../hooks/useDraft";
import { refresh, request } from "../../services/api";
import { usePreferences } from "../../store/preferences";
import { useTheme } from "../../theme";

export default function GuidedJournalSession() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const template = getGuidedJournalTemplate(id ?? "");
  const localDraft = useDraft(`guided-journal.${id}`);
  const locale = usePreferences((state) => state.locale);
  const theme = useTheme();
  const initialized = useRef(false);
  const [session, setSession] = useState<GuidedJournalDraft | null>(null);

  useEffect(() => {
    if (!template || !localDraft.ready || initialized.current) return;
    initialized.current = true;
    setSession(readGuidedJournalDraft(localDraft.text, template));
  }, [localDraft.ready, localDraft.text, template]);

  const save = useMutation({
    mutationFn: () => {
      if (!template || !session) throw new Error("Bản nháp chưa sẵn sàng.");
      return request("/journals", "POST", {
        title: locale === "en" ? template.titleEn : template.titleVi,
        content: buildGuidedJournalContent(template, session.answers, locale),
        source: "guided",
        client_id: session.clientId,
      });
    },
    onSuccess: async () => {
      await localDraft.clear();
      await refresh();
      router.replace("/(tabs)/journal");
    },
  });

  if (!template) {
    return (
      <ScreenContainer back>
        <MoriText variant="title">Không tìm thấy gợi ý này.</MoriText>
        <MoriButton
          onPress={() => router.replace("/guided-journals" as "/self-care")}
        >
          Xem thư viện nhật ký
        </MoriButton>
      </ScreenContainer>
    );
  }

  if (!localDraft.ready || !session) {
    return (
      <ScreenContainer back>
        <Loading />
      </ScreenContainer>
    );
  }

  const reviewing = session.step === template.prompts.length;
  const title = locale === "en" ? template.titleEn : template.titleVi;
  const persist = (next: GuidedJournalDraft) => {
    setSession(next);
    localDraft.setText(JSON.stringify(next));
  };
  const goBack = () => {
    if (session.step === 0) {
      router.back();
      return;
    }
    persist({ ...session, step: session.step - 1 });
  };

  return (
    <ScreenContainer>
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <MoriIconButton
          icon="arrow-back"
          accessibilityLabel={
            session.step === 0 ? "Quay lại thư viện" : "Quay lại câu trước"
          }
          disabled={save.isPending}
          onPress={goBack}
        />
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={
            reviewing
              ? "Đang xem lại câu trả lời"
              : `Câu ${session.step + 1} trên ${template.prompts.length}`
          }
          accessibilityValue={{
            min: 0,
            max: template.prompts.length,
            now: session.step,
          }}
          style={{ flex: 1, gap: 7 }}
        >
          <MoriText muted variant="small">
            {reviewing
              ? "XEM LẠI"
              : `${session.step + 1} / ${template.prompts.length}`}
          </MoriText>
          <View
            style={{ height: 4, borderRadius: 2, backgroundColor: theme.line }}
          >
            <View
              style={{
                height: 4,
                width: `${(session.step / template.prompts.length) * 100}%`,
                borderRadius: 2,
                backgroundColor: theme.primary,
              }}
            />
          </View>
        </View>
      </View>

      <MoriText muted variant="small">
        {title}
      </MoriText>

      {reviewing ? (
        <View style={styles.stack}>
          <MoriText variant="title">Những điều bạn muốn giữ lại.</MoriText>
          <MoriText muted>
            Chỉ khi bạn bấm lưu, những câu trả lời này mới trở thành một trang
            nhật ký.
          </MoriText>
          {template.prompts.map((prompt, index) => (
            <MoriCard key={prompt.id}>
              <MoriText style={{ fontWeight: "600" }}>
                {locale === "en" ? prompt.en : prompt.vi}
              </MoriText>
              <MoriText translate={false}>{session.answers[index]}</MoriText>
              <MoriButton
                variant="ghost"
                size="medium"
                disabled={save.isPending}
                onPress={() => persist({ ...session, step: index })}
              >
                Sửa câu trả lời
              </MoriButton>
            </MoriCard>
          ))}
          <ErrorNote error={save.error ?? localDraft.error} />
          <MoriButton
            loading={save.isPending}
            loadingLabel="Đang lưu trang viết…"
            onPress={() => save.mutate()}
          >
            Lưu vào nhật ký
          </MoriButton>
          <MoriButton
            variant="ghost"
            disabled={save.isPending}
            onPress={() => router.back()}
          >
            Để sau
          </MoriButton>
        </View>
      ) : (
        <View style={styles.stack}>
          <MoriText variant="title">
            {locale === "en"
              ? template.prompts[session.step].en
              : template.prompts[session.step].vi}
          </MoriText>
          <MoriText muted>
            Không cần viết thật hay. Viết vừa đủ với bạn.
          </MoriText>
          <MoriInput
            accessibilityLabel={`Câu trả lời ${session.step + 1}`}
            value={session.answers[session.step]}
            onChangeText={(answer) => {
              const answers = [...session.answers];
              answers[session.step] = answer;
              persist({ ...session, answers });
            }}
            multiline
            maxLength={4000}
            placeholder="Mình đang nghĩ…"
            style={{ minHeight: 230, lineHeight: 27 }}
          />
          <ErrorNote error={localDraft.error} />
          <MoriButton
            disabled={!session.answers[session.step].trim()}
            onPress={() => persist({ ...session, step: session.step + 1 })}
          >
            {session.step === template.prompts.length - 1
              ? "Xem lại câu trả lời"
              : "Câu tiếp theo"}
          </MoriButton>
          <MoriButton variant="ghost" onPress={() => router.back()}>
            Để sau
          </MoriButton>
        </View>
      )}
    </ScreenContainer>
  );
}
