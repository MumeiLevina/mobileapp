const mobileConfig = require("../apps/mobile/app.config.js") as () => {
  extra?: { environment?: string; eas?: { projectId?: string } };
};

const keys = [
  "EAS_BUILD_PROFILE",
  "EAS_BUILD_PROJECT_ID",
  "EAS_PROJECT_ID",
  "EXPO_PUBLIC_DEMO_MODE",
  "EXPO_PUBLIC_API_URL",
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
] as const;
const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of keys) {
    const value = original[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("Android preview configuration", () => {
  it("refuses an unlinked preview build", () => {
    process.env.EAS_BUILD_PROFILE = "preview";
    delete process.env.EAS_PROJECT_ID;
    expect(() => mobileConfig()).toThrow("EAS_PROJECT_ID is required");
  });

  it("resolves a connected preview without embedding server secrets", () => {
    process.env.EAS_BUILD_PROFILE = "preview";
    process.env.EAS_PROJECT_ID = "123e4567-e89b-42d3-a456-426614174000";
    process.env.EXPO_PUBLIC_DEMO_MODE = "false";
    process.env.EXPO_PUBLIC_API_URL = "https://api-staging.example.com";
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://staging.supabase.co";
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "public-anon-key";

    const config = mobileConfig();
    expect(config.extra).toEqual({
      environment: "preview",
      eas: { projectId: process.env.EAS_PROJECT_ID },
    });
    expect(JSON.stringify(config)).not.toContain("LLM_API_KEY");
    expect(JSON.stringify(config)).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("accepts the project ID supplied by the EAS cloud builder", () => {
    process.env.EAS_BUILD_PROFILE = "preview";
    delete process.env.EAS_PROJECT_ID;
    process.env.EAS_BUILD_PROJECT_ID = "123e4567-e89b-42d3-a456-426614174000";
    process.env.EXPO_PUBLIC_DEMO_MODE = "false";
    process.env.EXPO_PUBLIC_API_URL = "https://api-staging.example.com";
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://staging.supabase.co";
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "public-anon-key";

    expect(mobileConfig().extra?.eas?.projectId).toBe(
      process.env.EAS_BUILD_PROJECT_ID,
    );
  });
});
