import { config } from "../lib/config";
import { useSession } from "../store/session";
import { queryClient, request } from "./api";
import { supabase } from "./auth";
import { clearUserDeviceData } from "./cleanup";

export type AccountDeletionDependencies = {
  deleteRemote: () => Promise<unknown>;
  clearLocal: (user: string) => Promise<void>;
  signOutLocal: () => Promise<void>;
  clearQueries: () => void;
  setSession: (user: string | null) => void;
  demo: boolean;
};

const defaults: AccountDeletionDependencies = {
  deleteRemote: () => request("/account", "DELETE"),
  clearLocal: clearUserDeviceData,
  signOutLocal: async () => {
    const result = await supabase?.auth.signOut({ scope: "local" });
    if (result?.error) throw result.error;
  },
  clearQueries: () => queryClient.clear(),
  setSession: (user) => useSession.getState().setSession(user),
  demo: config.demo,
};

export async function deleteAccountAndLocalData(
  user: string,
  dependencies: AccountDeletionDependencies = defaults,
): Promise<void> {
  await dependencies.deleteRemote();
  const tasks = [dependencies.clearLocal(user)];
  if (!dependencies.demo) tasks.push(dependencies.signOutLocal());
  const results = await Promise.allSettled(tasks);

  dependencies.clearQueries();
  dependencies.setSession(dependencies.demo ? "demo" : null);

  if (results.some((result) => result.status === "rejected"))
    throw new Error(
      "Tài khoản đã được xóa nhưng thiết bị chưa dọn xong dữ liệu cục bộ.",
    );
}
