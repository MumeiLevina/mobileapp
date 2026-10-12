# Mori Live2D integration experiment — Snow Neko

**Prototype status:** the standalone renderer is verified in headless Chromium. The debug APK builds, installs, and visibly renders Snow Neko in the Talk screen on an Android emulator. Physical-device testing is **NOT RUN**.

## Validated inputs

The private source directory used for validation was `C:\Users\hantu\.codex\mori`.

- Official Live2D Cubism SDK for Web: `5-r.5` (`cubism-info.yml`, created 2026-04-01).
- Snow Neko manifest version: `3`.
- Model: one `.moc3` file (10,227,136 bytes).
- Textures: four 4096×4096 PNG files.
- Physics: `snow neko.physics3.json`.
- Expressions: 33 registered files.
- Motions: one registered looping motion, `Idle/Scene1.motion3.json` (3.333 seconds, 30 fps).
- Eye blink: `ParamEyeLOpen` and `ParamEyeROpen`.
- Breathing and visual state parameters confirmed in display metadata: `ParamBreath`, `ParamAngleX`, `ParamAngleY`, `ParamAngleZ`, `ParamBodyAngleX`, and `ParamMouthOpenY`.
- Lip-sync group: empty. The speaking state is deliberately only a visual cue.

Every file referenced by the model manifest exists and uses a safe relative path. The official Core successfully loaded the MOC and rendered the model. No additional or invented motion is registered.

Appearance and accessory expressions are kept separate from emotional expressions. Conversational state can only request the emotional allowlist. Hair, outfit, microphone, watermark, and other appearance switches are never selected by the avatar controller.

## Private asset boundary

No model, texture, Cubism Framework copy, or Cubism Core binary is tracked by Git. `npm run live2d:prepare` copies the private inputs into `apps/mobile/.live2d-private`, builds there, and emits an ignored renderer distribution. The Expo config plugin copies that distribution to the ignored Android native project only when `MORI_LIVE2D_ENABLED=1`.

The APK necessarily contains the licensed model and Core binary. Do not upload the APK or generated native directory to a public repository. Confirm Live2D and model redistribution terms before sharing any build.

## Renderer evidence

`npm run live2d:verify` serves the private renderer only on loopback, launches Chromium, waits for the real texture-complete callback, requests the `speaking` state, captures a screenshot, and analyzes the PNG.

Latest local evidence:

- Renderer load: 1,876 ms in the latest run.
- Canvas: 480×640.
- Visible rendered pixels: 81,661.
- Five-second animation sample: 21 fps in headless Chromium using WebGL 2.0.
- Chromium JavaScript heap sample: approximately 60.3 MB (not total process/GPU memory).
- Failed asset requests: 0.
- Page errors: 0.
- Console errors: 0.
- Screenshot: `artifacts/live2d-standalone.png` (ignored).
- Machine-readable result: `artifacts/live2d-renderer-result.json` (ignored).

Browser evidence verifies model/Core compatibility and the renderer pipeline. It does not replace Android physical-device verification.

Latest Android emulator evidence:

- Debug APK build and install: passed on `emulator-5554` (x86_64).
- WebView renderer: visible Snow Neko frame captured after a reported 6,026 ms load.
- The previous Android error, `Fetch API cannot load file:///android_asset/...`, is no longer present.
- Process sample after loading the model: approximately 682 MB PSS / 880 MB RSS on the emulator. This includes the React Native app and WebView processes and is not representative of every physical device.
- Screenshot: `artifacts/android-avatar-70s.png` (ignored).

Four decoded 4096×4096 RGBA textures require approximately 256 MiB before renderer/model/WebView overhead. The built private Android asset payload is approximately 28.85 MB. The verifier reports a five-second FPS and Chromium JS heap sample when available; Android process/PSS memory still requires a device or emulator.

## Runtime behavior

The Talk conversation screen maps UI state without changing the AI orchestrator, memory permissions, safety classifier, or response guard:

- Empty composer: `idle`.
- User types: `listening`.
- Request pending: `thinking`.
- Successful response: temporary visual `speaking`, then `idle`.
- Request failure: `error`.
- Elevated/crisis response: `resting`, expressions and nonessential motion suppressed.

Eye blink, breath, physics, the single validated idle motion, emotional expression switching, and subtle parameter adjustments run inside one retained WebView instance. The renderer pauses when the app is backgrounded. Reduced motion stops motion, physics/breath updates, expressions, and the speaking mouth cue.

WebView commands and events are versioned and validated. On Android, an AndroidX `WebViewAssetLoader` exposes only packaged APK assets through the trusted internal origin `https://appassets.androidplatform.net/assets/`; this lets `fetch()` load the model manifest without enabling `file://` access. The page has a restrictive CSP, uses only packaged local files, disables DOM storage/file access/universal file access/mixed content, rejects navigation away from the packaged renderer, and falls back after a 60-second load timeout. The longer bound is intentional because the model has four 4096×4096 textures that are substantially slower to decode and upload on an emulator than in desktop Chromium.

## Exact local run instructions (PowerShell)

From the repository root:

```powershell
$env:MORI_LIVE2D_ROOT = 'C:\Users\hantu\.codex\mori'
npm install
npm run live2d:prepare
npm run live2d:verify
```

Prepare the native Android project and package the private renderer:

```powershell
$env:MORI_LIVE2D_ENABLED = '1'
node scripts/expo.mjs prebuild --platform android --clean --no-install
```

Build and install an x86_64 debug APK on the running emulator. Keep the Gradle cache path short on Windows to avoid the 260-character CMake/Ninja path limit:

```powershell
$env:ANDROID_HOME = 'C:\Users\hantu\AppData\Local\Android\Sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:GRADLE_USER_HOME = 'C:\g-mori'
Push-Location apps/mobile/android
.\gradlew.bat installDebug -PreactNativeArchitectures=x86_64
Pop-Location
```

The expected APK path is `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`.

To run with Metro after installing the development APK on an Android device/emulator:

```powershell
npm run dev:mobile
```

Do not use Expo Go for this prototype; use the generated development/debug build containing `react-native-webview` and the private Android assets.

## Remaining Android validation

1. Verify actual WebView rendering, state changes, keyboard layout, memory approval UI, crisis resources, navigation, background suspension, and show/hide behavior on a physical Android device.
2. Capture `adb shell dumpsys meminfo app.mori.companion` and a device frame profile on representative physical hardware after the model reaches idle.
3. Consider shipping downscaled private texture variants for lower-memory Android devices; the current four 4096×4096 textures have a large decoded/GPU footprint.
4. Keep the experiment branch isolated; do not merge to `main` until those physical-device regressions pass.

Wave 4 voice/TTS work is intentionally out of scope and has not been started.
