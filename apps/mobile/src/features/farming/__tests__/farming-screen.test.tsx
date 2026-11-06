import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { FarmScreen } from "../FarmScreen";
import { useFarming } from "../store";
import { usePreferences } from "../../../store/preferences";

// Đồng hồ cố định để test không bị interval 500ms gây chồng act().
jest.mock("../useNow", () => ({ useNow: () => 1_000_000 }));

/** Reset store về trạng thái sạch, tùy chọn mở/tắt hướng dẫn lần đầu. */
function prepareFarm(guideSeen: boolean) {
  useFarming.getState().reset(1_000_000);
  useFarming.setState({ guideSeen });
}

describe("FarmScreen", () => {
  beforeEach(() => {
    usePreferences.setState({ locale: "vi" });
  });

  test("renders the farm with level, coins and plot count", async () => {
    prepareFarm(true);
    await render(<FarmScreen />);
    await waitFor(() => expect(screen.getByText("Cấp 1")).toBeTruthy());
    expect(screen.getByText("Trang trại của bạn")).toBeTruthy();
    expect(screen.getByText("0 kinh nghiệm · 9/9 ô đất")).toBeTruthy();
    expect(screen.getByText("30")).toBeTruthy();
  });

  test("shows the first-run guide and can dismiss it", async () => {
    prepareFarm(false);
    await render(<FarmScreen />);
    await waitFor(() =>
      expect(screen.getByText("Chào mừng đến trang trại")).toBeTruthy(),
    );
    fireEvent.press(screen.getByText("Bắt đầu"));
    await waitFor(() =>
      expect(screen.queryByText("Chào mừng đến trang trại")).toBeNull(),
    );
    expect(useFarming.getState().guideSeen).toBe(true);
  });

  test("opens the shop sheet and shows all five seeds", async () => {
    prepareFarm(true);
    await render(<FarmScreen />);
    await waitFor(() => expect(screen.getByText("Cấp 1")).toBeTruthy());

    fireEvent.press(screen.getByText("Cửa hàng"));
    await waitFor(() =>
      expect(screen.getByText("Cửa hàng hạt giống")).toBeTruthy(),
    );
    // Tên giống hiện cả trong túi hạt và cửa hàng → dùng getAllByText.
    for (const name of ["Hạt lúa", "Lúa mì", "Ngô", "Cà chua", "Dâu"]) {
      expect(screen.getAllByText(name).length).toBeGreaterThanOrEqual(1);
    }
  });

  test("opens the seller sheet", async () => {
    prepareFarm(true);
    await render(<FarmScreen />);
    await waitFor(() => expect(screen.getByText("Cấp 1")).toBeTruthy());

    fireEvent.press(screen.getByText("Bán (kho)"));
    await waitFor(() => expect(screen.getByText("Cửa thu mua")).toBeTruthy());
  });

  test("planting on a tile consumes a seed", async () => {
    prepareFarm(true);
    await render(<FarmScreen />);
    await waitFor(() => expect(screen.getByText("Cấp 1")).toBeTruthy());

    // Chọn ô đất đầu tiên (9 ô trống cùng label) rồi gieo lúa.
    const emptyTiles = screen.getAllByLabelText("Ô đất trống, chạm để chọn");
    fireEvent.press(emptyTiles[0]);
    await waitFor(() =>
      expect(screen.getByText("Ô đất của bạn")).toBeTruthy(),
    );
    // Mỗi loại giống có một nút "Gieo" → nút đầu là hạt lúa.
    fireEvent.press(screen.getAllByText("Gieo")[0]);

    await waitFor(() => expect(useFarming.getState().seeds.rice).toBe(2));
    expect(useFarming.getState().plots.t0.stage).toBe("planted");
  });
});
