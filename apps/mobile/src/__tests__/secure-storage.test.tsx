import * as SecureStore from "expo-secure-store";
import { privateStorage } from "../lib/storage";

const mockItems = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (key: string) => mockItems.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockItems.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockItems.delete(key);
  }),
}));

beforeEach(() => {
  mockItems.clear();
  jest.clearAllMocks();
});

test("native storage publishes complete encrypted chunks before replacing the manifest", async () => {
  await privateStorage.setItem("draft", "old");
  const oldManifest = JSON.parse(mockItems.get("draft.manifest")!);
  const content = "Tiếng Việt 🌿".repeat(100);
  await privateStorage.setItem("draft", content);
  expect(await privateStorage.getItem("draft")).toBe(content);
  const writes = jest.mocked(SecureStore.setItemAsync).mock.calls;
  const last = writes.at(-1)!;
  expect(last[0]).toBe("draft.manifest");
  const manifest = JSON.parse(last[1]);
  expect(manifest.count).toBeGreaterThan(1);
  expect(mockItems.has(`draft.${oldManifest.version}.0`)).toBe(false);
  expect(mockItems.size).toBe(manifest.count + 1);
});

test("failed native writes preserve the previous complete value and permit retries", async () => {
  await privateStorage.setItem("draft", "keep me");
  jest
    .mocked(SecureStore.setItemAsync)
    .mockRejectedValueOnce(new Error("device locked"));
  await expect(privateStorage.setItem("draft", "replacement")).rejects.toThrow(
    "device locked",
  );
  expect(await privateStorage.getItem("draft")).toBe("keep me");
  expect(mockItems.size).toBe(2);
  await privateStorage.setItem("draft", "retry");
  expect(await privateStorage.getItem("draft")).toBe("retry");
});

test("queued delete follows writes and removes the manifest before its chunks", async () => {
  const write = privateStorage.setItem("ordered", "private".repeat(150));
  const deletion = privateStorage.removeItem("ordered");
  await Promise.all([write, deletion]);
  expect(await privateStorage.getItem("ordered")).toBeNull();
  expect(mockItems.size).toBe(0);
  expect(jest.mocked(SecureStore.deleteItemAsync).mock.calls[0][0]).toBe(
    "ordered.manifest",
  );
});

test("missing encrypted chunks fail visibly rather than returning partial private content", async () => {
  await privateStorage.setItem("draft", "private".repeat(100));
  const manifest = JSON.parse(mockItems.get("draft.manifest")!);
  mockItems.delete(`draft.${manifest.version}.0`);
  await expect(privateStorage.getItem("draft")).rejects.toThrow(
    "Incomplete secure storage item",
  );
});
