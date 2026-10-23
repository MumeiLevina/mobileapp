import { request } from "../services/api";
import { demoRequest } from "../services/demo";
import { supabase } from "../services/auth";

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
        access_token: "synthetic-token",
        expires_at: Date.now() / 1000 + 3600,
      },
    },
    error: null,
  } as Awaited<ReturnType<NonNullable<typeof supabase>["auth"]["getSession"]>>);
});
afterAll(() => {
  global.fetch = originalFetch;
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
  jest
    .mocked(fetch)
    .mockResolvedValueOnce({
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
