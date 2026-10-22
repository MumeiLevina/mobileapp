import { act, renderHook, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { useDraft } from "../hooks/useDraft";
import { privateStorage } from "../lib/storage";
import { clearUserDeviceData } from "../services/cleanup";
import { useSession } from "../store/session";

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
jest.mock("../services/notifications", () => ({
  cancelAllMoriNotifications: jest.fn().mockResolvedValue(undefined),
}));

test("account cleanup drains queued draft edits before removing encrypted data and its index", async () => {
  await AsyncStorage.clear();
  useSession.setState({ userId: "cleanup-user" });
  const view = await renderHook(() => useDraft("journal"));
  await waitFor(() => expect(view.result.current.ready).toBe(true));
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  jest
    .mocked(SecureStore.setItemAsync)
    .mockImplementationOnce(async (key, value) => {
      await blocked;
      mockItems.set(key, value);
    });
  await act(async () => {
    view.result.current.setText("first private edit");
    view.result.current.setText("second private edit");
  });
  await waitFor(() => expect(SecureStore.setItemAsync).toHaveBeenCalled());
  const cleanup = clearUserDeviceData("cleanup-user");
  // Logout unmounts the editor while encrypted writes may still be in flight.
  await view.unmount();
  await act(async () => {
    release();
    await cleanup;
  });
  await waitFor(() =>
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(4),
  );
  expect(await privateStorage.getItem("mori.cleanup-user.journal")).toBeNull();
  expect(await AsyncStorage.getItem("mori-drafts.cleanup-user")).toBeNull();
  expect(mockItems.size).toBe(0);
});

test("a remounted editor waits for every edit queued by the previous instance", async () => {
  useSession.setState({ userId: "remount-user" });
  await privateStorage.setItem("mori.remount-user.journal", "old");
  const first = await renderHook(() => useDraft("journal"));
  await waitFor(() => expect(first.result.current.ready).toBe(true));
  let releaseFirst!: () => void;
  let releaseSecond!: () => void;
  const gateFirst = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const gateSecond = new Promise<void>((resolve) => {
    releaseSecond = resolve;
  });
  jest
    .mocked(SecureStore.setItemAsync)
    .mockImplementation(async (key, value) => {
      if (value === "new1") await gateFirst;
      if (value === "new2") await gateSecond;
      mockItems.set(key, value);
    });
  await act(async () => {
    first.result.current.setText("new1");
    first.result.current.setText("new2");
  });
  await first.unmount();
  const second = await renderHook(() => useDraft("journal"));
  await act(async () => releaseFirst());
  expect(second.result.current.ready).toBe(false);
  await act(async () => releaseSecond());
  await waitFor(() => expect(second.result.current.ready).toBe(true));
  expect(second.result.current.text).toBe("new2");
});
