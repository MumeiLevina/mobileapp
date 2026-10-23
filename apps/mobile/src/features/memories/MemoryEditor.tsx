import { useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useMutation } from "@tanstack/react-query";
import { Memory, MemoryCategory, memorySchema } from "@mori/shared";
import {
  Choice,
  ErrorNote,
  MoriBottomSheet,
  MoriButton,
  MoriInput,
  MoriText,
  styles,
} from "../../components/ui";
import { request, refresh } from "../../services/api";
import { useSession } from "../../store/session";

export const memoryLabels: Record<MemoryCategory, string> = {
  preference: "Sở thích",
  life_event: "Điều đang diễn ra",
  relationship: "Mối quan hệ",
  goal: "Điều bạn hướng tới",
  self_care_preference: "Cách chăm sóc mình",
  communication_preference: "Cách trò chuyện",
};

export function MemoryEditor({
  memory,
  knownIds,
  onClose,
}: {
  memory: Memory | null;
  knownIds: string[];
  onClose: () => void;
}) {
  const owner = useSession((s) => s.userId);
  const navigation = useNavigation();
  const [targetId, setTargetId] = useState(memory?.id ?? "new");
  const [content, setContent] = useState(memory?.content ?? "");
  const [category, setCategory] = useState<MemoryCategory>(
    memory?.category ?? "preference",
  );
  const [baseline, setBaseline] = useState({ content, category });
  const [confirmedUpdate, setConfirmedUpdate] = useState<string | null>(null);
  const [uncertainCreate, setUncertainCreate] = useState(false);
  const [candidates, setCandidates] = useState<Memory[] | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [closing, setClosing] = useState(false);
  const lock = useRef(false);
  const alive = useRef(true);
  const pendingNavigation = useRef<(() => void) | null>(null);
  const attempted = useRef({ content, category });
  const initialIds = useRef(new Set(knownIds));
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  function assertCurrent() {
    if (!alive.current || useSession.getState().userId !== owner)
      throw new Error("Phiên chỉnh sửa đã kết thúc.");
  }
  const save = useMutation({
    networkMode: "always",
    mutationFn: async () => {
      const parsed = memorySchema.safeParse({ content, category });
      if (!parsed.success) throw new Error("Hãy nhập điều bạn muốn ghi nhớ.");
      assertCurrent();
      const value = parsed.data;
      if (targetId === "new") {
        if (uncertainCreate)
          throw new Error("Hãy kiểm tra kết quả lưu trước khi tạo lại ký ức.");
        attempted.current = value;
        try {
          await request("/memories", "POST", value, { owner });
        } catch (error) {
          if (alive.current) setUncertainCreate(true);
          throw error;
        }
        assertCurrent();
        return;
      }
      const snapshot = JSON.stringify(value);
      if (confirmedUpdate !== snapshot) {
        await request(`/memories/${targetId}`, "PATCH", value, { owner });
        assertCurrent();
        setConfirmedUpdate(snapshot);
        setBaseline(value);
      }
      // An acknowledged update is not an acknowledged approval. Retrying this
      // phase does not submit the same edit a second time.
      await request(`/memories/${targetId}/approve`, "POST", undefined, {
        owner,
      });
      assertCurrent();
    },
    onSuccess: () => {
      void refresh();
      setClosing(true);
    },
    onSettled: () => {
      lock.current = false;
    },
  });
  const check = useMutation({
    networkMode: "always",
    mutationFn: () =>
      request<Memory[]>("/memories", "GET", undefined, { owner }),
    onSuccess: (items) => {
      if (alive.current && useSession.getState().userId === owner)
        setCandidates(
          items.filter(
            (item) =>
              !initialIds.current.has(item.id) &&
              item.content === attempted.current.content &&
              item.category === attempted.current.category,
          ),
        );
    },
  });
  const dirty = content !== baseline.content || category !== baseline.category;
  const blocked =
    !closing &&
    (dirty || save.isPending || !!confirmedUpdate || uncertainCreate);
  usePreventRemove(blocked, ({ data }) => {
    if (lock.current) return;
    pendingNavigation.current = () => navigation.dispatch(data.action);
    setConfirmLeave(true);
  });
  useEffect(() => {
    if (Platform.OS !== "web" || !blocked) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [blocked]);
  useEffect(() => {
    if (!closing) return;
    const action = pendingNavigation.current;
    pendingNavigation.current = null;
    action?.();
    onClose();
  }, [closing, onClose]);
  function close() {
    if (lock.current || check.isPending) return;
    if (blocked) setConfirmLeave(true);
    else onClose();
  }
  function submit() {
    if (lock.current || uncertainCreate || check.isPending) return;
    lock.current = true;
    save.mutate();
  }
  const busy = save.isPending || check.isPending;
  return (
    <MoriBottomSheet visible onClose={close} avoidKeyboard>
      <View style={styles.stack}>
        <MoriText variant="title">
          {confirmLeave
            ? "Bạn còn thay đổi đang mở."
            : "Điều bạn muốn giữ lại."}
        </MoriText>
        <MoriText muted variant="small">
          Chỉnh sửa chỉ nằm trong màn hình này cho đến khi bạn chọn lưu. Không
          tự lưu bản nháp ký ức trên thiết bị.
        </MoriText>
        {!!confirmedUpdate && (
          <MoriText accessibilityLiveRegion="polite">
            Nội dung đã được cập nhật trên máy chủ. Chưa xác nhận xong bước cho
            phép ghi nhớ; quyền đã cấp trước đó không bị thu hồi.
          </MoriText>
        )}
        {uncertainCreate && (
          <MoriText accessibilityLiveRegion="polite">
            Chưa xác nhận được ký ức đã tạo hay chưa. Để tránh tạo trùng, hãy
            kiểm tra danh sách; nội dung đang nhập vẫn ở đây.
          </MoriText>
        )}
        {confirmLeave && (
          <MoriText muted>
            Bỏ chỉnh sửa chỉ xóa phần chưa gửi trên màn hình. Không hoàn tác dữ
            liệu đã được máy chủ lưu.
          </MoriText>
        )}
        {!confirmLeave && (
          <>
            <MoriInput
              accessibilityLabel="Nội dung ký ức"
              value={content}
              onChangeText={(value) => {
                if (!lock.current && !uncertainCreate) setContent(value);
              }}
              editable={!busy && !uncertainCreate}
              multiline
              maxLength={600}
              placeholder="Ví dụ: Mình thích nghe tiếng mưa."
            />
            {MemoryCategory.options.map((cat) => (
              <Choice
                key={cat}
                title={memoryLabels[cat]}
                selected={cat === category}
                disabled={busy || uncertainCreate}
                onPress={() => {
                  if (!lock.current && !uncertainCreate) setCategory(cat);
                }}
              />
            ))}
          </>
        )}
        <ErrorNote error={save.error ?? check.error} />
        {uncertainCreate && (
          <>
            <MoriButton
              secondary
              loading={check.isPending}
              disabled={save.isPending}
              onPress={() => check.mutate()}
            >
              Kiểm tra kết quả lưu
            </MoriButton>
            {candidates?.length === 0 && (
              <MoriText muted>
                Chưa tìm thấy ký ức khớp. Bạn có thể kiểm tra lại; chưa có yêu
                cầu tạo mới nào được gửi thêm.
              </MoriText>
            )}
            {candidates?.map((item) => (
              <MoriButton
                key={item.id}
                secondary
                disabled={busy}
                onPress={() => {
                  setTargetId(item.id);
                  setContent(item.content);
                  setCategory(item.category);
                  setBaseline({
                    content: item.content,
                    category: item.category,
                  });
                  setUncertainCreate(false);
                  setCandidates(null);
                  setConfirmLeave(false);
                  pendingNavigation.current = null;
                  save.reset();
                }}
              >
                Mở ký ức tìm thấy
              </MoriButton>
            ))}
          </>
        )}
        <MoriButton
          loading={save.isPending}
          loadingLabel="Đang lưu ký ức…"
          disabled={uncertainCreate || check.isPending}
          onPress={submit}
        >
          Lưu và cho phép ghi nhớ
        </MoriButton>
        {confirmLeave && (
          <MoriButton
            secondary
            disabled={busy}
            onPress={() => {
              setConfirmLeave(false);
              pendingNavigation.current = null;
            }}
          >
            Tiếp tục chỉnh sửa
          </MoriButton>
        )}
        {confirmLeave ? (
          <MoriButton
            variant="dangerGhost"
            disabled={busy}
            onPress={() => setClosing(true)}
          >
            Bỏ chỉnh sửa
          </MoriButton>
        ) : (
          <MoriButton variant="ghost" disabled={busy} onPress={close}>
            Đóng trình chỉnh sửa
          </MoriButton>
        )}
      </View>
    </MoriBottomSheet>
  );
}
