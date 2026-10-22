import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useDraft } from "../hooks/useDraft";
import { privateStorage } from "../lib/storage";
import { useSession } from "../store/session";

jest.mock("../lib/storage", () => ({
  privateStorage: {
    getItem: jest.fn(),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock("../services/notifications", () => ({
  cancelAllMoriNotifications: jest.fn().mockResolvedValue(undefined),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  useSession.setState({ userId: "draft-user" });
  jest.mocked(privateStorage.getItem).mockResolvedValue(null);
});

test("late hydration cannot overwrite text typed while storage is loading", async () => {
  const read = deferred<string | null>();
  jest.mocked(privateStorage.getItem).mockReturnValueOnce(read.promise);
  const view = await renderHook(() => useDraft("journal"));
  await act(async () => view.result.current.setText("Nội dung mới"));
  await act(async () => read.resolve("Bản nháp cũ"));
  expect(view.result.current.text).toBe("Nội dung mới");
  expect(view.result.current.ready).toBe(true);
});

test("changing draft keys hides the previous draft until the new read finishes", async () => {
  jest.mocked(privateStorage.getItem).mockResolvedValueOnce("Private A");
  const view = await renderHook(
    ({ name }: { name: string }) => useDraft(name),
    {
      initialProps: { name: "a" },
    },
  );
  await waitFor(() => expect(view.result.current.ready).toBe(true));
  const read = deferred<string | null>();
  jest.mocked(privateStorage.getItem).mockReturnValueOnce(read.promise);
  await view.rerender({ name: "b" });
  expect(view.result.current.ready).toBe(false);
  expect(view.result.current.text).toBe("");
  await act(async () => read.resolve("Private B"));
  expect(view.result.current.text).toBe("Private B");
});

test("clear is ordered between earlier and later edits", async () => {
  const write = deferred<void>();
  const operations: string[] = [];
  jest
    .mocked(privateStorage.setItem)
    .mockImplementation(async (_key, value) => {
      operations.push(value);
      if (value === "old") await write.promise;
    });
  jest.mocked(privateStorage.removeItem).mockImplementation(async () => {
    operations.push("delete");
  });
  const view = await renderHook(() => useDraft("ordered"));
  await waitFor(() => expect(view.result.current.ready).toBe(true));
  let clearing!: Promise<void>;
  await act(async () => {
    view.result.current.setText("old");
    clearing = view.result.current.clear();
    view.result.current.setText("new");
  });
  await act(async () => {
    write.resolve();
    await clearing;
  });
  await waitFor(() => expect(operations).toHaveLength(3));
  expect(operations).toEqual(["old", "delete", "new"]);
  expect(view.result.current.text).toBe("new");
});

test("failed deletion preserves editable text and exposes the storage error", async () => {
  jest.mocked(privateStorage.getItem).mockResolvedValueOnce("Keep this draft");
  jest
    .mocked(privateStorage.removeItem)
    .mockRejectedValueOnce(new Error("device locked"));
  const view = await renderHook(() => useDraft("failed-delete"));
  await waitFor(() => expect(view.result.current.ready).toBe(true));
  await act(async () => {
    await expect(view.result.current.clear()).rejects.toThrow("device locked");
  });
  expect(view.result.current.text).toBe("Keep this draft");
  expect(view.result.current.error).toBe(
    "Không xóa được bản nháp trên thiết bị.",
  );
});
