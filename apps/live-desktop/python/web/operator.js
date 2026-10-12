/* global document, fetch, setInterval, clearInterval */
const element = (id) => document.getElementById(id);
let timer;
async function post(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Mori-Local": "1" },
    body: JSON.stringify(body),
  });
  if (!response.ok)
    throw new Error(
      "Chưa sẵn sàng: kiểm tra kết nối renderer, trạng thái pause hoặc session.",
    );
  return response.json();
}
async function refresh() {
  try {
    const response = await fetch("/status");
    if (!response.ok) throw new Error("Hết phiên đăng nhập. Tải lại trang.");
    const status = await response.json();
    element("mode").textContent = `${status.mode} / ${status.voice}`;
    element("connection").textContent =
      `${status.connected ? "connected" : "disconnected"} / ${status.avatar}`;
    element("operation").textContent =
      `${status.operation} / ${status.emotion}`;
    element("speech").textContent = status.speech;
    element("budget").textContent = status.budget
      ? `$${(status.budget.reservedMicros / 1000000).toFixed(4)} / $${(status.budget.budgetMicros / 1000000).toFixed(2)}`
      : "Backend telemetry unavailable";
    if (status.error) element("error").textContent = status.error;
  } catch (error) {
    element("error").textContent = error.message;
    clearInterval(timer);
  }
}
element("login").addEventListener("submit", async (event) => {
  event.preventDefault();
  const token = element("token").value;
  element("token").value = "";
  try {
    await post("/login", { token });
    element("login").hidden = true;
    element("controls").hidden = false;
    await refresh();
    timer = setInterval(refresh, 4000);
  } catch (error) {
    element("error").textContent = error.message;
  }
});
for (const button of document.querySelectorAll("[data-action]"))
  button.addEventListener("click", async () => {
    try {
      await post("/control", { action: button.dataset.action });
      element("error").textContent = "";
      await refresh();
    } catch (error) {
      element("error").textContent = error.message;
    }
  });
element("test").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await post("/control", { action: "test", text: element("text").value });
    element("text").value = "";
    element("error").textContent = "";
  } catch (error) {
    element("error").textContent = error.message;
  }
});
