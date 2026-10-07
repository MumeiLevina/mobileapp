import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { LetterSummary } from "@mori/shared";
import {
  ErrorNote,
  Loading,
  MoriButton,
  MoriCard,
  MoriPressable,
  MoriText,
  ScreenContainer,
  SectionHeading,
} from "../components/ui";
import { request } from "../services/api";

const date = (value: string) =>
  new Date(value).toLocaleDateString("vi-VN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

function LetterCard({ letter }: { letter: LetterSummary }) {
  const ready = letter.status !== "upcoming";
  return (
    <MoriPressable
      accessibilityRole="button"
      accessibilityLabel={`${letter.title}, ${ready ? "có thể mở" : `mở vào ${date(letter.open_at)}`}`}
      onPress={() =>
        router.push(
          (ready
            ? `/letter/open/${letter.id}`
            : `/letter/${letter.id}`) as "/journal/[id]",
        )
      }
      style={(pressed) => ({ opacity: pressed ? 0.8 : 1 })}
    >
      <MoriCard>
        <MoriText variant="subtitle" translate={false}>
          {letter.title}
        </MoriText>
        <MoriText muted variant="small">
          Viết ngày {date(letter.created_at)}
        </MoriText>
        <MoriText>
          {letter.status === "upcoming"
            ? `Mở vào ${date(letter.open_at)}`
            : letter.status === "ready"
              ? "Lá thư đã sẵn sàng để bạn mở."
              : "Bạn đã mở lá thư này."}
        </MoriText>
      </MoriCard>
    </MoriPressable>
  );
}

export default function LettersVault() {
  const query = useQuery({
    queryKey: ["letters"],
    queryFn: () => request<LetterSummary[]>("/letters"),
  });
  const upcoming = query.data?.filter((letter) => letter.status === "upcoming");
  const ready = query.data?.filter((letter) => letter.status === "ready");
  const opened = query.data?.filter((letter) => letter.status === "opened");
  return (
    <ScreenContainer back>
      <MoriText muted variant="small" style={{ letterSpacing: 2 }}>
        THƯ GỬI CHÍNH MÌNH
      </MoriText>
      <MoriText variant="title">Một điều cho mình của mai sau.</MoriText>
      <MoriText muted>
        Nội dung thư ở riêng trong kho này và không được dùng làm ngữ cảnh AI.
      </MoriText>
      <MoriButton
        icon="mail-outline"
        onPress={() => router.push("/letter/new" as "/journal/[id]")}
      >
        Viết một lá thư
      </MoriButton>
      <ErrorNote error={query.error} retry={() => void query.refetch()} />
      {query.isPending && <Loading />}
      {!!ready?.length && (
        <>
          <SectionHeading title="Sẵn sàng" />
          {ready.map((letter) => (
            <LetterCard key={letter.id} letter={letter} />
          ))}
        </>
      )}
      <SectionHeading title="Sắp tới" />
      {upcoming?.length
        ? upcoming.map((letter) => (
            <LetterCard key={letter.id} letter={letter} />
          ))
        : !query.isPending && (
            <MoriText muted>Chưa có lá thư nào đang chờ.</MoriText>
          )}
      <SectionHeading title="Đã mở" />
      {opened?.length
        ? opened.map((letter) => <LetterCard key={letter.id} letter={letter} />)
        : !query.isPending && (
            <MoriText muted>Những lá thư đã mở sẽ ở đây.</MoriText>
          )}
    </ScreenContainer>
  );
}
