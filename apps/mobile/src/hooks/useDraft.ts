import { useCallback, useEffect, useRef, useState } from "react";
import { privateStorage } from "../lib/storage";
import { useSession } from "../store/session";
import { registerDraft } from "../services/cleanup";
export function useDraft(name: string) {
  const user = useSession((s) => s.userId);
  const key = `mori.${user ?? "guest"}.${name}`;
  const [text, setText] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(Promise.resolve());
  useEffect(() => {
    let alive = true;
    privateStorage
      .getItem(key)
      .then((value) => {
        if (alive) {
          setText(value ?? "");
          setReady(true);
        }
      })
      .catch(() => {
        if (alive) {
          setError("Không đọc được bản nháp trên thiết bị.");
          setReady(true);
        }
      });
    return () => {
      alive = false;
    };
  }, [key]);
  const update = useCallback(
    (value: string) => {
      setText(value);
      pending.current = pending.current
        .then(async () => {
          await registerDraft(user ?? "guest", key);
          await privateStorage.setItem(key, value);
        })
        .catch(() =>
          setError(
            "Chưa lưu được bản nháp trên thiết bị. Hãy giữ màn hình này mở.",
          ),
        );
    },
    [key, user],
  );
  const clear = useCallback(async () => {
    await pending.current;
    await privateStorage.removeItem(key);
    setText("");
  }, [key]);
  return { text, setText: update, ready, error, clear };
}
