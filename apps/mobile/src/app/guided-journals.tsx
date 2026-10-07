import { guidedJournalTemplates } from "@mori/shared";
import { GuidedJournalCard } from "../features/journal/GuidedJournalCard";
import { MoriText, ScreenContainer } from "../components/ui";

export default function GuidedJournalLibrary() {
  return (
    <ScreenContainer back>
      <MoriText muted variant="small" style={{ letterSpacing: 2 }}>
        THƯ VIỆN NHẬT KÝ
      </MoriText>
      <MoriText variant="hero">Một gợi ý để bắt đầu.</MoriText>
      <MoriText muted>
        Chọn điều gần với bạn lúc này. Bạn có thể dừng và quay lại bất cứ khi
        nào.
      </MoriText>
      {guidedJournalTemplates
        .filter((template) => template.enabled)
        .map((template) => (
          <GuidedJournalCard key={template.id} template={template} />
        ))}
    </ScreenContainer>
  );
}
