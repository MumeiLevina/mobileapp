import { act, renderHook } from "@testing-library/react-native";
import { useOwnerRequest } from "../hooks/useOwnerRequest";
import { useSession } from "../store/session";
import { request } from "../services/api";

jest.mock("../services/api", () => ({ request: jest.fn() }));
beforeEach(() => {
  jest.clearAllMocks();
  useSession.setState({ userId: "original-owner" });
});

test("private writers pass the captured owner to transport", async () => {
  jest.mocked(request).mockResolvedValue({ ok: true });
  const view = await renderHook(() => useOwnerRequest());
  await expect(
    view.result.current.request("/moods", "POST", { content: "synthetic" }),
  ).resolves.toEqual({ ok: true });
  expect(request).toHaveBeenCalledWith(
    "/moods",
    "POST",
    { content: "synthetic" },
    { owner: "original-owner" },
  );
  await view.unmount();
});

test.each(["switch", "switch-back", "unmount"])(
  "%s invalidates a pending result and subsequent private writes",
  async (event) => {
    let finish!: (value: unknown) => void;
    jest.mocked(request).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const view = await renderHook(() => useOwnerRequest());
    const bound = view.result.current.request;
    const pending = bound("/private-conversations/save", "POST", {
      messages: [],
    });
    // Attach the rejection handler before resolving the deliberately late result.
    const rejected = expect(pending).rejects.toThrow("Tài khoản đã thay đổi");
    if (event === "unmount") await view.unmount();
    else
      await act(async () => {
        useSession.setState({ userId: "next-owner" });
        if (event === "switch-back")
          useSession.setState({ userId: "original-owner" });
      });
    finish({ id: "old-private" });
    await rejected;
    await expect(bound("/memories", "DELETE")).rejects.toThrow(
      "Tài khoản đã thay đổi",
    );
    expect(request).toHaveBeenCalledTimes(1);
    if (event !== "unmount") await view.unmount();
  },
);
