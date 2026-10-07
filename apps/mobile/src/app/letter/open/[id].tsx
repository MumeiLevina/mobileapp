import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Letter } from "@mori/shared";
import {
  ErrorNote,
  MoriButton,
  MoriCard,
  MoriText,
  ScreenContainer,
} from "../../../components/ui";
import { refresh, request } from "../../../services/api";
import { cancelLetterNotification } from "../../../services/notifications";

export default function OpenLetter() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [letter, setLetter] = useState<Letter | null>(null);
  const open = useMutation({
    mutationFn: () => request<Letter>(`/letters/${id}/open`, "POST"),
    onSuccess: async (value) => {
      setLetter(value);
      await cancelLetterNotification(id).catch(() => undefined);
      await refresh();
    },
  });
  return (
    <ScreenContainer back>
      <MoriText muted variant="small" style={{ letterSpacing: 2 }}>
        THƯ GỬI CHÍNH MÌNH
      </MoriText>
      {!letter ? (
        <>
          <MoriText variant="title">Lá thư đang ở đây.</MoriText>
          <MoriText muted>
            Bạn có thể mở bây giờ, hoặc quay lại vào một lúc khác. Không có hạn
            chót.
          </MoriText>
          <ErrorNote error={open.error} />
          <MoriButton
            icon="mail-open-outline"
            loading={open.isPending}
            loadingLabel="Đang mở lá thư…"
            onPress={() => open.mutate()}
          >
            Mở lá thư
          </MoriButton>
        </>
      ) : (
        <>
          <MoriText variant="title" translate={false}>
            {letter.title}
          </MoriText>
          <MoriText muted variant="small">
            Viết ngày {new Date(letter.created_at).toLocaleDateString("vi-VN")}
          </MoriText>
          <MoriCard>
            <MoriText translate={false} style={{ lineHeight: 28 }}>
              {letter.content}
            </MoriText>
          </MoriCard>
          <MoriButton
            variant="secondary"
            onPress={() => router.replace("/letters" as "/timeline")}
          >
            Trở về kho thư
          </MoriButton>
        </>
      )}
    </ScreenContainer>
  );
}
