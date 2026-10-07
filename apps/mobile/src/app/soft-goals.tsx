import { useState } from "react";
import { View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { SoftGoal, createSoftGoalSchema } from "@mori/shared";
import {
  ErrorNote,
  Loading,
  MoriButton,
  MoriCard,
  MoriInput,
  MoriText,
  ScreenContainer,
  SectionHeading,
} from "../components/ui";
import { newId } from "../lib/id";
import { refresh, request } from "../services/api";

function GoalCard({
  goal,
  busy,
  onComplete,
  onArchive,
}: {
  goal: SoftGoal;
  busy: boolean;
  onComplete: () => void;
  onArchive: () => void;
}) {
  return (
    <MoriCard>
      <MoriText variant="subtitle" translate={false}>
        {goal.title}
      </MoriText>
      {!!goal.note && (
        <MoriText muted translate={false}>
          {goal.note}
        </MoriText>
      )}
      {goal.status === "active" ? (
        <View style={{ gap: 8 }}>
          <MoriButton disabled={busy} onPress={onComplete}>
            Đã làm xong
          </MoriButton>
          <MoriButton variant="ghost" disabled={busy} onPress={onArchive}>
            Cất đi
          </MoriButton>
        </View>
      ) : (
        <MoriText muted variant="small">
          Bạn đã dành một chút thời gian cho điều này.
        </MoriText>
      )}
    </MoriCard>
  );
}

export default function SoftGoalsScreen() {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const goals = useQuery({
    queryKey: ["soft-goals"],
    queryFn: () => request<SoftGoal[]>("/soft-goals"),
  });
  const create = useMutation({
    mutationFn: () => {
      const value = createSoftGoalSchema.parse({
        title,
        note,
        client_id: newId(),
        source_type: "manual",
        source_id: null,
      });
      return request<SoftGoal>("/soft-goals", "POST", value);
    },
    onSuccess: async () => {
      setTitle("");
      setNote("");
      setAdding(false);
      await refresh();
    },
  });
  const action = useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: "complete" | "archive" }) =>
      request<SoftGoal>(`/soft-goals/${id}/${kind}`, "POST"),
    onSuccess: refresh,
  });
  const active = goals.data?.filter((goal) => goal.status === "active") ?? [];
  const completed =
    goals.data?.filter((goal) => goal.status === "completed").slice(0, 5) ?? [];
  return (
    <ScreenContainer back>
      <MoriText muted variant="small" style={{ letterSpacing: 2 }}>
        Ý ĐỊNH NHỎ
      </MoriText>
      <MoriText variant="title">Những điều nhỏ mình đang giữ.</MoriText>
      <MoriText muted>
        Không có hạn chót hay chuỗi ngày. Bạn có thể hoàn thành hoặc cất đi khi
        thấy phù hợp.
      </MoriText>
      {!adding ? (
        <MoriButton icon="add-outline" onPress={() => setAdding(true)}>
          Thêm một ý định nhỏ
        </MoriButton>
      ) : (
        <MoriCard>
          <MoriText muted>
            Giữ nó nhỏ đến mức bạn có thể bắt đầu mà không cần chuẩn bị nhiều.
          </MoriText>
          <MoriInput
            accessibilityLabel="Tên ý định nhỏ"
            placeholder="Đi bộ 10 phút…"
            value={title}
            onChangeText={setTitle}
            maxLength={160}
          />
          <MoriInput
            accessibilityLabel="Ghi chú cho ý định"
            placeholder="Ghi chú, nếu bạn muốn…"
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={2000}
          />
          <ErrorNote error={create.error} />
          <MoriButton
            loading={create.isPending}
            loadingLabel="Đang giữ lại…"
            disabled={!title.trim()}
            onPress={() => create.mutate()}
          >
            Giữ lại điều này
          </MoriButton>
          <MoriButton variant="ghost" onPress={() => setAdding(false)}>
            Để sau
          </MoriButton>
        </MoriCard>
      )}
      <ErrorNote
        error={goals.error ?? action.error}
        retry={() => void goals.refetch()}
      />
      {goals.isPending && <Loading />}
      <SectionHeading title="Đang giữ" />
      {active.length
        ? active.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              busy={action.isPending}
              onComplete={() =>
                action.mutate({ id: goal.id, kind: "complete" })
              }
              onArchive={() => action.mutate({ id: goal.id, kind: "archive" })}
            />
          ))
        : !goals.isPending && (
            <MoriText muted>Bạn chưa cần giữ điều gì ở đây lúc này.</MoriText>
          )}
      {!!completed.length && (
        <>
          <SectionHeading title="Đã dành thời gian" />
          {completed.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              busy={action.isPending}
              onComplete={() => undefined}
              onArchive={() => undefined}
            />
          ))}
        </>
      )}
    </ScreenContainer>
  );
}
