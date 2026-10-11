import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFile, stat, writeFile, mkdir } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "@playwright/test";

const require = createRequire(import.meta.url);
const { PNG } = require("pngjs");

const repositoryRoot = resolve(import.meta.dirname, "..");
const distRoot = join(
  repositoryRoot,
  "apps",
  "mobile",
  ".live2d-private",
  "dist",
);
const artifactRoot = join(repositoryRoot, "artifacts");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".moc3": "application/octet-stream",
  ".frag": "text/plain",
  ".vert": "text/plain",
};

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, "http://127.0.0.1").pathname,
    );
    const relative = pathname === "/" ? "index.html" : pathname.slice(1);
    const target = normalize(join(distRoot, relative));
    if (!target.startsWith(normalize(distRoot))) throw new Error("Unsafe path");
    const info = await stat(target);
    if (!info.isFile()) throw new Error("Not a file");
    response.writeHead(200, {
      "content-type": mime[extname(target)] || "application/octet-stream",
      "cache-control": "no-store",
    });
    response.end(await readFile(target));
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});

await new Promise((resolveListen) =>
  server.listen(0, "127.0.0.1", resolveListen),
);
const address = server.address();
const url = `http://127.0.0.1:${address.port}/`;
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 480, height: 640 },
    deviceScaleFactor: 1,
  });
  const consoleErrors = [];
  const failedRequests = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) =>
    failedRequests.push(`${request.url()}: ${request.failure()?.errorText}`),
  );
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    window.__verificationEvents = [];
    window.addEventListener("mori-renderer-event", (event) => {
      window.__verificationEvents.push(JSON.parse(event.detail));
    });
  });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  try {
    await page.waitForFunction(
      () =>
        window.__verificationEvents?.some((event) => event.type === "ready"),
      null,
      { timeout: 45_000 },
    );
  } catch (error) {
    const debug = {
      events: await page.evaluate(() => window.__verificationEvents),
      consoleErrors,
      failedRequests,
      pageErrors,
      html: await page.locator("body").evaluate((body) => body.innerHTML),
      timeout: error instanceof Error ? error.message : String(error),
    };
    console.error(JSON.stringify(debug, null, 2));
    throw error;
  }
  await page.evaluate(() =>
    window.__moriReceive({
      version: 1,
      type: "setState",
      state: "speaking",
      reducedMotion: false,
      crisis: false,
    }),
  );
  await page.waitForTimeout(5_500);
  const canvasEvidence = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const gl = canvas?.getContext("webgl2") || canvas?.getContext("webgl");
    if (!canvas || !gl)
      return {
        width: 0,
        height: 0,
        nonTransparentSamples: 0,
        dataUrlLength: 0,
      };
    const pixels = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(
      0,
      0,
      canvas.width,
      canvas.height,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );
    let nonTransparentSamples = 0;
    const stride = Math.max(4, Math.floor(pixels.length / 50_000 / 4) * 4);
    for (let index = 3; index < pixels.length; index += stride) {
      if (pixels[index] > 0) nonTransparentSamples++;
    }
    return {
      width: canvas.width,
      height: canvas.height,
      nonTransparentSamples,
      dataUrlLength: canvas.toDataURL("image/png").length,
    };
  });
  await mkdir(artifactRoot, { recursive: true });
  const screenshotPath = join(artifactRoot, "live2d-standalone.png");
  const screenshot = await page.screenshot({
    path: screenshotPath,
    omitBackground: true,
  });
  const png = PNG.sync.read(screenshot);
  let visiblePixels = 0;
  for (let index = 0; index < png.data.length; index += 4) {
    const red = png.data[index];
    const green = png.data[index + 1];
    const blue = png.data[index + 2];
    const alpha = png.data[index + 3];
    if (alpha > 0 && (red > 8 || green > 8 || blue > 8)) visiblePixels++;
  }
  const events = await page.evaluate(() => window.__verificationEvents);
  const errors = events.filter((event) => event.type === "error");
  const result = {
    url,
    events,
    canvas: { ...canvasEvidence, visibleScreenshotPixels: visiblePixels },
    consoleErrors,
    failedRequests,
    pageErrors,
    screenshot: screenshotPath,
    verified:
      errors.length === 0 &&
      consoleErrors.length === 0 &&
      failedRequests.length === 0 &&
      pageErrors.length === 0 &&
      visiblePixels > 10_000,
  };
  await writeFile(
    join(artifactRoot, "live2d-renderer-result.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
  if (!result.verified) process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}
