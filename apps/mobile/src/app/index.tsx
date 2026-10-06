import { Redirect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Profile } from "@mori/shared";
import { request } from "../services/api";
import { ErrorNote, Loading, ScreenContainer } from "../components/ui";
import { useSession } from "../store/session";
export default function Index() {
  const session = useSession();
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => request<Profile>("/profile"),
    enabled: !!session.userId,
  });
  if (!session.ready)
    return (
      <ScreenContainer>
        <Loading />
      </ScreenContainer>
    );
  if (!session.userId) return <Redirect href="/auth" />;
  if (profile.isPending)
    return (
      <ScreenContainer>
        <Loading />
      </ScreenContainer>
    );
  if (profile.error)
    return (
      <ScreenContainer>
        <ErrorNote error={profile.error} retry={() => void profile.refetch()} />
      </ScreenContainer>
    );
  return <Redirect href={profile.data.onboarded ? "/(tabs)" : "/onboarding"} />;
}
