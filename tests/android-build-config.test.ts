const mobileConfig = require("../apps/mobile/app.config.js") as () => {
  name: string;
  scheme: string;
  android: { package: string };
  ios: { bundleIdentifier: string };
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
  "EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
] as const;
const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of keys) {
    const value = original[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("isolated Demo QA configuration", () => {
  beforeEach(() => {
    for (const key of keys) delete process.env[key];
    process.env.EAS_BUILD_PROFILE = "demo-qa";
    process.env.EXPO_PUBLIC_DEMO_MODE = "true";
  });
  it("uses a separate identity without an EAS account or service credentials", () => {
    expect(mobileConfig()).toMatchObject({
      name: "Mori Demo QA",
      scheme: "mori-demo-qa",
      android: { package: "app.mori.companion.demoqa" },
      ios: { bundleIdentifier: "app.mori.companion.demoqa" },
      extra: { environment: "demo-qa" },
    });
    expect(mobileConfig().extra?.eas).toBeUndefined();
  });
  it.each([undefined, "false"])(
    "rejects implicit or Connected mode (%s)",
    (mode) => {
      if (mode === undefined) delete process.env.EXPO_PUBLIC_DEMO_MODE;
      else process.env.EXPO_PUBLIC_DEMO_MODE = mode;
      expect(() => mobileConfig()).toThrow("explicit demo mode");
    },
  );
  it.each([
    "EXPO_PUBLIC_API_URL",
    "EXPO_PUBLIC_SUPABASE_URL",
    "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  ])("rejects mixed service configuration: %s", (key) => {
    process.env[key] = "accidental-connected-value";
    expect(() => mobileConfig()).toThrow("Connected service configuration");
  });
  it.each(["preview", "production"])(
    "keeps %s separate and refuses Demo Mode",
    (profile) => {
      process.env.EAS_BUILD_PROFILE = profile;
      process.env.EAS_PROJECT_ID = "123e4567-e89b-42d3-a456-426614174000";
      expect(() => mobileConfig()).toThrow("must disable demo mode");
      process.env.EXPO_PUBLIC_DEMO_MODE = "false";
      process.env.EXPO_PUBLIC_API_URL = "https://api.example.com";
      process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_synthetic";
      expect(mobileConfig()).toMatchObject({
        name: "Mori",
        scheme: "mori",
        android: { package: "app.mori.companion" },
      });
    },
  );
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
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_synthetic";

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
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_synthetic";

    expect(mobileConfig().extra?.eas?.projectId).toBe(
      process.env.EAS_BUILD_PROJECT_ID,
    );
  });
});

describe("Connected credential boundaries", () => {
  const token = (claims: object) =>
    `e30.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.synthetic`;
  beforeEach(() => {
    for (const key of keys) delete process.env[key];
    Object.assign(process.env, {
      EAS_BUILD_PROFILE: "preview",
      EAS_PROJECT_ID: "123e4567-e89b-42d3-a456-426614174000",
      EXPO_PUBLIC_DEMO_MODE: "false",
      EXPO_PUBLIC_API_URL: "https://api-staging.example.com",
      EXPO_PUBLIC_SUPABASE_URL: "https://staging.supabase.co",
    });
  });
  it("accepts matching anon metadata without embedding the token in config", () => {
    const key = token({ role: "anon", ref: "staging", exp: 4102444800 });
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = key;
    expect(JSON.stringify(mobileConfig())).not.toContain(key);
  });
  it.each([
    token({ role: "service_role", ref: "staging" }),
    token({ role: "anon", ref: "another-project" }),
    token({ role: "anon", ref: "staging", exp: 1 }),
    "sb_secret_synthetic",
    "malformed-private-key",
  ])(
    "rejects private, mismatched, expired or malformed key %# without echoing it",
    (key) => {
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = key;
      expect(() => mobileConfig()).toThrow();
      try {
        mobileConfig();
      } catch (error) {
        expect(String(error)).not.toContain(key);
      }
    },
  );
  it("rejects an additional Expo public service-role variable", () => {
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_synthetic";
    process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY = "private-synthetic";
    expect(() => mobileConfig()).toThrow("server secrets");
  });
});
