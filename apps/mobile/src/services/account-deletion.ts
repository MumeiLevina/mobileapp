import { config } from "../lib/config";
import { useSession } from "../store/session";
import { queryClient, request } from "./api";
import { supabase } from "./auth";
import { clearUserDeviceData } from "./cleanup";

export type AccountDeletionDependencies = {
  deleteRemote: (user: string) => Promise<unknown>;
  clearLocal: (user: string) => Promise<void>;
  signOutLocal: () => Promise<void>;
  clearQueries: () => void;
  setSession: (user: string | null) => void;
  demo: boolean;
  isCurrent?: (user: string) => boolean;
};

const defaults: AccountDeletionDependencies = {
  deleteRemote: (user) =>
    request("/account", "DELETE", undefined, { owner: user }),
  clearLocal: (user) =>
    clearUserDeviceData(
      user,
      () =>
        !useSession.getState().userId || useSession.getState().userId === user,
    ),
  signOutLocal: async () => {
    const result = await supabase?.auth.signOut({ scope: "local" });
    if (result?.error) throw result.error;
  },
  clearQueries: () => queryClient.clear(),
  setSession: (user) => useSession.getState().setSession(user),
  demo: config.demo,
  isCurrent: (user) => useSession.getState().userId === user,
};

export async function deleteAccountAndLocalData(
  user: string,
  dependencies: AccountDeletionDependencies = defaults,
): Promise<void> {
  if (dependencies.isCurrent?.(user) === false)
    throw new Error("Tài khoản đã thay đổi. Hãy mở lại màn hình để tiếp tục.");
  await dependencies.deleteRemote(user);
  const tasks = [dependencies.clearLocal(user)];
  if (!dependencies.demo && dependencies.isCurrent?.(user) !== false)
    tasks.push(dependencies.signOutLocal());
  const results = await Promise.allSettled(tasks);

  if (dependencies.isCurrent?.(user) !== false) {
    dependencies.clearQueries();
    dependencies.setSession(dependencies.demo ? "demo" : null);
  }

  if (results.some((result) => result.status === "rejected"))
    throw new Error(
      "Tài khoản đã được xóa nhưng thiết bị chưa dọn xong dữ liệu cục bộ.",
    );
}
