import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearUserDeviceData, registerDraft } from "../services/cleanup";
import { privateStorage } from "../lib/storage";
import { cancelAllMoriNotifications } from "../services/notifications";

jest.mock("../lib/storage", () => ({
  privateStorage: { removeItem: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock("../services/notifications", () => ({
  cancelAllMoriNotifications: jest.fn().mockResolvedValue(undefined),
}));

test("a failed draft registration does not poison later writes or cleanup", async () => {
  jest
    .mocked(AsyncStorage.setItem)
    .mockRejectedValueOnce(new Error("disk unavailable"));
  await expect(registerDraft("user", "failed")).rejects.toThrow(
    "disk unavailable",
  );
  await expect(registerDraft("user", "draft")).resolves.toBeUndefined();
  await clearUserDeviceData("user");
  expect(privateStorage.removeItem).toHaveBeenCalledWith("draft");
  expect(await AsyncStorage.getItem("mori-drafts.user")).toBeNull();
  expect(cancelAllMoriNotifications).toHaveBeenCalledTimes(1);
});
