import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  MoriButton,
  MoriText,
  ScreenContainer,
  Loading,
  ErrorNote,
} from "../components/ui";
import { request, refresh } from "../services/api";
import { GardenScene } from "../features/garden/GardenScene";
export default function Reflection() {
  const complete = useMutation({
    mutationFn: () => request("/weekly-reflection/complete", "POST"),
    onSuccess: () => {
      void refresh();
      router.replace("/(tabs)");
    },
  });
  const data = useQuery({
    queryKey: ["weekly-reflection"],
    queryFn: () =>
      request<{ enabled: boolean; content: string | null }>(
        "/weekly-reflection",
      ),
  });
  return (
    <ScreenContainer back>
      <MoriText variant="title">Nhìn lại, thật nhẹ.</MoriText>
      <GardenScene />
      <ErrorNote
        error={data.error ?? complete.error}
        retry={() => void data.refetch()}
      />
      {data.isPending ? (
        <Loading />
      ) : (
        <MoriText>
          {data.data?.enabled
            ? data.data.content
            : "Nhìn lại tuần đang tắt. Bạn có thể bật trong phần Của bạn khi muốn."}
        </MoriText>
      )}
      <MoriButton onPress={() => router.push("/journal/new")}>
        Viết điều mình muốn mang theo
      </MoriButton>
      {data.data?.enabled && (
        <MoriButton
          loading={complete.isPending}
          onPress={() => complete.mutate()}
        >
          Mình đã dành một lúc nhìn lại
        </MoriButton>
      )}
      <MoriButton secondary onPress={() => router.replace("/(tabs)")}>
        Trở về với ngày của mình
      </MoriButton>
    </ScreenContainer>
  );
}
