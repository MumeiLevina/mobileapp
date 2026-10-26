import { queryClient } from "./api";
import { supabase } from "./auth";
import { clearUserDeviceData } from "./cleanup";
import { useSession } from "../store/session";

export type SignOutDependencies = {
  clearLocal: (user: string) => Promise<void>;
  signOutRemote: () => Promise<void>;
  clearQueries: () => void;
  setSession: (user: string | null) => void;
  isCurrent?: (user: string) => boolean;
};

const defaults: SignOutDependencies = {
  clearLocal: (user) =>
    clearUserDeviceData(
      user,
      () =>
        !useSession.getState().userId || useSession.getState().userId === user,
    ),
  signOutRemote: async () => {
    const result = await supabase?.auth.signOut();
    if (result?.error) throw result.error;
  },
  clearQueries: () => queryClient.clear(),
  setSession: (user) => useSession.getState().setSession(user),
  isCurrent: (user) => useSession.getState().userId === user,
};

export async function signOutAndClearLocalData(
  user: string,
  dependencies: SignOutDependencies = defaults,
): Promise<void> {
  if (dependencies.isCurrent?.(user) === false)
    throw new Error("Tài khoản đã thay đổi. Hãy mở lại màn hình để tiếp tục.");
  try {
    await dependencies.signOutRemote();
  } catch {
    throw new Error("Chưa đăng xuất được. Hãy thử lại.");
  }

  if (dependencies.isCurrent?.(user) !== false) {
    dependencies.clearQueries();
    dependencies.setSession(null);
  }

  try {
    await dependencies.clearLocal(user);
  } catch {
    throw new Error(
      "Đã đăng xuất nhưng thiết bị chưa dọn xong dữ liệu cục bộ. Hãy đăng nhập lại để thử dọn lần nữa.",
    );
  }
}
