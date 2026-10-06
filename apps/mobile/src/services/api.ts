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
export async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  if (config.demo) return (await demoRequest(path, method, body)) as T;
  const session = await supabase?.auth.getSession();
  const token = session?.data.session?.access_token;
  if (!token) throw new Error("Vui lòng đăng nhập để tiếp tục.");
  try {
    const response = await fetch(`${config.apiUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(90000),
    });
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
