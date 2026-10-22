import AsyncStorage from "@react-native-async-storage/async-storage";
import { privateStorage } from "../lib/storage";
import { cancelAllMoriNotifications } from "./notifications";
let queue = Promise.resolve();
function enqueue(action: () => Promise<void>) {
  queue = queue.catch(() => undefined).then(action);
  return queue;
}
async function rememberDraft(user: string, key: string) {
  const index = `mori-drafts.${user}`;
  const keys = JSON.parse(
    (await AsyncStorage.getItem(index)) ?? "[]",
  ) as string[];
  if (!keys.includes(key))
    await AsyncStorage.setItem(index, JSON.stringify([...keys, key]));
}
export function registerDraft(user: string, key: string) {
  return enqueue(() => rememberDraft(user, key));
}
// Enqueue the entire write immediately. Cleanup must wait for encrypted data,
// including edits queued by an editor that has already unmounted.
export function writeDraft(user: string, key: string, value: string) {
  return enqueue(async () => {
    await rememberDraft(user, key);
    await privateStorage.setItem(key, value);
  });
}
export function removeDraft(key: string) {
  return enqueue(() => privateStorage.removeItem(key));
}
export async function readDraft(key: string) {
  // A remounted editor has no reference to the previous hook's pending writes.
  // Wait for those writes before restoring the last complete draft.
  await queue.catch(() => undefined);
  return privateStorage.getItem(key);
}
export function clearUserDeviceData(user: string) {
  return enqueue(async () => {
    const index = `mori-drafts.${user}`;
    const keys = JSON.parse(
      (await AsyncStorage.getItem(index)) ?? "[]",
    ) as string[];
    for (const key of keys) await privateStorage.removeItem(key);
    await AsyncStorage.removeItem(index);
    await cancelAllMoriNotifications();
  });
}
