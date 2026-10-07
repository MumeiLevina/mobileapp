import { expect, Page, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function completeOnboarding(page: Page) {
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
}

async function openGarden(page: Page) {
  await page.evaluate(() => {
    const stored = localStorage.getItem("mori-demo");
    if (!stored) return;
    const state = JSON.parse(stored);
    state.profile.onboarded = true;
    localStorage.setItem("mori-demo", JSON.stringify(state));
  });
  await page.goto("/");
}
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
  await page.getByRole("button", { name: "Để sau", exact: true }).click();
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
  await page
    .getByRole("button", { name: "Xóa ký ức này", exact: true })
    .click();
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
  expect(accountExport.schemaVersion).toBe(6);
  expect(accountExport.data).toHaveProperty("ritualEntries");
  expect(accountExport.data).toHaveProperty("lifeMapItems");
  expect(accountExport.data).toHaveProperty("memorySources");
  expect(accountExport.data).toHaveProperty("letters");
  expect(accountExport.data).toHaveProperty("softGoals");
  expect(accountExport.data).toHaveProperty("gardenUnlocks");
  expect(accountExport.data).toHaveProperty("personalMilestones");
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
  await page.getByRole("button", { name: "Xóa tất cả nhật ký" }).last().click();
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

test("guided journal keeps a local draft and creates a journal only on save", async ({
  page,
}) => {
  await page.goto("/journal");
  await page
    .getByRole("button", { name: "Xem tất cả gợi ý", exact: true })
    .click();
  await expect(page.getByText("Một gợi ý để bắt đầu.")).toBeVisible();
  await page
    .getByRole("button", {
      name: "Khi mình thấy mất phương hướng. 5 phút",
      exact: true,
    })
    .click();

  await page
    .getByLabel("Câu trả lời 1")
    .fill("Mình đang chưa biết nên bắt đầu từ đâu.");
  expect(
    await page.evaluate(() => {
      const stored = localStorage.getItem("mori-demo");
      return stored ? JSON.parse(stored).journals.length : 0;
    }),
  ).toBe(0);

  await page.reload();
  await expect(page.getByLabel("Câu trả lời 1")).toHaveValue(
    "Mình đang chưa biết nên bắt đầu từ đâu.",
  );
  await page.getByRole("button", { name: "Câu tiếp theo" }).click();
  await page
    .getByLabel("Câu trả lời 2")
    .fill("Những lần đi bộ chậm từng giúp mình vững hơn.");
  await page.getByRole("button", { name: "Câu tiếp theo" }).click();
  await page
    .getByLabel("Câu trả lời 3")
    .fill("Mình sẽ đi ra ngoài trong mười phút.");
  await page.getByRole("button", { name: "Xem lại câu trả lời" }).click();
  await expect(page.getByText("Những điều bạn muốn giữ lại.")).toBeVisible();
  expect(
    await page.evaluate(() => {
      const stored = localStorage.getItem("mori-demo");
      return stored ? JSON.parse(stored).journals.length : 0;
    }),
  ).toBe(0);

  await page.getByRole("button", { name: "Lưu vào nhật ký" }).click();
  await expect(
    page.getByText("Khi mình thấy mất phương hướng", { exact: true }),
  ).toBeVisible();
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("mori-demo")!).journals[0],
  );
  expect(saved.source).toBe("guided");
  expect(saved.content).toContain("một bước thật nhỏ");

  await openGarden(page);
  await page.getByTestId("garden-hotspot-timeline").click();
  await expect(page).toHaveURL(/\/timeline$/);
  await page.goto("/journal");

  await page
    .getByRole("button", { name: /Khi mình thấy mất phương hướng,/ })
    .click();
  await page.getByRole("button", { name: "Xóa trang viết" }).click();
  await page
    .getByRole("button", { name: "Xóa trang viết", exact: true })
    .last()
    .click();
  await expect(
    page.getByText("Khi mình thấy mất phương hướng", { exact: true }),
  ).toBeHidden();
});

