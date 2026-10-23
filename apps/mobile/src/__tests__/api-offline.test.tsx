import { request, queryClient } from "../services/api";
import { onlineManager } from "@tanstack/react-query";
import { demoRequest } from "../services/demo";
import { supabase } from "../services/auth";
import type { Session, User } from "@supabase/supabase-js";

jest.mock("../lib/config", () => ({
  config: { demo: false, apiUrl: "https://api.invalid" },
}));
jest.mock("../services/demo", () => ({ demoRequest: jest.fn() }));
jest.mock("../services/auth", () => ({
  supabase: { auth: { getSession: jest.fn(), refreshSession: jest.fn() } },
}));

const originalFetch = global.fetch;
beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
  jest.mocked(supabase!.auth.getSession).mockResolvedValue({
    data: {
      session: {
        user: { id: "transport-owner" },
        access_token: "synthetic-token",
        expires_at: Date.now() / 1000 + 3600,
      },
    },
    error: null,
  } as Awaited<ReturnType<NonNullable<typeof supabase>["auth"]["getSession"]>>);
});

function sessionFor(owner: string, expiresAt = Date.now() / 1000 + 3600) {
  const user: User = {
    id: owner,
    aud: "authenticated",
    created_at: "2026-10-23T00:00:00Z",
    app_metadata: {},
    user_metadata: {},
  };
  const session: Session = {
    user,
    access_token: "synthetic-owner-token",
    refresh_token: "synthetic-refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expiresAt,
  };
  return { data: { user, session }, error: null };
}

test("an owner-bound write cannot send old private content using another account's session", async () => {
  jest
    .mocked(supabase!.auth.getSession)
    .mockResolvedValueOnce(sessionFor("next-owner"));
  await expect(
    request(
      "/memories",
      "POST",
      { content: "Synthetic previous-owner text" },
      { owner: "transport-owner" },
    ),
  ).rejects.toThrow("Tài khoản đã thay đổi");
  expect(fetch).not.toHaveBeenCalled();
  expect(demoRequest).not.toHaveBeenCalled();
});

test("a 401 retry cannot replay private content after token refresh changes owners", async () => {
  jest
    .mocked(fetch)
    .mockResolvedValueOnce({ status: 401, ok: false } as Response);
  jest
    .mocked(supabase!.auth.refreshSession)
    .mockResolvedValueOnce(sessionFor("next-owner"));
  await expect(
    request(
      "/journals",
      "POST",
      { content: "Synthetic draft" },
      { owner: "transport-owner" },
    ),
  ).rejects.toThrow("Tài khoản đã thay đổi");
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(demoRequest).not.toHaveBeenCalled();
});

test("pre-request expiry refresh retains the required owner boundary", async () => {
  jest
    .mocked(supabase!.auth.getSession)
    .mockResolvedValueOnce(sessionFor("transport-owner", 1));
  jest
    .mocked(supabase!.auth.refreshSession)
    .mockResolvedValueOnce(sessionFor("next-owner"));
  await expect(
    request(
      "/letters",
      "POST",
      { content: "Synthetic letter" },
      { owner: "transport-owner" },
    ),
  ).rejects.toThrow("Tài khoản đã thay đổi");
  expect(fetch).not.toHaveBeenCalled();
});

test("a matching owner can still save normally without an extra request", async () => {
  jest.mocked(fetch).mockResolvedValueOnce({
    status: 200,
    ok: true,
    json: async () => ({ ok: true }),
  } as Response);
  await expect(
    request(
      "/memories",
      "POST",
      { content: "Synthetic own text" },
      { owner: "transport-owner" },
    ),
  ).resolves.toEqual({ ok: true });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(
    JSON.parse(jest.mocked(fetch).mock.calls[0][1]!.body as string),
  ).toEqual({ content: "Synthetic own text" });
});
afterAll(() => {
  global.fetch = originalFetch;
});
afterEach(() => {
  onlineManager.setOnline(true);
  queryClient.clear();
});

test("the app mutation defaults fail offline instead of queueing a write for reconnect", async () => {
  onlineManager.setOnline(false);
  const write = jest.fn().mockRejectedValue(new Error("Offline write"));
  const mutation = queryClient
    .getMutationCache()
    .build(queryClient, { mutationFn: write, gcTime: Infinity });
  await expect(mutation.execute(undefined)).rejects.toThrow("Offline write");
  expect(write).toHaveBeenCalledTimes(1);
  onlineManager.setOnline(true);
  await Promise.resolve();
  expect(write).toHaveBeenCalledTimes(1);
});

test.each(["AbortError", "TimeoutError", "TypeError", "SyntaxError"])(
  "%s stays connected-mode, is localized, and never retries a POST silently",
  async (name) => {
    const error =
      name === "TypeError"
        ? new TypeError("raw-network-detail")
        : name === "SyntaxError"
          ? new SyntaxError("raw-parser-detail")
          : Object.assign(new Error("raw-timeout-detail"), { name });
    jest.mocked(fetch).mockRejectedValueOnce(error);
    await expect(
      request("/journals", "POST", { client_id: "synthetic-id" }),
    ).rejects.toThrow("thử lại");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(demoRequest).not.toHaveBeenCalled();
  },
);

test("an HTTP outage cannot display raw server content or use simulated AI", async () => {
  const json = jest.fn();
  jest.mocked(fetch).mockResolvedValueOnce({
    ok: false,
    status: 503,
    json,
  } as unknown as Response);
  await expect(
    request("/private-conversations/messages", "POST", {}),
  ).rejects.toThrow("trục trặc");
  expect(json).not.toHaveBeenCalled();
  expect(demoRequest).not.toHaveBeenCalled();
});
