import { useState } from "react";
import { View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Memory, MemoryCategory } from "@mori/shared";
import {
  MoriButton,
  MoriConfirmSheet,
  MoriText,
  ScreenContainer,
  ErrorNote,
  Loading,
  styles,
} from "../components/ui";
import { MemoryCard } from "../features/memories/MemoryCard";
import { request, refresh } from "../services/api";
import { useSession } from "../store/session";
import {
  MemoryEditor,
  memoryLabels as labels,
} from "../features/memories/MemoryEditor";
export default function Memories() {
  const owner = useSession((s) => s.userId);
  return <MemoryList key={owner} owner={owner} />;
}
function MemoryList({ owner }: { owner: string | null }) {
  const list = useQuery({
    queryKey: ["memories", owner],
    queryFn: () => request<Memory[]>("/memories", "GET", undefined, { owner }),
  });
  const [editing, setEditing] = useState<{ memory: Memory | null } | null>(
    null,
  );
  const [deleting, setDeleting] = useState<string | null>(null);
  const remove = useMutation({
    mutationFn: () =>
      request(
        `/memories${deleting === "all" ? "" : `/${deleting}`}`,
        "DELETE",
        undefined,
        { owner },
      ),
    onSuccess: () => {
      setDeleting(null);
      void refresh();
    },
  });
  const approve = useMutation({
    mutationFn: (id: string) =>
      request(`/memories/${id}/approve`, "POST", undefined, { owner }),
    onSuccess: () => {
      void refresh();
    },
  });
  return (
    <ScreenContainer back>
      <MoriText variant="title">Những điều Mori ghi nhớ.</MoriText>
      <MoriText muted>
        Bạn quyết định điều gì được ở lại. Xóa một ký ức sẽ ngừng sử dụng nó
        trong những cuộc trò chuyện sau.
      </MoriText>
      <MoriButton
        disabled={approve.isPending || remove.isPending || !!editing}
        onPress={() => {
          setEditing({ memory: null });
        }}
      >
        Thêm một điều bạn muốn ghi nhớ
      </MoriButton>
      <ErrorNote error={list.error} retry={() => void list.refetch()} />
      <ErrorNote error={approve.error} />
      {list.isPending && <Loading />}
      {list.data?.length === 0 && (
        <MoriText muted>
          Mori chưa ghi nhớ điều gì. Bạn không cần thêm nếu không muốn.
        </MoriText>
      )}
      {MemoryCategory.options.map((cat) => {
        const entries = list.data?.filter((m) => m.category === cat);
        return entries?.length ? (
          <View key={cat} style={styles.stack}>
            <MoriText variant="subtitle">{labels[cat]}</MoriText>
            {entries.map((memory) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                onEdit={() => {
                  setEditing({ memory });
                }}
                onDelete={() => setDeleting(memory.id)}
                onApprove={() => approve.mutate(memory.id)}
                disabled={approve.isPending || remove.isPending || !!editing}
              />
            ))}
          </View>
        ) : null;
      })}
      {!!list.data?.length && (
        <MoriButton
          variant="dangerGhost"
          disabled={approve.isPending || remove.isPending || !!editing}
          onPress={() => setDeleting("all")}
        >
          Xóa tất cả ký ức của Mori
        </MoriButton>
      )}
      {editing && (
        <MemoryEditor
          memory={editing.memory}
          knownIds={list.data?.map((m) => m.id) ?? []}
          onClose={() => {
            setEditing(null);
            void refresh();
          }}
        />
      )}
      <MoriConfirmSheet
        visible={deleting !== null}
        title={deleting === "all" ? "Quên tất cả ký ức?" : "Quên điều này?"}
        description="Nhật ký và cuộc trò chuyện gốc vẫn được giữ nếu bạn chưa xóa chúng. Hành động này không thể hoàn tác."
        confirmLabel={deleting === "all" ? "Xóa tất cả ký ức" : "Xóa ký ức này"}
        loadingLabel="Đang xóa ký ức…"
        loading={remove.isPending}
        error={remove.error}
        onConfirm={() => remove.mutate()}
        onCancel={() => setDeleting(null)}
      />
    </ScreenContainer>
  );
}
