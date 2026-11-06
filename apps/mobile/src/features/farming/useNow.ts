import { useEffect, useState } from "react";

/**
 * Đồng hồ đơn giản: trả về `Date.now()` và cập nhật mỗi `intervalMs`.
 * Dùng để cây chín theo thời gian và đếm ngược reset cửa hàng.
 */
export function useNow(intervalMs = 500): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