test("Journal opens Letters, restores a private draft and creates a vault item", async ({
  page,
}) => {
  await page.goto("/journal");
  await page.getByRole("button", { name: "Thư gửi chính mình" }).click();
  await expect(page.getByText("Một điều cho mình của mai sau.")).toBeVisible();
  await page.getByRole("button", { name: "Viết một lá thư" }).click();
  await page.getByLabel("Tiêu đề lá thư").fill("Cho một ngày chậm hơn");
  await page
    .getByLabel("Nội dung lá thư")
    .fill("Mình hy vọng lúc đọc lại, bạn đang thở nhẹ hơn.");
  await page.getByRole("button", { name: "1 tuần", exact: true }).click();

  expect(
    await page.evaluate(() => {
      const stored = localStorage.getItem("mori-demo");
      return stored ? (JSON.parse(stored).letters?.length ?? 0) : 0;
    }),
  ).toBe(0);
  await page.reload();
  await expect(page.getByLabel("Tiêu đề lá thư")).toHaveValue(
    "Cho một ngày chậm hơn",
  );
  await expect(page.getByLabel("Nội dung lá thư")).toHaveValue(
    "Mình hy vọng lúc đọc lại, bạn đang thở nhẹ hơn.",
  );

  await page.getByRole("button", { name: "Cất lá thư" }).click();
  await expect(page).toHaveURL(/\/letters$/);
  await expect(
    page.getByText("Cho một ngày chậm hơn", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Mình hy vọng lúc đọc lại, bạn đang thở nhẹ hơn."),
  ).toBeHidden();

  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("mori-demo")!),
  );
  expect(state.letters).toHaveLength(1);
  expect(state.letters[0].content).toBe(
    "Mình hy vọng lúc đọc lại, bạn đang thở nhẹ hơn.",
  );
  expect(state.awards).toContain(`letter-seed:${state.letters[0].id}`);

  await openGarden(page);
  await page.getByTestId("garden-hotspot-letters").click();
  await expect(page).toHaveURL(/\/letters$/);
});

test("private conversation leaves no history unless Save is explicit", async ({
  page,
}) => {
  await page.goto("/talk");
  const initialGrowth = await page.evaluate(() => {
    const stored = localStorage.getItem("mori-demo");
    return stored ? JSON.parse(stored).garden.growth_points : 0;
  });
  await page.getByRole("button", { name: "Trò chuyện riêng tư" }).click();
  await expect(
    page.getByText("Không lưu sau khi bạn rời đi", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Nội dung riêng tư")
    .fill("Một điều chỉ cho phiên này.");
  await page.getByRole("button", { name: "Gửi", exact: true }).click();
  await expect(
    page.getByText("Mình đang lắng nghe.", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => {
      const stored = localStorage.getItem("mori-demo");
      if (!stored) return [0, 0];
      const state = JSON.parse(stored);
      return [state.conversations.length, state.messages.length];
    }),
  ).toEqual([0, 0]);
  await page.getByLabel("Rời cuộc trò chuyện riêng tư").click();
  await page.getByRole("button", { name: "Rời đi mà không lưu" }).click();
  await expect(page).toHaveURL(/\/talk$/);
  expect(
    await page.evaluate(() => {
      const stored = localStorage.getItem("mori-demo");
      if (!stored) return [0, 0];
      const state = JSON.parse(stored);
      return [state.conversations.length, state.messages.length];
    }),
  ).toEqual([0, 0]);

  await page.getByRole("button", { name: "Trò chuyện riêng tư" }).click();
  await page
    .getByLabel("Nội dung riêng tư")
    .fill("Mình chọn giữ lại phiên này.");
  await page.getByRole("button", { name: "Gửi", exact: true }).click();
  await page.getByLabel("Rời cuộc trò chuyện riêng tư").click();
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page).toHaveURL(/\/conversation\//);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("mori-demo")!),
  );
  expect(saved.conversations).toHaveLength(1);
  expect(saved.messages).toHaveLength(2);
  expect(
    saved.messages.map((message: { content: string }) => message.content),
  ).toContain("Mình chọn giữ lại phiên này.");
  expect(saved.garden.growth_points).toBe(initialGrowth);
  expect(saved.gardenUnlocks).toHaveLength(0);
});

test("You creates and completes a gentle intention without pressure copy", async ({
  page,
}) => {
  await page.goto("/me");
  await page.getByRole("button", { name: "Những ý định nhỏ của mình" }).click();
  await expect(page.getByText("Những điều nhỏ mình đang giữ.")).toBeVisible();
  await page.getByRole("button", { name: "Thêm một ý định nhỏ" }).click();
  await page.getByLabel("Tên ý định nhỏ").fill("Đi bộ 10 phút");
  await page
    .getByLabel("Ghi chú cho ý định")
    .fill("Chỉ khi cơ thể thấy phù hợp.");
  await page.getByRole("button", { name: "Giữ lại điều này" }).click();
  await expect(page.getByText("Đi bộ 10 phút", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/streak|quá hạn|thất bại|failed|overdue/i),
  ).toBeHidden();

  await page.getByRole("button", { name: "Đã làm xong" }).click();
  await expect(page.getByText("Đã dành thời gian")).toBeVisible();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("mori-demo")!),
  );
  expect(state.softGoals).toHaveLength(1);
  expect(state.softGoals[0].status).toBe("completed");
  expect(state.awards).toContain(`soft-goal:${state.softGoals[0].id}`);
  expect(state.garden.growth_points).toBe(1);

  await openGarden(page);
  await page.getByTestId("garden-hotspot-soft-goals").click();
  await expect(page).toHaveURL(/\/soft-goals$/);
  await page.goto("/me");
  await page.getByRole("button", { name: "Những dấu mốc nhỏ" }).click();
  await expect(
    page.getByText("Bạn đã hoàn thành ý định nhỏ đầu tiên.", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("mori-demo")!).personalMilestones.filter(
        (item: { milestone_key: string }) =>
          item.milestone_key === "first_soft_goal",
      ).length,
    ),
  ).toBe(1);
});

