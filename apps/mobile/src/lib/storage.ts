import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { newId } from "./id";
type Manifest = { version: string; count: number };
const writes = new Map<string, Promise<void>>();
const manifestKey = (key: string) => `${key}.manifest`;
const chunkKey = (key: string, m: Manifest, i: number) =>
  `${key}.${m.version}.${i}`;
async function readManifest(key: string): Promise<Manifest | null> {
  const value = await SecureStore.getItemAsync(manifestKey(key));
  return value ? (JSON.parse(value) as Manifest) : null;
}
async function removeChunks(key: string, manifest: Manifest | null) {
  if (manifest)
    await Promise.all(
      Array.from({ length: manifest.count }, (_, i) =>
        SecureStore.deleteItemAsync(chunkKey(key, manifest, i)),
      ),
    );
}
function serialize(key: string, action: () => Promise<void>) {
  const next = (writes.get(key) ?? Promise.resolve())
    .catch(() => undefined)
    .then(action);
  writes.set(key, next);
  void next
    .finally(() => {
      if (writes.get(key) === next) writes.delete(key);
    })
    .catch(() => undefined);
  return next;
}
// Publish a versioned manifest only after every encrypted chunk has been written.
// An interrupted edit never replaces the last complete draft with a partial value.
export const privateStorage = {
  async getItem(key: string): Promise<string | null> {
    await writes.get(key);
    if (Platform.OS === "web") return AsyncStorage.getItem(key);
    const manifest = await readManifest(key);
    if (!manifest) return null;
    const chunks = await Promise.all(
      Array.from({ length: manifest.count }, (_, i) =>
        SecureStore.getItemAsync(chunkKey(key, manifest, i)),
      ),
    );
    if (chunks.some((c) => c === null))
      throw new Error("Incomplete secure storage item");
    return chunks.join("");
  },
  setItem(key: string, value: string) {
    return serialize(key, async () => {
      if (Platform.OS === "web") return AsyncStorage.setItem(key, value);
      const old = await readManifest(key);
      const chunks = value.match(/[\s\S]{1,500}/g) ?? [""];
      const manifest = { version: newId(), count: chunks.length };
      try {
        for (let i = 0; i < chunks.length; i++)
          await SecureStore.setItemAsync(chunkKey(key, manifest, i), chunks[i]);
        await SecureStore.setItemAsync(
          manifestKey(key),
          JSON.stringify(manifest),
        );
      } catch (error) {
        await removeChunks(key, manifest);
        throw error;
      }
      await removeChunks(key, old);
    });
  },
  removeItem(key: string) {
    return serialize(key, async () => {
      if (Platform.OS === "web") return AsyncStorage.removeItem(key);
      const old = await readManifest(key);
      await SecureStore.deleteItemAsync(manifestKey(key));
      await removeChunks(key, old);
    });
  },
};
