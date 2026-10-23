import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "../store/session";
import { readDraft, removeDraft, writeDraft } from "../services/cleanup";

type DraftStatus = "loading" | "idle" | "saving" | "saved" | "error";
type DraftState = {
  key: string;
  text: string;
  ready: boolean;
  error: string;
  status: DraftStatus;
};

export function useDraft(name: string) {
  const user = useSession((s) => s.userId);
  const key = `mori.${user ?? "guest"}.${name}`;
  const initial: DraftState = {
    key,
    text: "",
    ready: false,
    error: "",
    status: "loading",
  };
  const [state, setState] = useState<DraftState>(initial);
  const scope = useMemo(() => ({ revision: 0, active: true }), [key]);
  const retryAction = useRef<() => Promise<void>>(async () => undefined);

  const load = useCallback(async () => {
    const revision = scope.revision;
    setState((current) => ({ ...current, key, error: "", status: "loading" }));
    try {
      const value = await readDraft(key);
      if (scope.active && scope.revision === revision)
        setState({
          key,
          text: value ?? "",
          ready: true,
          error: "",
          status: value ? "saved" : "idle",
        });
      else if (scope.active)
        setState((current) => ({ ...current, ready: true }));
    } catch (error) {
      if (scope.active && scope.revision === revision)
        setState((current) => ({
          ...current,
          error: "Không đọc được bản nháp trên thiết bị.",
          status: "error",
        }));
      throw error;
    }
  }, [key, scope]);

  useEffect(() => {
    scope.active = true;
    setState({ key, text: "", ready: false, error: "", status: "loading" });
    retryAction.current = load;
    void load().catch(() => undefined);
    return () => {
      scope.active = false;
    };
  }, [key, scope, load]);

  const persist = useCallback(
    function writeValue(value: string): Promise<void> {
      const revision = ++scope.revision;
      setState((current) => ({
        ...current,
        key,
        text: value,
        error: "",
        status: "saving",
      }));
      const write = writeDraft(user ?? "guest", key, value);
      retryAction.current = () => writeValue(value);
      void write.then(
        () => {
          if (scope.active && scope.revision === revision)
            setState((current) => ({
              ...current,
              ready: true,
              error: "",
              status: "saved",
            }));
        },
        () => {
          if (scope.active && scope.revision === revision)
            setState((current) => ({
              ...current,
              error:
                "Chưa lưu được bản nháp trên thiết bị. Hãy giữ màn hình này mở.",
              status: "error",
            }));
        },
      );
      return write;
    },
    [key, user, scope],
  );

  const update = useCallback(
    (value: string) => {
      void persist(value).catch(() => undefined);
    },
    [persist],
  );
  const clear = useCallback(
    async function deleteValue(): Promise<void> {
      const revision = ++scope.revision;
      setState((current) => ({ ...current, error: "", status: "saving" }));
      const deletion = removeDraft(key);
      retryAction.current = deleteValue;
      try {
        await deletion;
        if (scope.active && scope.revision === revision)
          setState((current) => ({
            ...current,
            text: "",
            error: "",
            status: "idle",
          }));
      } catch (error) {
        if (scope.active && scope.revision === revision)
          setState((current) => ({
            ...current,
            error: "Không xóa được bản nháp trên thiết bị.",
            status: "error",
          }));
        throw error;
      }
    },
    [key, scope],
  );
  const current = state.key === key ? state : initial;
  return {
    text: current.text,
    ready: current.ready,
    error: current.error,
    status: current.status,
    setText: update,
    persist,
    clear,
    retry: () => retryAction.current(),
  };
}