test("morning ritual remains optional and saves only when finished", async ({
  page,
}) => {
  await page.goto("/ritual/morning");
  await expect(page.getByText("Một khởi đầu vừa đủ.")).toBeVisible();

  expect(
    await page.evaluate(() => {
      const stored = localStorage.getItem("mori-demo");
      return stored ? (JSON.parse(stored).ritualEntries?.length ?? 0) : 0;
    }),
  ).toBe(0);

  await page.getByRole("radio", { name: "Nhẹ nhàng" }).click();
  await expect(page.getByRole("radio", { name: "Nhẹ nhàng" })).toBeChecked();
  await page
    .getByLabel("Ý định nhỏ cho hôm nay")
    .fill("Đi bộ chậm trong mười phút.");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const key = Object.keys(localStorage).find((item) =>
          item.includes("ritual.morning"),
        );
        if (!key) return null;
        const draft = JSON.parse(localStorage.getItem(key)!);
        return {
          desiredFeeling: draft.desiredFeeling,
          smallIntention: draft.smallIntention,
        };
      }),
    )
    .toEqual({
      desiredFeeling: "gentle",
      smallIntention: "Đi bộ chậm trong mười phút.",
    });
  await page.reload();
  await expect(page.getByRole("radio", { name: "Nhẹ nhàng" })).toBeChecked();
  await expect(page.getByLabel("Ý định nhỏ cho hôm nay")).toHaveValue(
    "Đi bộ chậm trong mười phút.",
  );

  expect(
    await page.evaluate(() => {
      const stored = localStorage.getItem("mori-demo");
      return stored ? (JSON.parse(stored).ritualEntries?.length ?? 0) : 0;
    }),
  ).toBe(0);

  await page.getByRole("button", { name: "Bắt đầu ngày mới" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const stored = localStorage.getItem("mori-demo");
        return stored ? (JSON.parse(stored).ritualEntries?.length ?? 0) : 0;
      }),
    )
    .toBe(1);

  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("mori-demo")!),
  );
  expect(state.ritualEntries[0]).toMatchObject({
    user_id: "demo",
    type: "morning",
    desired_feeling: "gentle",
    small_intention: "Đi bộ chậm trong mười phút.",
  });
  expect(state.ritualEntries[0]).not.toHaveProperty("streak");
  expect(state.ritualEntries[0]).not.toHaveProperty("missed");
  expect(state.garden.growth_points).toBe(1);
});

