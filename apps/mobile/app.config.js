const app = require("./app.json");
const { URL } = require("node:url");

const betaProfiles = new Set(["preview", "production"]);

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
  if (betaProfiles.has(profile)) {
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
    ...app.expo,
    extra: {
      ...app.expo.extra,
      environment: profile,
    },
  };
};
