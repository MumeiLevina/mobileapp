import { Linking } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { FirstAidCrisisResponse } from "@mori/shared";
import {
  ErrorNote,
  Loading,
  MoriButton,
  MoriCard,
  MoriText,
  ScreenContainer,
} from "../../components/ui";
import { request } from "../../services/api";

export default function FirstAidDanger() {
  const crisis = useQuery({
    queryKey: ["first-aid-crisis"],
    queryFn: () => request<FirstAidCrisisResponse>("/first-aid/crisis"),
  });
  return (
    <ScreenContainer back>
      <MoriText variant="title">Ưu tiên sự an toàn của bạn lúc này.</MoriText>
      {crisis.isPending ? (
        <Loading />
      ) : (
        <MoriText>{crisis.data?.message}</MoriText>
      )}
      <ErrorNote error={crisis.error} retry={() => void crisis.refetch()} />
      {crisis.data?.resources.map((resource) => (
        <MoriCard key={resource.id}>
          <MoriText style={{ fontWeight: "600" }}>{resource.name}</MoriText>
          {!!resource.available_hours && (
            <MoriText muted>{resource.available_hours}</MoriText>
          )}
          {!!resource.phone && (
            <MoriButton
              icon="call-outline"
              onPress={() => void Linking.openURL(`tel:${resource.phone}`)}
            >
              Gọi {resource.phone}
            </MoriButton>
          )}
          {!!resource.url && (
            <MoriButton
              variant="secondary"
              onPress={() => void Linking.openURL(resource.url!)}
            >
              Mở trang hỗ trợ
            </MoriButton>
          )}
        </MoriCard>
      ))}
      <MoriText muted variant="small">
        Mori không phải dịch vụ khẩn cấp. Nếu nguy hiểm đang xảy ra, hãy liên hệ
        dịch vụ cấp cứu tại nơi bạn sống.
      </MoriText>
    </ScreenContainer>
  );
}
