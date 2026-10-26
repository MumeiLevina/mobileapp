import { useCallback, useEffect, useRef } from "react";
import { request as transport } from "../services/api";
import { useSession } from "../store/session";

// A mounted editor keeps its original owner even across token refreshes. A late
// response cannot publish old private state or trigger a follow-up mutation.
export function useOwnerRequest() {
  const owner = useRef(useSession((state) => state.userId)).current;
  const alive = useRef(true);
  const invalidated = useRef(false);
  const isCurrent = useCallback(
    () =>
      alive.current &&
      !invalidated.current &&
      useSession.getState().userId === owner,
    [owner],
  );
  useEffect(() => {
    alive.current = true;
    const unsubscribe = useSession.subscribe((state) => {
      if (state.userId !== owner) invalidated.current = true;
    });
    return () => {
      alive.current = false;
      unsubscribe();
    };
  }, [owner]);
  const request = useCallback(
    async <T>(path: string, method = "GET", body?: unknown) => {
      const assertCurrent = () => {
        if (!isCurrent())
          throw new Error(
            "Tài khoản đã thay đổi. Hãy mở lại màn hình để tiếp tục.",
          );
      };
      assertCurrent();
      const result = await transport<T>(path, method, body, { owner });
      assertCurrent();
      return result;
    },
    [owner, isCurrent],
  );
  return { request, isCurrent, owner };
}
