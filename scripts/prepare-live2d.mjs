import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const defaultAssetRoot = resolve(repositoryRoot, "..", "mori");
const assetRoot = resolve(
  process.env.MORI_LIVE2D_ROOT || process.argv[2] || defaultAssetRoot,
);
const modelRoot = join(assetRoot, "snow-neko-live2d-assets", "snow-neko");
const sdkRoot = join(
  assetRoot,
  "CubismSdkForWeb-5-r.5",
  "CubismSdkForWeb-5-r.5",
);
const mobileRoot = join(repositoryRoot, "apps", "mobile");
const privateRoot = join(mobileRoot, ".live2d-private");
const workRoot = join(privateRoot, "work");
const distRoot = join(privateRoot, "dist");
const demoSource = join(sdkRoot, "Samples", "TypeScript", "Demo");
const frameworkSource = join(sdkRoot, "Framework");
const coreSource = join(sdkRoot, "Core", "live2dcubismcore.min.js");
const modelManifest = join(modelRoot, "snow neko.model3.json");

for (const required of [
  demoSource,
  frameworkSource,
  coreSource,
  modelManifest,
]) {
  if (!existsSync(required))
    throw new Error(`Required private Live2D input is missing: ${required}`);
}

const sdkInfo = await readFile(join(sdkRoot, "cubism-info.yml"), "utf8");
if (!/^version:\s*5-r\.5\s*$/m.test(sdkInfo)) {
  throw new Error(
    "This integration is pinned to official Cubism SDK for Web 5-r.5.",
  );
}

const model = JSON.parse(await readFile(modelManifest, "utf8"));
const references = model.FileReferences || {};
const referencedFiles = [
  references.Moc,
  ...(references.Textures || []),
  references.Physics,
  references.DisplayInfo,
  ...(references.Expressions || []).map((item) => item.File),
  ...Object.values(references.Motions || {})
    .flat()
    .map((item) => item.File),
].filter(Boolean);
for (const file of referencedFiles) {
  if (file.startsWith("/") || file.split(/[\\/]/).includes("..")) {
    throw new Error(`Unsafe model reference: ${file}`);
  }
  if (!existsSync(join(modelRoot, file)))
    throw new Error(`Missing model reference: ${file}`);
}
if (
  (references.Expressions || []).length !== 33 ||
  (references.Motions?.Idle || []).length !== 1
) {
  throw new Error(
    "Snow Neko manifest changed: expected 33 expressions and one Idle motion.",
  );
}

await rm(workRoot, { recursive: true, force: true });
await rm(distRoot, { recursive: true, force: true });
await mkdir(workRoot, { recursive: true });
await cp(join(demoSource, "src"), join(workRoot, "src"), { recursive: true });
await cp(join(demoSource, "package.json"), join(workRoot, "package.json"));
await cp(
  join(demoSource, "package-lock.json"),
  join(workRoot, "package-lock.json"),
);
await cp(join(demoSource, "tsconfig.json"), join(workRoot, "tsconfig.json"));
await cp(frameworkSource, join(workRoot, "Framework"), { recursive: true });
await mkdir(join(workRoot, "public", "Core"), { recursive: true });
await mkdir(join(workRoot, "public", "Resources", "snow-neko"), {
  recursive: true,
});
await mkdir(join(workRoot, "public", "Framework", "Shaders"), {
  recursive: true,
});
await cp(
  coreSource,
  join(workRoot, "public", "Core", "live2dcubismcore.min.js"),
);
await cp(
  join(frameworkSource, "Shaders"),
  join(workRoot, "public", "Framework", "Shaders"),
  {
    recursive: true,
  },
);
await cp(modelRoot, join(workRoot, "public", "Resources", "snow-neko"), {
  recursive: true,
});
await cp(
  modelManifest,
  join(workRoot, "public", "Resources", "snow-neko", "snow-neko.model3.json"),
);

