import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const required = [
  "STAGING_API_URL",
  "SUPABASE_INTEGRATION_URL",
  "SUPABASE_INTEGRATION_ANON_KEY",
  "SUPABASE_INTEGRATION_SERVICE_ROLE_KEY",
  "LLM_BASE_URL",
  "LLM_API_KEY",
  "LLM_MODEL",
  "LLM_EMBEDDING_MODEL",
];

const results = [];
const pass = (name) => {
  results.push({ name, ok: true });
  console.log(`PASS ${name}`);
};
const fail = (name, error) => {
  results.push({ name, ok: false });
  const reason = error instanceof Error ? error.message : "unknown error";
  console.error(`FAIL ${name}: ${reason}`);
};
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const timeout = (milliseconds = 30_000) => AbortSignal.timeout(milliseconds);

async function providerPost(path, body) {
  const response = await fetch(
    `${process.env.LLM_BASE_URL.replace(/\/$/, "")}/${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.LLM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: timeout(),
    },
  );
  if (!response.ok)
    throw new Error(`provider returned HTTP ${response.status}`);
  return response.json();
}

async function main() {
  if (!["development", "staging"].includes(process.env.STAGING_TARGET ?? "")) {
    throw new Error(
      "STAGING_TARGET must be development or staging; production is refused",
    );
  }
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length)
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );

  const url = process.env.SUPABASE_INTEGRATION_URL;
  const anon = process.env.SUPABASE_INTEGRATION_ANON_KEY;
  const serviceKey = process.env.SUPABASE_INTEGRATION_SERVICE_ROLE_KEY;
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let userId;

  try {
    const migrationProbe = await admin
      .from("data_export_audits")
      .select("id", { head: true, count: "exact" });
    if (migrationProbe.error) throw migrationProbe.error;
    pass("Supabase");

    const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    const email = `mori-health-${stamp}@example.test`;
    const password = `Mori-health-${randomUUID()}-Aa9!`;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user)
      throw created.error ?? new Error("synthetic user creation failed");
    userId = created.data.user.id;
    const signedIn = await client.auth.signInWithPassword({ email, password });
    if (signedIn.error || !signedIn.data.session)
      throw signedIn.error ?? new Error("synthetic login failed");
    pass("Auth");

    const profile = await client
      .from("profiles")
      .select("user_id")
      .eq("user_id", userId)
      .single();
    if (profile.error || profile.data?.user_id !== userId)
      throw profile.error ?? new Error("provisioned profile was not readable");
    pass("Database");

    const clientId = randomUUID();
    const apiResponse = await fetch(
      `${process.env.STAGING_API_URL.replace(/\/$/, "")}/moods`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${signedIn.data.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mood: "okay",
          intensity: 0.5,
          tags: ["synthetic-health-check"],
          client_id: clientId,
          user_id: randomUUID(),
        }),
        signal: timeout(),
      },
    );
    if (!apiResponse.ok)
      throw new Error(`API returned HTTP ${apiResponse.status}`);
    const ownedMood = await admin
      .from("mood_entries")
      .select("user_id")
      .eq("client_id", clientId)
      .single();
    if (ownedMood.error || ownedMood.data?.user_id !== userId)
      throw (
        ownedMood.error ?? new Error("API did not enforce verified ownership")
      );
    pass("API");

    const chat = await providerPost("chat/completions", {
      model: process.env.LLM_MODEL,
      messages: [
        {
          role: "user",
          content: "Synthetic health check. Reply with the single word OK.",
        },
      ],
      temperature: 0,
      max_tokens: 8,
    });
    assert(
      typeof chat?.choices?.[0]?.message?.content === "string" &&
        chat.choices[0].message.content.trim().length > 0,
      "LLM returned an invalid response envelope",
    );
    const structured = await providerPost("chat/completions", {
      model: process.env.LLM_MODEL,
      messages: [
        {
          role: "system",
          content: 'Return only valid JSON with this shape: {"ok":true}.',
        },
        { role: "user", content: "Synthetic structured health check." },
      ],
      temperature: 0,
      max_tokens: 20,
    });
    const structuredText = structured?.choices?.[0]?.message?.content;
    assert(
      typeof structuredText === "string",
      "structured LLM response is missing",
    );
    const unwrapped = structuredText
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    assert(
      JSON.parse(unwrapped).ok === true,
      "structured LLM response is invalid",
    );
    pass("LLM");

    const embedding = await providerPost("embeddings", {
      model: process.env.LLM_EMBEDDING_MODEL,
      input: "synthetic health check",
      dimensions: 1536,
    });
    assert(
      Array.isArray(embedding?.data?.[0]?.embedding) &&
        embedding.data[0].embedding.length === 1536,
      "embedding response must contain exactly 1536 dimensions",
    );
    pass("Embedding");
  } catch (error) {
    const completed = new Set(results.map((result) => result.name));
    const next = [
      "Supabase",
      "Auth",
      "Database",
      "API",
      "LLM",
      "Embedding",
    ].find((name) => !completed.has(name));
    fail(next ?? "Verification", error);
  } finally {
    if (userId) {
      const deleted = await admin.auth.admin.deleteUser(userId);
      if (deleted.error)
        fail("Cleanup", new Error("synthetic user cleanup failed"));
    }
  }

  if (results.some((result) => !result.ok)) process.exitCode = 1;
}

main().catch((error) => {
  fail("Configuration", error);
  process.exitCode = 1;
});
