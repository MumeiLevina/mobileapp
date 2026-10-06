import { useState } from "react";
import { View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Memory, MemoryCategory, memorySchema } from "@mori/shared";
import {
  MoriButton,
  MoriBottomSheet,
  MoriInput,
  MoriText,
  ScreenContainer,
  Choice,
  ErrorNote,
  Loading,
  styles,
} from "../components/ui";
import { MemoryCard } from "../features/memories/MemoryCard";
import { request, refresh } from "../services/api";
const labels: Record<MemoryCategory, string> = {
  preference: "Sở thích",
  life_event: "Điều đang diễn ra",
  relationship: "Mối quan hệ",
  goal: "Điều bạn hướng tới",
  self_care_preference: "Cách chăm sóc mình",
  communication_preference: "Cách trò chuyện",
};
export default function Memories() {
  const list = useQuery({
    queryKey: ["memories"],
    queryFn: () => request<Memory[]>("/memories"),
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<MemoryCategory>("preference");
  const [deleting, setDeleting] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      const value = memorySchema.safeParse({ content, category });
      if (!value.success) throw new Error("Hãy nhập điều bạn muốn ghi nhớ.");
      const result = await request(
        `/memories${editing === "new" ? "" : `/${editing}`}`,
        editing === "new" ? "POST" : "PATCH",
        value.data,
      );
      if (editing !== "new")
        await request(`/memories/${editing}/approve`, "POST");
      return result;
    },
    onSuccess: () => {
      setEditing(null);
      void refresh();
    },
  });
  const remove = useMutation({
    mutationFn: () =>
      request(`/memories${deleting === "all" ? "" : `/${deleting}`}`, "DELETE"),
    onSuccess: () => {
      setDeleting(null);
      void refresh();
    },
  });
  const approve = useMutation({
    mutationFn: (id: string) => request(`/memories/${id}/approve`, "POST"),
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
        onPress={() => {
          setContent("");
          setCategory("preference");
          setEditing("new");
        }}
      >
        Thêm một điều bạn muốn ghi nhớ
      </MoriButton>
      <ErrorNote
        error={list.error ?? approve.error}
        retry={() => void list.refetch()}
      />
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
                  setEditing(memory.id);
                  setContent(memory.content);
                  setCategory(memory.category);
                }}
                onDelete={() => setDeleting(memory.id)}
                onApprove={() => approve.mutate(memory.id)}
              />
            ))}
          </View>
        ) : null;
      })}
      {!!list.data?.length && (
        <MoriButton secondary onPress={() => setDeleting("all")}>
          Xóa tất cả ký ức của Mori
        </MoriButton>
      )}
      <MoriBottomSheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
      >
        <View style={styles.stack}>
          <MoriText variant="title">Điều bạn muốn giữ lại.</MoriText>
          <MoriInput
            accessibilityLabel="Nội dung ký ức"
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={600}
            placeholder="Ví dụ: Mình thích nghe tiếng mưa."
          />
          {MemoryCategory.options.map((cat) => (
            <Choice
              key={cat}
              title={labels[cat]}
              selected={cat === category}
              onPress={() => setCategory(cat)}
            />
          ))}
          <ErrorNote error={save.error} />
          <MoriButton loading={save.isPending} onPress={() => save.mutate()}>
            Lưu và cho phép ghi nhớ
          </MoriButton>
        </View>
      </MoriBottomSheet>
      <MoriBottomSheet
        visible={deleting !== null}
        onClose={() => setDeleting(null)}
      >
        <View style={styles.stack}>
          <MoriText variant="title">
            {deleting === "all" ? "Quên tất cả ký ức?" : "Quên điều này?"}
          </MoriText>
          <MoriText muted>
            Thao tác này không thể hoàn tác. Nhật ký và cuộc trò chuyện gốc vẫn
            được giữ nếu bạn chưa xóa chúng.
          </MoriText>
          <ErrorNote error={remove.error} />
          <MoriButton
            loading={remove.isPending}
            onPress={() => remove.mutate()}
          >
            Xác nhận xóa
          </MoriButton>
          <MoriButton secondary onPress={() => setDeleting(null)}>
            Giữ lại
          </MoriButton>
        </View>
      </MoriBottomSheet>
    </ScreenContainer>
  );
}
