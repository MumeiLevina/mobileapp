import {
  SignOutDependencies,
  signOutAndClearLocalData,
} from "../services/sign-out";

function dependencies(
  overrides: Partial<SignOutDependencies> = {},
): SignOutDependencies {
  return {
    clearLocal: jest.fn().mockResolvedValue(undefined),
    signOutRemote: jest.fn().mockResolvedValue(undefined),
    clearQueries: jest.fn(),
    setSession: jest.fn(),
    ...overrides,
  };
}

test("sign out clears device data, remote session, queries and local session", async () => {
  const deps = dependencies();

  await signOutAndClearLocalData("owner", deps);

  expect(deps.clearLocal).toHaveBeenCalledWith("owner");
  expect(deps.signOutRemote).toHaveBeenCalledTimes(1);
  expect(deps.clearQueries).toHaveBeenCalledTimes(1);
  expect(deps.setSession).toHaveBeenCalledWith(null);
});

test("storage failure cannot prevent the authenticated session from ending", async () => {
  const deps = dependencies({
    clearLocal: jest.fn().mockRejectedValue(new Error("storage unavailable")),
  });

  await expect(signOutAndClearLocalData("owner", deps)).rejects.toThrow(
    "Đã đăng xuất nhưng thiết bị chưa dọn xong",
  );

  expect(deps.signOutRemote).toHaveBeenCalledTimes(1);
  expect(deps.clearQueries).toHaveBeenCalledTimes(1);
  expect(deps.setSession).toHaveBeenCalledWith(null);
});

test("remote sign-out failure keeps the local session so the user can retry", async () => {
  const deps = dependencies({
    signOutRemote: jest
      .fn()
      .mockRejectedValue(new Error("network unavailable")),
  });

  await expect(signOutAndClearLocalData("owner", deps)).rejects.toThrow(
    "Chưa đăng xuất được",
  );

  expect(deps.clearLocal).not.toHaveBeenCalled();
  expect(deps.clearQueries).not.toHaveBeenCalled();
  expect(deps.setSession).not.toHaveBeenCalled();
});

test("a late sign-out result only clears the captured owner's drafts, preserving the next session", async () => {
  let current = "owner";
  const deps = dependencies({
    isCurrent: (user) => user === current,
    signOutRemote: jest.fn(async () => {
      current = "next-owner";
    }),
  });
  await signOutAndClearLocalData("owner", deps);
  expect(deps.clearLocal).toHaveBeenCalledWith("owner");
  expect(deps.setSession).not.toHaveBeenCalled();
  expect(deps.clearQueries).not.toHaveBeenCalled();
  await expect(signOutAndClearLocalData("owner", deps)).rejects.toThrow(
    "Tài khoản đã thay đổi",
  );
  expect(deps.signOutRemote).toHaveBeenCalledTimes(1);
});
