import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "../store/session";
import { readDraft, removeDraft, writeDraft } from "../services/cleanup";
export function useDraft(name: string) {
  const user = useSession((s) => s.userId);
  const key = `mori.${user ?? "guest"}.${name}`;
  const [state, setState] = useState({
    key,
    text: "",
    ready: false,
    error: "",
  });
  const scope = useMemo(() => ({ revision: 0, active: true }), [key]);
  const pending = useRef(Promise.resolve());
  useEffect(() => {
    let alive = true;
    scope.active = true;
    const revision = scope.revision;
    setState((current) =>
      current.key === key
        ? current
        : { key, text: "", ready: false, error: "" },
    );
    pending.current
      .then(() => readDraft(key))
      .then((value) => {
        if (alive) {
          setState((current) => ({
            ...current,
            ready: true,
            text: scope.revision === revision ? (value ?? "") : current.text,
          }));
        }
      })
      .catch(() => {
        if (alive) {
          setState((current) => ({
            ...current,
            ready: true,
            error: "Không đọc được bản nháp trên thiết bị.",
          }));
        }
      });
    return () => {
      alive = false;
      scope.active = false;
    };
  }, [key, scope]);
  const update = useCallback(
    (value: string) => {
      scope.revision++;
      setState((current) => ({ ...current, key, text: value }));
      pending.current = writeDraft(user ?? "guest", key, value).catch(() => {
        if (scope.active)
          setState((current) => ({
            ...current,
            error:
              "Chưa lưu được bản nháp trên thiết bị. Hãy giữ màn hình này mở.",
          }));
      });
    },
    [key, user, scope],
  );
  const clear = useCallback(async () => {
    const revision = ++scope.revision;
    const deletion = removeDraft(key).then(() => {
      if (scope.active && scope.revision === revision)
        setState((current) => ({ ...current, text: "" }));
    });
    pending.current = deletion.catch(() => {
      if (scope.active)
        setState((current) => ({
          ...current,
          error: "Không xóa được bản nháp trên thiết bị.",
        }));
    });
    await deletion;
  }, [key, scope]);
  const current =
    state.key === key ? state : { text: "", ready: false, error: "" };
  return {
    text: current.text,
    ready: current.ready,
    error: current.error,
    setText: update,
    clear,
  };
}
