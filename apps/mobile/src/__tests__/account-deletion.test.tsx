import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AccountDeletionDependencies,
  deleteAccountAndLocalData,
} from "../services/account-deletion";
import { clearUserDeviceData, registerDraft } from "../services/cleanup";
import { privateStorage } from "../lib/storage";
import { cancelAllMoriNotifications } from "../services/notifications";

jest.mock("../lib/storage", () => ({
  privateStorage: { removeItem: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock("../services/notifications", () => ({
  cancelAllMoriNotifications: jest.fn().mockResolvedValue(undefined),
}));

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

test("device cleanup removes registered drafts and cancels reminders", async () => {
  await registerDraft("owner", "mori.owner.journal.new");
  await registerDraft("owner", "mori.owner.chat.one");

  await clearUserDeviceData("owner");

  expect(privateStorage.removeItem).toHaveBeenCalledWith(
    "mori.owner.journal.new",
  );
  expect(privateStorage.removeItem).toHaveBeenCalledWith("mori.owner.chat.one");
  expect(await AsyncStorage.getItem("mori-drafts.owner")).toBeNull();
  expect(cancelAllMoriNotifications).toHaveBeenCalledTimes(1);
});

test("account deletion clears local data, local auth, cache and session", async () => {
  const dependencies: AccountDeletionDependencies = {
    deleteRemote: jest.fn().mockResolvedValue(undefined),
    clearLocal: jest.fn().mockResolvedValue(undefined),
    signOutLocal: jest.fn().mockResolvedValue(undefined),
    clearQueries: jest.fn(),
    setSession: jest.fn(),
    demo: false,
  };

  await deleteAccountAndLocalData("owner", dependencies);

  expect(dependencies.deleteRemote).toHaveBeenCalledTimes(1);
  expect(dependencies.clearLocal).toHaveBeenCalledWith("owner");
  expect(dependencies.signOutLocal).toHaveBeenCalledTimes(1);
  expect(dependencies.clearQueries).toHaveBeenCalledTimes(1);
  expect(dependencies.setSession).toHaveBeenCalledWith(null);
});

test("local cleanup failure still logs out and clears session", async () => {
  const dependencies: AccountDeletionDependencies = {
    deleteRemote: jest.fn().mockResolvedValue(undefined),
    clearLocal: jest.fn().mockRejectedValue(new Error("storage unavailable")),
    signOutLocal: jest.fn().mockResolvedValue(undefined),
    clearQueries: jest.fn(),
    setSession: jest.fn(),
    demo: false,
  };

  await expect(
    deleteAccountAndLocalData("owner", dependencies),
  ).rejects.toThrow("thiết bị chưa dọn xong");
  expect(dependencies.signOutLocal).toHaveBeenCalledTimes(1);
  expect(dependencies.clearQueries).toHaveBeenCalledTimes(1);
  expect(dependencies.setSession).toHaveBeenCalledWith(null);
});