test("quiet room works without AI, memory or conversation storage", async ({
  page,
}) => {
  await page.goto("/quiet-room");
  await expect(page.getByText("Phòng yên.", { exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "Chỉ ngồi yên" }).click();
  await page.getByRole("radio", { name: "Không hẹn giờ" }).click();
  await page.getByRole("button", { name: "Vào phòng yên" }).click();
  await expect(page.getByText("Không cần làm gì cả.")).toBeVisible();

  const privateState = await page.evaluate(() => {
    const stored = localStorage.getItem("mori-demo");
    if (!stored) return { conversations: 0, memories: 0 };
    const data = JSON.parse(stored);
    return {
      conversations: data.conversations?.length ?? 0,
      memories: data.memories?.length ?? 0,
    };
  });
  expect(privateState).toEqual({ conversations: 0, memories: 0 });
  await page.getByRole("button", { name: "Rời phòng yên" }).click();
});

test("Home mood check-in routes through Mori Moments to Quiet Room", async ({
  page,
}) => {
  await completeOnboarding(page);
  await page.getByRole("radio", { name: "Dễ chịu" }).click();
  await page.getByRole("button", { name: "Chỉ lưu cảm xúc" }).click();
  await expect(
    page.getByText("Bạn muốn điều gì lúc này?", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ngồi yên", exact: true }).click();
  await expect(page).toHaveURL(/\/quiet-room$/);
  await expect(page.getByText("Phòng yên.", { exact: true })).toBeVisible();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("mori-demo")!),
  );
  expect(state.conversations).toEqual([]);
  expect(state.memories).toEqual([]);
});

test("Home exposes the local morning ritual and returns after completion", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const NativeDate = Date;
    class FixedDate extends NativeDate {
      constructor(...args: ConstructorParameters<typeof Date>) {
        super(...(args.length ? args : ["2026-10-07T08:00:00"]));
      }
      static now() {
        return new NativeDate("2026-10-07T08:00:00").getTime();
      }
    }
    globalThis.Date = FixedDate as DateConstructor;
  });
  await completeOnboarding(page);
  await page.getByRole("button", { name: "Mở Morning Ritual" }).click();
  await page.getByRole("radio", { name: "Bình yên" }).click();
  await page.getByRole("button", { name: "Bắt đầu ngày mới" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Cho khoảnh khắc này").last()).toBeVisible();
});

test("Evening Ritual routes Write, Breathe and Quiet without AI", async ({
  page,
}) => {
  await page.goto("/ritual/evening");
  await page.getByRole("button", { name: "Viết vài dòng" }).click();
  await expect(page).toHaveURL(/\/journal\/new$/);
  await page.goto("/ritual/evening");
  await page.getByRole("button", { name: "Thở 2 phút" }).click();
  await expect(page).toHaveURL(/\/activity\/breathing$/);
  await page.goto("/ritual/evening");
  await page.getByRole("button", { name: "Ngồi yên một chút" }).click();
  await expect(page).toHaveURL(/\/quiet-room$/);
});

test("First Aid routes grounding, Talk, Quiet, connection and deterministic danger", async ({
  page,
}) => {
  await page.goto("/first-aid");
  await page
    .getByRole("button", { name: "Giúp mình quay về hiện tại" })
    .click();
  await expect(page.getByText("5 điều bạn có thể nhìn thấy")).toBeVisible();
  await page.goto("/first-aid");
  await page.getByRole("button", { name: "Mình muốn nói" }).click();
  await expect(page).toHaveURL(/\/talk$/);
  await page.goto("/first-aid");
  await page.getByRole("button", { name: "Mình chỉ muốn ngồi yên" }).click();
  await expect(page).toHaveURL(/\/quiet-room$/);
  await page.goto("/first-aid");
  await page
    .getByRole("button", { name: "Mình muốn tìm một người để liên hệ" })
    .click();
  await expect(page.getByText(/Mori không đọc danh bạ/)).toBeVisible();
  await page.goto("/first-aid");
  await page
    .getByRole("button", { name: "Mình có thể đang gặp nguy hiểm" })
    .click();
  await expect(
    page.getByText("Ưu tiên sự an toàn của bạn lúc này."),
  ).toBeVisible();
  await expect(page.getByText(/liên hệ dịch vụ cấp cứu/).first()).toBeVisible();
  const stored = await page.evaluate(() => localStorage.getItem("mori-demo"));
  if (stored) {
    const state = JSON.parse(stored);
    expect(state.conversations).toEqual([]);
    expect(state.memories).toEqual([]);
    expect(state.journals).toEqual([]);
  }
});
