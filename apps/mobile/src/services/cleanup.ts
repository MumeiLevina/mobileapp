import AsyncStorage from "@react-native-async-storage/async-storage";
import { privateStorage } from "../lib/storage";
import { cancelAllMoriNotifications } from "./notifications";
let queue = Promise.resolve();
const draftGenerations = new Map<string, number>();
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
export class DraftConflictError extends Error {
  constructor() {
    super(
      "Bạn còn một bản nháp nhật ký. Hãy mở và lưu hoặc bỏ bản nháp đó trước.",
    );
  }
}
// Capture before awaiting external work. Cleanup invalidates late results, even
// when it completes before the network response arrives.
export function createDraftIfEmptyWriter(user: string, key: string) {
  const generation = draftGenerations.get(user) ?? 0;
  return (value: string) =>
    enqueue(async () => {
      if (generation !== (draftGenerations.get(user) ?? 0))
        throw new Error("Phiên viết đã kết thúc. Nội dung mới chưa được lưu.");
      if (await privateStorage.getItem(key)) throw new DraftConflictError();
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
export function clearUserDeviceData(
  user: string,
  shouldCancelNotifications = () => true,
) {
  draftGenerations.set(user, (draftGenerations.get(user) ?? 0) + 1);
  return enqueue(async () => {
    const index = `mori-drafts.${user}`;
    const keys = JSON.parse(
      (await AsyncStorage.getItem(index)) ?? "[]",
    ) as string[];
    for (const key of keys) await privateStorage.removeItem(key);
    await AsyncStorage.removeItem(index);
    if (shouldCancelNotifications())
      await cancelAllMoriNotifications(shouldCancelNotifications);
  });
}
