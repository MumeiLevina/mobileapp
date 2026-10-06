import { render, screen, fireEvent } from "@testing-library/react-native";
import { MemoryCard } from "../features/memories/MemoryCard";
test("unapproved memory visibly requires consent and routes the explicit approval action", async () => {
  const approve = jest.fn();
  await render(
    <MemoryCard
      memory={{
        id: "m",
        user_id: "u",
        created_at: "2026-10-01",
        content: "Mình thích tiếng mưa",
        category: "preference",
        approved_by_user: false,
        confidence: 1,
      }}
      onApprove={approve}
      onEdit={jest.fn()}
      onDelete={jest.fn()}
    />,
  );
  expect(
    screen.getByText("Đang chờ bạn cho phép · Chưa được sử dụng"),
  ).toBeTruthy();
  expect(approve).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole("button", { name: "Cho phép ghi nhớ" }),
  );
  expect(approve).toHaveBeenCalledTimes(1);
});
