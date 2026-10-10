# Mori Live2D integration experiment — Snow Neko

**Status: asset package prepared; model rendering on Android NOT yet verified.**

The user-provided Snow Neko model is Live2D Cubism 3+ format: `snow neko.moc3`, four 4096×4096 textures, `snow neko.physics3.json`, `snow neko.cdi3.json`, 33 `.exp3.json` expression files and one `.motion3.json` file. The original `.model3.json` did not register motion/expression entries. The local-only asset package patches **only the manifest** to expose the existing expressions/motion.

## Security and licensing

Even with model-usage permission, do not commit proprietary `.moc3` files or textures to this public repository. Verify the separate Live2D Cubism SDK/Core runtime licensing and any distribution restrictions. This branch intentionally contains **no model assets** and **no proprietary Cubism runtime**.

## Inspect local assets

Extract `snow-neko-live2d-assets.zip` privately; run from the repository root:

```sh
node scripts/validate-live2d.mjs "/absolute/path/snow-neko/snow neko.model3.json"
```

The ZIP must be downloaded locally and never uploaded to the repository. The model runtime itself must be acquired separately under the appropriate official Live2D license.

## Integration gate (not yet met)

1. Obtain official Cubism SDK for Web **and compatible Cubism Core**.
2. Check `.moc3` compatibility and load `snow neko.model3.json` inside a standalone local HTML/WebGL test (serve via localhost; avoid `file://` asset loading/CORS).
3. Verify 33 expressions, physics, animation and transparent canvas; not all expressions denote emotions (some change hair/accessories).
4. Benchmark four 4K textures and approximately 10 MB `.moc3`; a raw RGBA8 decode of all four textures is approximately 256 MiB without renderer overhead.
5. Only after standalone renderer works, install Expo-compatible `react-native-webview` using Expo/npm and **commit the generated lockfile**. Do not guess lockfile integrity fields.
6. Package HTML, assets and runtime using an explicit platform-compatible asset URL scheme; do not assume a WebView can resolve React Native Metro asset URLs. Use a strict allowlist for typed message commands (`setState`, `playExpression`, `pause`); disable unnecessary navigation and network loading.
7. Add a user-controlled avatar display to normal and private chat; wire to `idle/listening/thinking/speaking` state based on UI transitions, never by replacing safety/AI orchestration. No audio lip-sync claim without TTS/audio evidence. Reduced motion and crisis-safe no-animation are required.
8. Verify on an **Android development client or preview APK**; browser rendering is insufficient.

## Known compatibility notes

- `FileReferences.Groups.LipSync.Ids` is empty. `ParamMouthOpenY` is present but no lip-sync engine exists yet.
- One motion is insufficient to promise multiple distinct animations.
- The provided ZIP does **not** contain Live2D Cubism Core or the official SDK.
- Never claim the actual model renders until measured with the real runtime and device.

## Suggested next step

Request/use a properly licensed Cubism Core SDK package, implement a standalone renderer under `apps/mobile/live2d-runtime`, validate it outside the app, then integrate via an Expo-compatible WebView with tests. Keep this as an isolated experimental branch until real-device evidence is available.
