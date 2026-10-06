import { useState } from "react";
import { View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  LifeMapItem,
  LifeMapSuggestion,
  LifeMapType,
  lifeMapSchema,
} from "@mori/shared";
import {
  Choice,
  ErrorNote,
  Loading,
  MoriBottomSheet,
  MoriButton,
  MoriCard,
  MoriInput,
  MoriText,
  ScreenContainer,
  SectionHeading,
  styles,
} from "../components/ui";
import { refresh, request } from "../services/api";

const labels: Record<LifeMapType, string> = {
  people: "Những người quan trọng",
  goals: "Điều mình hướng tới",
  values: "Điều mình trân trọng",
  places: "Những nơi có ý nghĩa",
  important_events: "Khoảnh khắc quan trọng",
  preferences: "Điều mình yêu thích",
  helpful_things: "Những điều giúp mình",
};

export default function LifeMapScreen() {
  const items = useQuery({
    queryKey: ["life-map"],
    queryFn: () => request<LifeMapItem[]>("/life-map"),
  });
  const suggestions = useQuery({
    queryKey: ["life-map-suggestions"],
    queryFn: () => request<LifeMapSuggestion[]>("/life-map/suggestions"),
  });
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [type, setType] = useState<LifeMapType>("people");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const save = useMutation({
    mutationFn: () => {
      const value = lifeMapSchema.parse({ type, title, description });
      return request(
        editing === "new" ? "/life-map" : `/life-map/${editing}`,
        editing === "new" ? "POST" : "PATCH",
        value,
      );
    },
    onSuccess: () => {
      setEditing(null);
      void refresh();
    },
  });
  const addSuggestion = useMutation({
    mutationFn: (value: LifeMapSuggestion) =>
      request("/life-map/suggestions", "POST", value),
    onSuccess: () => void refresh(),
  });
  const approve = useMutation({
    mutationFn: (id: string) => request(`/life-map/${id}/approve`, "POST"),
    onSuccess: () => void refresh(),
  });
  const remove = useMutation({
    mutationFn: (id: string) => request(`/life-map/${id}`, "DELETE"),
    onSuccess: () => void refresh(),
  });

  const open = (item?: LifeMapItem) => {
    setEditing(item?.id ?? "new");
    setType(item?.type ?? "people");
    setTitle(item?.title ?? "");
    setDescription(item?.description ?? "");
  };

  const visibleSuggestions = suggestions.data?.filter(
    (suggestion) => !dismissed.includes(suggestion.source_id),
  );

  return (
    <ScreenContainer back>
      <MoriText muted variant="small">
        BẢN ĐỒ CUỘC SỐNG
      </MoriText>
      <MoriText variant="hero">Cuộc sống của mình</MoriText>
      <MoriText muted>
        Một nơi riêng tư để giữ những người, giá trị và điều có ý nghĩa với bạn.
        Mori chỉ thêm khi bạn chọn đồng ý.
      </MoriText>
      <MoriButton onPress={() => open()}>Thêm vào bản đồ</MoriButton>
      <ErrorNote
        error={
          items.error ??
          suggestions.error ??
          save.error ??
          addSuggestion.error ??
          approve.error ??
          remove.error
        }
      />
      {(items.isPending || suggestions.isPending) && <Loading />}
      {!!visibleSuggestions?.length && (
        <>
          <SectionHeading title="Mori gợi ý · Bạn quyết định" />
          {visibleSuggestions.map((suggestion) => (
            <MoriCard key={suggestion.source_id}>
              <MoriText muted variant="small">
                {labels[suggestion.type]}
              </MoriText>
              <MoriText translate={false}>{suggestion.title}</MoriText>
              <MoriText muted>{suggestion.description}</MoriText>
              <MoriButton
                loading={addSuggestion.isPending}
                onPress={() => addSuggestion.mutate(suggestion)}
              >
                Thêm
              </MoriButton>
              <MoriButton
                secondary
                onPress={() =>
                  setDismissed((current) => [...current, suggestion.source_id])
                }
              >
                Để sau
              </MoriButton>
            </MoriCard>
          ))}
        </>
      )}
      {LifeMapType.options.map((section) => {
        const sectionItems = items.data?.filter(
          (item) => item.type === section,
        );
        return sectionItems?.length ? (
          <View key={section} style={styles.stack}>
            <SectionHeading title={labels[section]} />
            {sectionItems.map((item) => (
              <MoriCard key={item.id}>
                <MoriText translate={false}>{item.title}</MoriText>
                {!!item.description && (
                  <MoriText muted translate={false}>
                    {item.description}
                  </MoriText>
                )}
                {!item.approved_by_user && (
                  <MoriButton onPress={() => approve.mutate(item.id)}>
                    Cho phép thêm
                  </MoriButton>
                )}
                <MoriButton secondary onPress={() => open(item)}>
                  Chỉnh sửa
                </MoriButton>
                <MoriButton secondary onPress={() => remove.mutate(item.id)}>
                  Xóa
                </MoriButton>
              </MoriCard>
            ))}
          </View>
        ) : null;
      })}
      {items.data?.length === 0 && !visibleSuggestions?.length && (
        <MoriText muted>
          Bản đồ đang để trống. Bạn có thể bắt đầu với một người hoặc một điều
          có ý nghĩa.
        </MoriText>
      )}
      <MoriBottomSheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
      >
        <View style={styles.stack}>
          <MoriText variant="title">Một phần trong cuộc sống của bạn.</MoriText>
          <MoriInput
            accessibilityLabel="Tên mục bản đồ cuộc sống"
            value={title}
            onChangeText={setTitle}
            maxLength={120}
            placeholder="Ví dụ: Mẹ, sự bình yên, khu vườn nhỏ…"
          />
          <MoriInput
            accessibilityLabel="Mô tả mục bản đồ cuộc sống"
            value={description}
            onChangeText={setDescription}
            maxLength={2000}
            multiline
            placeholder="Điều gì khiến mục này có ý nghĩa với bạn?"
          />
          {LifeMapType.options.map((option) => (
            <Choice
              key={option}
              title={labels[option]}
              selected={type === option}
              onPress={() => setType(option)}
            />
          ))}
          <MoriButton
            loading={save.isPending}
            disabled={!title.trim()}
            onPress={() => save.mutate()}
          >
            Lưu vào bản đồ
          </MoriButton>
        </View>
      </MoriBottomSheet>
    </ScreenContainer>
  );
}
