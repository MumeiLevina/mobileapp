const { URL } = require("node:url");

const app = {
  name: "Mori",
  slug: "mori",
  scheme: "mori",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  runtimeVersion: { policy: "appVersion" },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "app.mori.companion",
    buildNumber: "1",
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: "app.mori.companion",
    versionCode: 1,
    blockedPermissions: [
      "android.permission.RECORD_AUDIO",
      "android.permission.CAMERA",
      "android.permission.READ_CONTACTS",
      "android.permission.WRITE_CONTACTS",
      "android.permission.GET_ACCOUNTS",
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.ACCESS_BACKGROUND_LOCATION",
    ],
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#F7F2E8",
    },
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-notifications",
    [
      "expo-splash-screen",
      {
        image: "./assets/icon.png",
        resizeMode: "contain",
        backgroundColor: "#F7F2E8",
      },
    ],
  ],
  web: { bundler: "metro", output: "single" },
  experiments: { typedRoutes: true },
};

const betaProfiles = new Set(["preview", "production"]);

function easProjectId() {
  const value = (
    process.env.EAS_PROJECT_ID ?? process.env.EAS_BUILD_PROJECT_ID
  )?.trim();
  if (!value) return undefined;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new Error("EAS_PROJECT_ID must be a valid Expo project UUID.");
  return value;
}

function requireRemoteUrl(name) {
  const value = process.env[name];
  if (!value)
    throw new Error(`${name} is required for preview/production builds.`);
  const url = new URL(value);
  if (url.protocol !== "https:")
    throw new Error(`${name} must use HTTPS for preview/production builds.`);
  if (["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname))
    throw new Error(`${name} cannot point to localhost in preview/production.`);
}

module.exports = () => {
  const profile = process.env.EAS_BUILD_PROFILE ?? "local";
  const projectId = easProjectId();
  if (betaProfiles.has(profile)) {
    if (!projectId)
      throw new Error(
        "EAS_PROJECT_ID is required for preview/production builds. Link the intended Mori Expo project before building.",
      );
    if (process.env.EXPO_PUBLIC_DEMO_MODE !== "false")
      throw new Error("Preview/production builds must disable demo mode.");
    requireRemoteUrl("EXPO_PUBLIC_API_URL");
    requireRemoteUrl("EXPO_PUBLIC_SUPABASE_URL");
    if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY)
      throw new Error(
        "EXPO_PUBLIC_SUPABASE_ANON_KEY is required for preview/production builds.",
      );
  }
  return {
    ...app,
    extra: {
      ...app.extra,
      environment: profile,
      ...(projectId ? { eas: { projectId } } : {}),
    },
  };
};