await writeFile(
  join(workRoot, "vite.config.mts"),
  `import { defineConfig } from 'vite';\nimport path from 'node:path';\nexport default defineConfig({ base: './', publicDir: './public', resolve: { alias: { '@framework': path.resolve(__dirname, './Framework/src') } }, build: { target: 'es2020', outDir: './dist', assetsDir: 'assets', sourcemap: false } });\n`,
);
await writeFile(
  join(workRoot, "index.html"),
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><meta http-equiv="Content-Security-Policy" content="default-src 'self' data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self';"><title>Mori Snow Neko</title><style>html,body{overflow:hidden;margin:0;width:100%;height:100%;background:transparent}body{display:flex}canvas{width:100vw!important;height:100vh!important;display:block}</style><script src="./Core/live2dcubismcore.min.js"></script><script type="module" src="./src/main.ts"></script></head><body></body></html>`,
);

const definePath = join(workRoot, "src", "lappdefine.ts");
let defineSource = await readFile(definePath, "utf8");
defineSource = defineSource
  .replace(
    "export const ResourcesPath = '../../Resources/';",
    "export const ResourcesPath = './Resources/';",
  )
  .replace(
    "export const ShaderPath = '../../Framework/Shaders/WebGL/';",
    "export const ShaderPath = './Framework/Shaders/WebGL/';",
  )
  .replace(
    /export const ModelDir: string\[\] = \[[\s\S]*?\];/,
    "export const ModelDir: string[] = ['snow-neko'];",
  )
  .replace(
    "export const DebugLogEnable = true;",
    "export const DebugLogEnable = false;",
  )
  .replace(
    "export const CubismLoggingLevel: LogLevel = LogLevel.LogLevel_Verbose;",
    "export const CubismLoggingLevel: LogLevel = LogLevel.LogLevel_Warning;",
  );
await writeFile(definePath, defineSource);

const subdelegatePath = join(workRoot, "src", "lappsubdelegate.ts");
let subdelegate = await readFile(subdelegatePath, "utf8");
subdelegate = subdelegate
  .replace(
    "gl.clearColor(0.0, 0.0, 0.0, 1.0);",
    "gl.clearColor(0.0, 0.0, 0.0, 0.0);",
  )
  .replace(
    "    this._view.initializeSprite();",
    "    this._view.initializeSprite();",
  )
  .replace(
    "    this._view.initializeSprite();\n  }",
    "    this._view.initializeSprite();\n  }",
  );
await writeFile(subdelegatePath, subdelegate);

const viewPath = join(workRoot, "src", "lappview.ts");
let view = await readFile(viewPath, "utf8");
view = view
  .replace("    this._gear.release();", "    this._gear?.release();")
  .replace("    this._back.release();", "    this._back?.release();")
  .replace(
    /  public initializeSprite\(\): void \{[\s\S]*?\n  \}\n\n  \/\*\*\n   \*[^\n]*\n   \*\n   \* @param pointX/,
    `  public initializeSprite(): void {\n    if (this._programId == null) {\n      this._programId = this._subdelegate.createShader();\n    }\n  }\n\n  /**\n   * Touch start.\n   *\n   * @param pointX`,
  )
  .replace(
    "    if (this._gear.isHit(posX, posY)) {",
    "    if (this._gear?.isHit(posX, posY)) {",
  );
await writeFile(viewPath, view);

const modelPath = join(workRoot, "src", "lappmodel.ts");
let modelSource = await readFile(modelPath, "utf8");
modelSource = modelSource
  .replace(
    "            this._state = LoadStep.CompleteSetup;",
    "            this._state = LoadStep.CompleteSetup;\n            (window as any).__moriRendererReady?.();",
  )
  .replace(
    "    if (this._motionManager.isFinished()) {",
    "    const moriState = (window as any).__moriState;\n    const moriAnimated = !moriState?.paused && !moriState?.reducedMotion && !moriState?.crisis;\n    if (!moriAnimated) {\n      this._motionManager.stopAllMotions();\n    } else if (this._motionManager.isFinished()) {",
  )
  .replace(
    "    this._updateScheduler.onLateUpdate(this._model, deltaTimeSeconds);",
    `    if (moriAnimated) {\n      this._updateScheduler.onLateUpdate(this._model, deltaTimeSeconds);\n    }\n    if (moriAnimated && moriState?.state === 'speaking') {\n      const mouth = CubismFramework.getIdManager().getId(CubismDefaultParameterId.ParamMouthOpenY);\n      this._model.addParameterValueById(mouth, 0.12 + Math.abs(Math.sin(this._userTimeSeconds * 5.2)) * 0.22, 0.6);\n    }\n    if (moriAnimated && moriState?.state === 'listening') {\n      this._model.addParameterValueById(this._idParamAngleY, -2.0, 0.25);\n    } else if (moriAnimated && moriState?.state === 'thinking') {\n      this._model.addParameterValueById(this._idParamAngleX, 3.0, 0.25);\n    }`,
  );
await writeFile(modelPath, modelSource);

await writeFile(
  join(workRoot, "src", "main.ts"),
  `import { LAppDelegate } from './lappdelegate';\nimport * as LAppDefine from './lappdefine';\n\ntype State = 'idle'|'listening'|'thinking'|'speaking'|'resting'|'error';\ntype RuntimeState = { state: State; reducedMotion: boolean; crisis: boolean; paused: boolean; visible: boolean };\nconst startedAt = performance.now();\nconst validStates = new Set<State>(['idle','listening','thinking','speaking','resting','error']);\nconst emotional = new Set(['angry','blushing','cry','dizzy','love','star','sullen_face','tiger_tooth']);\nconst expressionByState: Partial<Record<State,string>> = { listening:'blushing', thinking:'sullen_face', speaking:'tiger_tooth', error:'cry' };\nconst runtime: RuntimeState = { state:'idle', reducedMotion:false, crisis:false, paused:false, visible:true };\n(window as any).__moriState = runtime;\nconst emit = (event: object) => {\n  const payload = JSON.stringify({ version: 1, ...event });\n  (window as any).ReactNativeWebView?.postMessage(payload);\n  window.dispatchEvent(new CustomEvent('mori-renderer-event', { detail: payload }));\n};\nconst fail = (code: string, error: unknown) => emit({ type:'error', code, message: error instanceof Error ? error.message : String(error) });\nconst model = (): any => {\n  const delegate: any = LAppDelegate.getInstance();\n  return delegate._subdelegates?.[0]?.getLive2DManager()?._models?.[0];\n};\nconst applyExpression = (name: string | null) => {\n  const current = model();\n  if (!current) return;\n  if (!name) { current._expressionManager?.stopAllMotions(); return; }\n  if (emotional.has(name)) current.setExpression(name);\n};\nconst receive = (raw: unknown) => {\n  try {\n    const command = typeof raw === 'string' ? JSON.parse(raw) : raw;\n    if (!command || command.version !== 1 || typeof command.type !== 'string') return;\n    if (command.type === 'setState' && validStates.has(command.state) && typeof command.reducedMotion === 'boolean' && typeof command.crisis === 'boolean') {\n      runtime.state = command.crisis ? 'resting' : command.state; runtime.reducedMotion = command.reducedMotion; runtime.crisis = command.crisis;\n      applyExpression(runtime.reducedMotion || runtime.crisis ? null : expressionByState[runtime.state] || null);\n      emit({ type:'stateChanged', state:runtime.state });\n    } else if (command.type === 'playExpression' && emotional.has(command.expression) && !runtime.reducedMotion && !runtime.crisis) {\n      applyExpression(command.expression);\n    } else if (command.type === 'pause' && typeof command.paused === 'boolean') { runtime.paused = command.paused; }\n    else if (command.type === 'setVisibility' && typeof command.visible === 'boolean') { runtime.visible = command.visible; const canvas = document.querySelector('canvas'); if (canvas) canvas.style.visibility = command.visible ? 'visible' : 'hidden'; }\n  } catch (error) { fail('INVALID_COMMAND', error); }\n};\n(window as any).__moriReceive = receive;\nwindow.addEventListener('message', (event) => receive(event.data));\ndocument.addEventListener('message', (event: any) => receive(event.data));\nwindow.addEventListener('error', (event) => fail('RUNTIME_ERROR', event.error || event.message));\nwindow.addEventListener('unhandledrejection', (event) => fail('UNHANDLED_REJECTION', event.reason));\nlet ready = false;\n(window as any).__moriRendererReady = () => { if (ready) return; ready = true; const gl = document.querySelector('canvas')?.getContext('webgl'); const version = (window as any).Live2DCubismCore?.Version?.csmGetVersion?.(); emit({ type:'ready', loadMs:Math.round(performance.now()-startedAt), coreVersion:String(version ?? 'unknown'), webgl:String(gl?.getParameter(gl.VERSION) ?? 'unknown') }); };\nwindow.addEventListener('load', () => { try { if (!LAppDelegate.getInstance().initialize()) throw new Error('WebGL initialization failed'); LAppDelegate.getInstance().run(); } catch (error) { fail('INITIALIZATION_FAILED', error); } }, { passive:true });\nwindow.addEventListener('beforeunload', () => LAppDelegate.releaseInstance(), { passive:true });\nlet frames = 0; let lastMetric = performance.now(); const metricFrame = () => { frames++; const now = performance.now(); if (now-lastMetric >= 5000) { const memory = (performance as any).memory; emit({ type:'metrics', fps:Math.round(frames*1000/(now-lastMetric)), ...(memory ? { heapBytes:memory.usedJSHeapSize } : {}) }); frames=0; lastMetric=now; } requestAnimationFrame(metricFrame); }; requestAnimationFrame(metricFrame);\n`,
);

const bridgePath = join(workRoot, "src", "main.ts");
const bridgeSource = (await readFile(bridgePath, "utf8")).replace(
  "const gl = document.querySelector('canvas')?.getContext('webgl');",
  "const canvas = document.querySelector('canvas'); const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');",
);
await writeFile(bridgePath, bridgeSource);

const runNpm = (args) =>
  process.platform === "win32"
    ? spawnSync(
        process.env.ComSpec || "cmd.exe",
        ["/d", "/s", "/c", `npm ${args.join(" ")}`],
        {
          cwd: workRoot,
          stdio: "inherit",
        },
      )
    : spawnSync("npm", args, { cwd: workRoot, stdio: "inherit" });
const install = runNpm(["ci", "--ignore-scripts"]);
if (install.status !== 0)
  throw new Error("Failed to install the official sample build dependencies.");
const build = runNpm(["exec", "vite", "--", "build"]);
if (build.status !== 0)
  throw new Error("Failed to build the private Live2D renderer.");
await cp(join(workRoot, "dist"), distRoot, { recursive: true });
const stats = {
  sdk: "CubismSdkForWeb-5-r.5",
  modelVersion: model.Version,
  expressions: references.Expressions.length,
  motions: references.Motions.Idle.length,
  textures: references.Textures.length,
  generatedAt: new Date().toISOString(),
};
await writeFile(
  join(distRoot, "renderer-manifest.json"),
  JSON.stringify(stats, null, 2),
);
console.log(JSON.stringify({ output: distRoot, ...stats }, null, 2));
