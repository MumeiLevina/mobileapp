import AsyncStorage from "@react-native-async-storage/async-storage";
import { demoRequest } from "../services/demo";

test("a lost response retried with the same client ID creates one exchange", async () => {
  await AsyncStorage.clear();
  const conversation = (await demoRequest("/conversations", "POST", {
    mode: "listen",
  })) as { id: string };
  const body = {
    content: "Hôm nay mình hơi mệt.",
    mode: "listen",
    client_id: "77777777-7777-4777-a777-777777777777",
  };

  const first = await demoRequest(
    `/conversations/${conversation.id}/messages`,
    "POST",
    body,
  );
  const retry = await demoRequest(
    `/conversations/${conversation.id}/messages`,
    "POST",
    body,
  );
  const result = (await demoRequest(
    `/conversations/${conversation.id}`,
    "GET",
  )) as { messages: { role: string; client_id: string }[] };

  expect(retry).toEqual(first);
  expect(result.messages).toHaveLength(2);
  expect(result.messages.map((message) => message.role)).toEqual([
    "user",
    "assistant",
  ]);
  expect(
    result.messages.every((message) => message.client_id === body.client_id),
  ).toBe(true);
});
