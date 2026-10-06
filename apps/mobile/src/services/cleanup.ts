import AsyncStorage from "@react-native-async-storage/async-storage";
import { privateStorage } from "../lib/storage";
import { scheduleReminder } from "./notifications";
let queue = Promise.resolve();
export function registerDraft(user: string, key: string) {
  queue = queue.then(async () => {
    const index = `mori-drafts.${user}`;
    const keys = JSON.parse(
      (await AsyncStorage.getItem(index)) ?? "[]",
    ) as string[];
    if (!keys.includes(key))
      await AsyncStorage.setItem(index, JSON.stringify([...keys, key]));
  });
  return queue;
}
export async function clearUserDeviceData(user: string) {
  await queue;
  const index = `mori-drafts.${user}`;
  const keys = JSON.parse(
    (await AsyncStorage.getItem(index)) ?? "[]",
  ) as string[];
  for (const key of keys) await privateStorage.removeItem(key);
  await AsyncStorage.removeItem(index);
  await scheduleReminder({
    period: "off",
    hour: 20,
    minute: 0,
    timezone: "Asia/Ho_Chi_Minh",
  });
}
