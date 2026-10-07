import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
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
  await page.getByRole("radio", { name: "Chùng xuống", exact: true }).click();
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
  await page.getByRole("button", { name: "Xóa ký ức này", exact: true }).click();
  await expect(
    page.getByText(
      "Mori chưa ghi nhớ điều gì. Bạn không cần thêm nếu không muốn.",
    ),
  ).toBeVisible();
});

test("privacy center exports and deletes each requested data group", async ({
  page,
}) => {
  await page.goto("/me");
  await page
    .getByRole("button", { name: "Nạp dữ liệu mẫu để khám phá" })
    .click();
  await page.getByRole("button", { name: "Mở trung tâm dữ liệu" }).click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất dữ liệu của tôi" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(
    /^mori-data-\d{4}-\d{2}-\d{2}\.json$/,
  );
  const path = await download.path();
  const accountExport = JSON.parse(await readFile(path!, "utf8"));
  expect(accountExport.schemaVersion).toBe(3);
  expect(accountExport.data).toHaveProperty("lifeMapItems");
  expect(accountExport.data).toHaveProperty("memorySources");
  expect(accountExport.data).not.toHaveProperty("safetyEvents");
  expect(JSON.stringify(accountExport.data.memories)).not.toContain(
    "embedding",
  );

  await page
    .getByRole("button", { name: "Xóa tất cả cuộc trò chuyện", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Xóa tất cả cuộc trò chuyện" })
    .last()
    .click();
  await page
    .getByRole("button", { name: "Xóa tất cả nhật ký", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Xóa tất cả nhật ký" })
    .last()
    .click();
  await page
    .getByRole("button", { name: "Xóa tất cả ký ức của Mori", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Xóa tất cả ký ức của Mori" })
    .last()
    .click();

  const data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("mori-demo")!),
  );
  expect(data.conversations).toEqual([]);
  expect(data.messages).toEqual([]);
  expect(data.journals).toEqual([]);
  expect(data.memories).toEqual([]);

  await page
    .getByRole("button", { name: "Xóa dữ liệu demo và bắt đầu lại" })
    .click();
  await page.getByRole("button", { name: "Xóa tài khoản và dữ liệu" }).click();
  await expect(
    page.getByRole("button", { name: "Bắt đầu", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("mori-demo")),
  ).toBeNull();
});

test("Wave 1 connects Ask Mori, Life Map, Memory evidence, Timeline and Patterns", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/me");
  await page
    .getByRole("button", { name: "Nạp dữ liệu mẫu để khám phá" })
    .click();

  await page.getByRole("button", { name: "Bản đồ cuộc sống của mình" }).click();
  await expect(page.getByText("Mori gợi ý · Bạn quyết định")).toBeVisible();
  await page.getByRole("button", { name: "Thêm", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("mori-demo")!).lifeMapItems.length,
      ),
    )
    .toBe(1);

  await page.goto("/me");
  await page.getByRole("button", { name: "Xem những nhịp lặp lại" }).click();
  await expect(page.getByText("Chủ đề xuất hiện nhiều lần")).toBeVisible();
  await expect(
    page.getByText(
      "This is a pattern in your entries, not proof of cause or a diagnosis.",
    ),
  ).toBeVisible();

  await page.goto("/talk");
  await page
    .getByRole("button", { name: "Hỏi Mori về những điều mình đã lưu" })
    .click();
  await page
    .getByLabel("Câu hỏi cho Mori")
    .fill("Gần đây mình viết gì về công việc?");
  await page.getByRole("button", { name: "Nhìn lại dữ liệu của mình" }).click();
  await expect(page.getByText("Dựa trên", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/không phải bằng chứng về nguyên nhân/).first(),
  ).toBeVisible();

  await page.goto("/journal");
  await page
    .getByRole("button", { name: "Xem dòng thời gian của mình" })
    .click();
  await expect(page.getByText("Dòng thời gian", { exact: true })).toBeVisible();
  await expect(page.getByText(/Tâm trạng:/).first()).toBeVisible();
  await expect(
    page.getByText("Một buổi sáng chậm", { exact: true }).last(),
  ).toBeVisible();

  await page.goto("/memories");
  await expect(page.getByText("Vì sao Mori ghi nhớ điều này?")).toBeVisible();
  await expect(
    page.getByText("Được bạn trực tiếp thêm vào ký ức của Mori."),
  ).toBeVisible();
  await expect(page.getByText(/Được bạn duyệt ngày/)).toBeVisible();
  expect(errors).toEqual([]);
});
