import { useQuery } from "@tanstack/react-query";
import { Activity } from "@mori/shared";
import {
  MoriText,
  ScreenContainer,
  Loading,
  ErrorNote,
} from "../components/ui";
import { SelfCareCard } from "../features/selfcare/SelfCareCard";
import { request } from "../services/api";
export default function SelfCare() {
  const data = useQuery({
    queryKey: ["self-care"],
    queryFn: () => request<Activity[]>("/self-care"),
  });
  return (
    <ScreenContainer back>
      <MoriText variant="hero">Một chút cho mình.</MoriText>
      <MoriText muted>
        Những việc nhỏ, vừa sức. Bạn có thể dừng bất cứ khi nào muốn.
      </MoriText>
      <ErrorNote error={data.error} retry={() => void data.refetch()} />
      {data.isPending && <Loading />}
      {data.data?.map((a) => (
        <SelfCareCard
          key={a.id}
          title={a.title}
          subtitle={`${Math.round(a.duration / 60)} phút · ${a.description}`}
          icon={
            a.category === "breathing"
              ? "flower-outline"
              : a.category === "walk"
                ? "walk-outline"
                : a.category === "hydration"
                  ? "water-outline"
                  : "leaf-outline"
          }
          to={`/activity/${a.id}`}
        />
      ))}
    </ScreenContainer>
  );
}
