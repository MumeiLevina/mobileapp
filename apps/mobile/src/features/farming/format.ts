/** Định dạng thời gian còn lại thành chuỗi ngắn gọn. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}p ${seconds.toString().padStart(2, "0")}s`;
}

/** Định dạng thời gian chờ đến mốc thời gian tuyệt đối. */
export function formatCountdown(target: number, now: number): string {
  return formatDuration(target - now);
}
