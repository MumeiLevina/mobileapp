import { useState } from "react";
import { View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { AskMoriResponse } from "@mori/shared";
import {
  ErrorNote,
  MoriButton,
  MoriCard,
  MoriInput,
  MoriText,
  ScreenContainer,
  SectionHeading,
  styles,
} from "../components/ui";
import { request } from "../services/api";

export default function AskMoriScreen() {
  const [question, setQuestion] = useState("");
  const ask = useMutation({
    mutationFn: () =>
      request<AskMoriResponse>("/insights/ask", "POST", { question }),
  });

  return (
    <ScreenContainer back>
      <MoriText muted variant="small">
        NHÌN LẠI CÙNG MORI
      </MoriText>
      <MoriText variant="hero">Hỏi Mori</MoriText>
      <MoriText muted>
        Hỏi về những điều bạn đã tự lưu. Mori chỉ dùng ký ức đã duyệt và những
        ghi chép thuộc về bạn.
      </MoriText>
      <MoriInput
        accessibilityLabel="Câu hỏi cho Mori"
        placeholder="Gần đây mình thường viết về điều gì?"
        multiline
        value={question}
        onChangeText={setQuestion}
        style={{ minHeight: 110 }}
      />
      <ErrorNote error={ask.error} />
      <MoriButton
        loading={ask.isPending}
        disabled={question.trim().length < 3}
        onPress={() => ask.mutate()}
      >
        Nhìn lại dữ liệu của mình
      </MoriButton>
      {ask.data && (
        <View style={styles.stack} accessibilityLiveRegion="polite">
          <MoriCard>
            <MoriText>{ask.data.answer}</MoriText>
          </MoriCard>
          {ask.data.sources.length > 0 && (
            <>
              <SectionHeading title="Dựa trên" />
              {ask.data.sources.map((source) => (
                <MoriCard key={`${source.type}:${source.id}`}>
                  <MoriText>{source.label}</MoriText>
                  <MoriText muted variant="small">
                    {new Date(source.occurredAt).toLocaleDateString("vi-VN")}
                  </MoriText>
                </MoriCard>
              ))}
              <MoriText muted variant="small">
                Các mối liên hệ ở đây là quan sát trong dữ liệu của bạn, không
                phải bằng chứng về nguyên nhân hay chẩn đoán.
              </MoriText>
            </>
          )}
        </View>
      )}
    </ScreenContainer>
  );
}
