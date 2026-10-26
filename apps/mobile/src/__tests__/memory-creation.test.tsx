import { Memory } from "@mori/shared";
import { demoRequest } from "../services/demo";
import AsyncStorage from "@react-native-async-storage/async-storage";

test("Demo memory retries reuse one memory/source, preserve edits and never resurrect a forgotten memory", async () => {
  await demoRequest("/account", "DELETE");
  const value = {
    content: "Synthetic quiet mornings",
    category: "preference",
    client_id: "12121212-1212-4212-a212-121212121212",
  };
  const first = (await demoRequest("/memories", "POST", value)) as Memory;
  const retry = (await demoRequest("/memories", "POST", value)) as Memory;
  expect(retry.id).toBe(first.id);
  const list = (await demoRequest("/memories", "GET")) as Memory[];
  expect(list).toHaveLength(1);
  expect(list[0].memory_sources).toHaveLength(1);
  expect(list[0].approved_by_user).toBe(true);
  await expect(
    demoRequest("/memories", "POST", {
      ...value,
      content: "Different payload",
    }),
  ).rejects.toThrow();
  await demoRequest(`/memories/${first.id}`, "PATCH", {
    content: "Edited memory",
    category: "preference",
  });
  expect(
    ((await demoRequest("/memories", "POST", value)) as Memory).content,
  ).toBe("Edited memory");
  await demoRequest(`/memories/${first.id}`, "DELETE");
  await expect(demoRequest("/memories", "POST", value)).rejects.toThrow();
  expect(JSON.stringify(await AsyncStorage.getItem("mori-demo"))).not.toContain(
    value.content,
  );
  await demoRequest("/account", "DELETE");
});
