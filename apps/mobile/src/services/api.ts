import { QueryClient } from "@tanstack/react-query";
import { config } from "../lib/config";
import { supabase } from "./auth";
import { demoRequest } from "./demo";
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
    mutations: { retry: 0 },
  },
});

async function accessToken(forceRefresh = false) {
  if (!supabase) throw new Error("Vui lòng đăng nhập để tiếp tục.");
  const { data, error } = forceRefresh
    ? await supabase.auth.refreshSession()
    : await supabase.auth.getSession();
  if (error)
    throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  const session = data.session;
  if (!session) throw new Error("Vui lòng đăng nhập để tiếp tục.");
  const expiresSoon = (session.expires_at ?? 0) * 1000 <= Date.now() + 30_000;
  if (expiresSoon && !forceRefresh) return accessToken(true);
  return session.access_token;
}

function apiFetch(path: string, method: string, body: unknown, token: string) {
  return fetch(`${config.apiUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(90000),
  });
}

export async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  if (config.demo) return (await demoRequest(path, method, body)) as T;
  try {
    let response = await apiFetch(path, method, body, await accessToken());
    if (response.status === 401)
      response = await apiFetch(path, method, body, await accessToken(true));
    if (!response.ok)
      throw new Error(
        response.status === 401
          ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
          : "Mình gặp một chút trục trặc. Bạn có thể thử lại sau một lát.",
      );
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof TypeError)
      throw new Error(
        "Chưa kết nối được. Nội dung bạn đang viết vẫn được giữ lại.",
      );
    throw error;
  }
}
export const refresh = () => queryClient.invalidateQueries();
