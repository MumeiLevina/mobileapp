import { activities } from "@mori/shared";
import { MoriText, ScreenContainer } from "../components/ui";
import { SelfCareCard } from "../features/selfcare/SelfCareCard";
import { useTranslate } from "../i18n";
import { usePreferences } from "../store/preferences";
export default function SelfCare() {
  const tr = useTranslate();
  const locale = usePreferences((s) => s.locale);
  const library = activities.filter((activity) => activity.enabled);
  return (
    <ScreenContainer back>
      <MoriText variant="hero">Một chút cho mình.</MoriText>
      <MoriText muted>
        Những việc nhỏ, vừa sức. Bạn có thể dừng bất cứ khi nào muốn.
      </MoriText>
      <MoriText muted variant="small">
        Các hướng dẫn có sẵn trong ứng dụng. Bạn có thể thực hành không lưu; chỉ
        ghi nhận lên tài khoản khi máy chủ xác nhận.
      </MoriText>
      {library.length === 0 && (
        <MoriText muted>Chưa có hoạt động phù hợp trong thư viện này.</MoriText>
      )}
      {library.map((a) => (
        <SelfCareCard
          key={a.id}
          title={a.title}
          subtitle={`${Math.round(a.duration / 60)} ${locale === "en" ? "min" : "phút"} · ${tr(a.description)}`}
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
