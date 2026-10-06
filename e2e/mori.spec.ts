import { expect, test } from "@playwright/test";
test("onboarding → mood → conversation → approved memory → journal → care → garden", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Bắt đầu", exact: true }).click();
  await page.getByRole("radio", { name: "Một nơi để tâm sự" }).click();
  await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
  await page.getByRole("radio", { name: /Tĩnh lặng/ }).click();
  await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
  await page.getByRole("button", { name: "Mình đã hiểu", exact: true }).click();
  await page
    .getByRole("button", { name: "Tiếp tục với lựa chọn của mình" })
    .click();
  await page.getByRole("button", { name: "Để sau, vào khu vườn" }).click();
  await page.getByRole("button", { name: "Mình muốn khám phá trước" }).click();
  await expect(page.getByText("Hôm nay lòng bạn thế nào?")).toBeVisible();
  await page.screenshot({ path: "artifacts/home-light.png", fullPage: true });
  await page.getByRole("button", { name: "Chùng xuống", exact: true }).click();
  await page.getByRole("checkbox", { name: "Công việc", exact: true }).click();
  await page.getByLabel("Ghi chú cảm xúc").fill("Một ngày hơi mệt.");
  await page.getByRole("button", { name: "Lưu lại", exact: true }).click();
  await page.getByRole("button", { name: "Về khu vườn", exact: true }).click();
  await page
    .getByRole("button", { name: "Tâm sự cùng Mori", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Tâm sự cùng Mori", exact: true })
    .click();
  await page
    .getByLabel("Nội dung tin nhắn")
    .fill(
      "Hôm nay mình mệt. Mình chỉ muốn bạn lắng nghe, không cần lời khuyên.",
    );
  await page.getByRole("button", { name: "Gửi", exact: true }).click();
  await expect(page.getByText("MORI MUỐN XIN PHÉP GHI NHỚ")).toBeVisible();
  await page
    .getByRole("button", { name: "Ghi nhớ điều này", exact: true })
    .click();
  await page.getByLabel("Tùy chọn cuộc trò chuyện").click();
  await page
    .getByRole("button", { name: "Tạo bản nháp nhật ký", exact: true })
    .click();
  await expect(page.getByText("BẢN NHÁP TỪ CUỘC TRÒ CHUYỆN")).toBeVisible();
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem("mori-demo")!).journals.length,
  );
  expect(before).toBe(0);
  await page.getByLabel("Tiêu đề nhật ký").fill("Một chút nhẹ lòng");
  await page.getByRole("button", { name: "Lưu lại", exact: true }).click();
  await expect(
    page.getByText("Một chút nhẹ lòng", { exact: true }),
  ).toBeVisible();
  await page.goto("/activity/breathing");
  await page.getByRole("button", { name: "Bắt đầu khi bạn sẵn sàng" }).click();
  await page.getByRole("button", { name: "Mình đã thực hiện xong" }).click();
  await expect(page.getByText("Một chút chăm sóc đã ở lại.")).toBeVisible();
  await page.getByRole("button", { name: "Về khu vườn" }).click();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("mori-demo")!),
  );
  expect(state.profile.companion_style).toBe("calm");
  expect(state.garden.growth_points).toBe(3);
  expect(state.memories[0].approved_by_user).toBe(true);
  expect(state.journals).toHaveLength(1);
  await page.goto("/me");
  await page.getByRole("radio", { name: "Buổi tối", exact: true }).click();
  await page.goto("/");
  await page.screenshot({ path: "artifacts/home-dark.png", fullPage: true });
  expect(errors).toEqual([]);
});
test("English interface, reduced motion and weekly opt-in remain usable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/me");
  await page
    .getByRole("radio", { name: "English (core screens)", exact: true })
    .click();
  await expect(
    page.getByText("At your own pace", { exact: true }),
  ).toBeVisible();
  await page.goto("/onboarding");
  await expect(page.getByText("A quiet place", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Begin", exact: true }).click();
  await expect(
    page.getByText("What would you like Mori to be here for?"),
  ).toBeVisible();
  await page.goto("/self-care");
  await expect(
    page.getByText("Two-minute breathing", { exact: true }),
  ).toBeVisible();
  await page.goto("/weekly-reflection");
  await expect(
    page.getByText("Weekly reflections are off.", { exact: false }),
  ).toBeVisible();
});
test("journal local draft survives reload and deletion removes approved memory", async ({
  page,
}) => {
  await page.goto("/journal/new");
  await page.getByLabel("Tiêu đề nhật ký").fill("Nháp riêng");
  await page.getByLabel("Nội dung nhật ký").fill("Mình muốn giữ lại dòng này.");
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage).some((k) => k.includes("journal.new")),
      ),
    )
    .toBe(true);
  await page.reload();
  await expect(page.getByLabel("Nội dung nhật ký")).toHaveValue(
    "Mình muốn giữ lại dòng này.",
  );
  await page.goto("/memories");
  await page
    .getByRole("button", { name: "Thêm một điều bạn muốn ghi nhớ" })
    .click();
  await page.getByLabel("Nội dung ký ức").fill("Mình thích tiếng mưa.");
  await page.getByRole("button", { name: "Lưu và cho phép ghi nhớ" }).click();
  await expect(page.getByLabel("Nội dung ký ức")).toBeHidden();
  await expect(
    page.getByText("Mình thích tiếng mưa.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Quên điều này", exact: true })
    .click();
  await page.getByRole("button", { name: "Xác nhận xóa", exact: true }).click();
  await expect(
    page.getByText(
      "Mori chưa ghi nhớ điều gì. Bạn không cần thêm nếu không muốn.",
    ),
  ).toBeVisible();
});
