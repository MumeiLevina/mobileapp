import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { validateStagingConfig } from "./preflight-staging.mjs";
import {
  STAGING_REQUIRED_TABLES,
  STAGING_SCHEMA_LABEL,
  verifyRequiredSchema,
} from "./staging-required-schema.mjs";

const timeout = (milliseconds = 30_000) => AbortSignal.timeout(milliseconds);
const baseApi = () => process.env.STAGING_API_URL.replace(/\/$/, "");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const count = async (admin, table, userId) => {
  const result = await admin
    .from(table)
    .select("*", { head: true, count: "exact" })
    .eq("user_id", userId);
  if (result.error) throw result.error;
  return result.count ?? 0;
};

async function providerPost(path, body, timeoutMs) {
  const response = await fetch(
    `${process.env.LLM_BASE_URL.replace(/\/$/, "")}/${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.LLM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: timeout(timeoutMs),
    },
  );
  if (!response.ok)
    throw new Error(`provider returned HTTP ${response.status}`);
  return response.json();
}

async function main() {
  const configErrors = validateStagingConfig(process.env);
  if (configErrors.length)
    throw new Error(
      `unsafe or incomplete staging configuration: ${configErrors.join("; ")}`,
    );

  const admin = createClient(
    process.env.SUPABASE_INTEGRATION_URL,
    process.env.SUPABASE_INTEGRATION_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const client = createClient(
    process.env.SUPABASE_INTEGRATION_URL,
    process.env.SUPABASE_INTEGRATION_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  let userId;
  let accessToken;
  let currentStage = "schema";
  let accountDeleted = false;
  const pass = (name) => console.log(`PASS ${name}`);
  const api = async (path, method = "GET", body) => {
    const response = await fetch(`${baseApi()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: timeout(),
    });
    if (!response.ok)
      throw new Error(`${method} ${path} returned HTTP ${response.status}`);
    return response.json();
  };

  try {
    const schema = await verifyRequiredSchema(admin);
    assert(
      schema.compatible,
      `missing required tables: ${schema.missing.join(", ")}`,
    );
    pass(`schema: ${STAGING_SCHEMA_LABEL}`);

    currentStage = "auth and provisioning";
    const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    const email = `mori-validation-${stamp}@example.test`;
    const password = `Mori-validation-${randomUUID()}-Aa9!`;
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
    const refreshed = await client.auth.refreshSession({
      refresh_token: signedIn.data.session.refresh_token,
    });
    if (refreshed.error || !refreshed.data.session)
      throw refreshed.error ?? new Error("session refresh failed");
    accessToken = refreshed.data.session.access_token;
    for (const table of [
      "profiles",
      "garden_states",
      "notification_preferences",
    ]) {
      const provisioned = await admin
        .from(table)
        .select("user_id")
        .eq("user_id", userId)
        .single();
      if (provisioned.error || provisioned.data?.user_id !== userId)
        throw provisioned.error ?? new Error(`${table} was not provisioned`);
    }
    pass("auth: login, refresh and provisioning");

    currentStage = "API ownership";
    const moodClientId = randomUUID();
    await api("/moods", "POST", {
      mood: "okay",
      intensity: 0.5,
      tags: ["synthetic-validation"],
      client_id: moodClientId,
      user_id: randomUUID(),
    });
    const ownedMood = await admin
      .from("mood_entries")
      .select("user_id")
      .eq("client_id", moodClientId)
      .single();
    if (ownedMood.error || ownedMood.data?.user_id !== userId)
      throw (
        ownedMood.error ?? new Error("verified API ownership was not enforced")
      );
    pass("API ownership");

    currentStage = "Wave 3 API";
    const goalClientId = randomUUID();
    const goal = await api("/soft-goals", "POST", {
      title: "Synthetic staging goal",
      note: "Validation only",
      client_id: goalClientId,
      user_id: randomUUID(),
    });
    assert(
      goal?.user_id === userId && goal?.id,
      "soft goal ownership is invalid",
    );
    const completedGoal = await api(`/soft-goals/${goal.id}/complete`, "POST");
    assert(completedGoal?.status === "completed", "soft goal did not complete");
    const goals = await api("/soft-goals");
    assert(
      Array.isArray(goals) && goals.some((item) => item.id === goal.id),
      "soft goal list is missing the created item",
    );

    const letter = await api("/letters", "POST", {
      title: "Synthetic staging letter",
      content: "Synthetic private validation content",
      open_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      client_id: randomUUID(),
    });
    assert(
      letter?.user_id === userId && letter?.id,
      "letter ownership is invalid",
    );
    const letters = await api("/letters");
    const letterSummary = Array.isArray(letters)
      ? letters.find((item) => item.id === letter.id)
      : undefined;
    assert(
      letterSummary && !("content" in letterSummary),
      "letter list exposed private content",
    );
    const garden = await api("/garden");
    assert(
      Array.isArray(garden?.sanctuary_areas),
      "garden response is invalid",
    );
    assert(
      garden.sanctuary_areas.includes("path_stones"),
      "soft-goal garden unlock is missing",
    );
    assert(
      garden.sanctuary_areas.includes("letter_tree"),
      "letter garden unlock is missing",
    );
    pass("Wave 3 API: goal, letter and garden");

    currentStage = "private conversation";
    const privateTables = ["conversations", "messages", "memories"];
    const beforeCounts = Object.fromEntries(
      await Promise.all(
        privateTables.map(async (table) => [
          table,
          await count(admin, table, userId),
        ]),
      ),
    );
    const beforeGarden = await admin
      .from("garden_states")
      .select("growth_points")
      .eq("user_id", userId)
      .single();
    if (beforeGarden.error) throw beforeGarden.error;
    const beforeTimeline = await api("/reflections/timeline");
    const userMessageId = randomUUID();
    const privateReply = await api("/private-conversations/messages", "POST", {
      content: "Synthetic private staging message",
      mode: "listen",
      client_id: randomUUID(),
      history: [],
    });
    assert(
      privateReply?.message?.id && privateReply?.message?.content,
      "private reply is invalid",
    );
    for (const table of privateTables)
      assert(
        (await count(admin, table, userId)) === beforeCounts[table],
        `private send persisted ${table}`,
      );
    const unchangedGarden = await admin
      .from("garden_states")
      .select("growth_points")
      .eq("user_id", userId)
      .single();
    if (unchangedGarden.error) throw unchangedGarden.error;
    assert(
      unchangedGarden.data.growth_points === beforeGarden.data.growth_points,
      "private send changed garden growth",
    );
    const unchangedTimeline = await api("/reflections/timeline");
    assert(
      Array.isArray(beforeTimeline) &&
        unchangedTimeline.length === beforeTimeline.length,
      "private send changed timeline",
    );

    const saveClientId = randomUUID();
    const saveBody = {
      client_id: saveClientId,
      mode: "listen",
      messages: [
        {
          id: userMessageId,
          role: "user",
          content: "Synthetic private staging message",
        },
        privateReply.message,
      ],
    };
    const saved = await api("/private-conversations/save", "POST", saveBody);
    const retried = await api("/private-conversations/save", "POST", saveBody);
    assert(
      saved?.id && retried?.id === saved.id,
      "private save retry created another conversation",
    );
    const savedConversations = await admin
      .from("conversations")
      .select("id")
      .eq("user_id", userId)
      .eq("client_id", saveClientId);
    if (savedConversations.error) throw savedConversations.error;
    assert(
      savedConversations.data.length === 1,
      "private session was not converted exactly once",
    );
    const savedMessages = await admin
      .from("messages")
      .select("id")
      .eq("user_id", userId)
      .eq("conversation_id", saved.id);
    if (savedMessages.error) throw savedMessages.error;
    assert(
      savedMessages.data.length === 2,
      "private save retry duplicated messages",
    );
    pass("private conversation: ephemeral send and idempotent explicit save");

    currentStage = "export v6";
    const exported = await api("/account/export", "POST");
    assert(
      exported?.schemaVersion === 6 && exported?.data,
      "account export is not schema v6",
    );
    for (const key of [
      "profile",
      "moods",
      "journals",
      "memories",
      "conversations",
      "messages",
      "selfCareHistory",
      "garden",
      "weeklyReflections",
      "notificationPreferences",
      "lifeMapItems",
      "memorySources",
      "ritualEntries",
      "letters",
      "softGoals",
      "gardenUnlocks",
      "personalMilestones",
    ])
      assert(key in exported.data, `account export is missing ${key}`);
    const exportText = JSON.stringify(exported);
    for (const forbidden of [
      "embedding",
      "safety_level",
      "action_key",
      "user_id",
      "data_export_audits",
    ])
      assert(
        !exportText.includes(`\"${forbidden}\"`),
        `account export exposed ${forbidden}`,
      );
    pass("export v6 shape and privacy allowlist");

    currentStage = "provider text and structured output";
    const chat = await providerPost(
      "chat/completions",
      {
        model: process.env.LLM_MODEL,
        messages: [
          { role: "user", content: "Synthetic health check. Reply with OK." },
        ],
        temperature: 0,
        max_tokens: 8,
      },
      Number(process.env.LLM_TEXT_TIMEOUT_MS),
    );
    assert(
      typeof chat?.choices?.[0]?.message?.content === "string" &&
        chat.choices[0].message.content.trim(),
      "LLM text response is invalid",
    );
    const structured = await providerPost(
      "chat/completions",
      {
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
      },
      Number(process.env.LLM_CLASSIFICATION_TIMEOUT_MS),
    );
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
    pass("provider text and structured output");

    currentStage = "provider embedding";
    const embedding = await providerPost(
      "embeddings",
      {
        model: process.env.LLM_EMBEDDING_MODEL,
        input: "synthetic health check",
        dimensions: 1536,
      },
      Number(process.env.LLM_EMBEDDING_TIMEOUT_MS),
    );
    assert(
      Array.isArray(embedding?.data?.[0]?.embedding) &&
        embedding.data[0].embedding.length === 1536,
      "embedding response must contain exactly 1536 dimensions",
    );
    pass("provider embedding: 1536 dimensions");

    currentStage = "account deletion";
    const deletionToken = accessToken;
    const deletion = await api("/account", "DELETE");
    assert(deletion?.ok === true, "account deletion response is invalid");
    accountDeleted = true;
    for (const table of STAGING_REQUIRED_TABLES.filter(
      (table) => !["self_care_activities", "crisis_resources"].includes(table),
    )) {
      const ownerColumn = table === "users" ? "id" : "user_id";
      const remaining = await admin
        .from(table)
        .select("*", { head: true, count: "exact" })
        .eq(ownerColumn, userId);
      if (remaining.error) throw remaining.error;
      assert(
        (remaining.count ?? 0) === 0,
        `account deletion left rows in ${table}`,
      );
    }
    const authUser = await admin.auth.admin.getUserById(userId);
    assert(
      authUser.error || !authUser.data.user,
      "account deletion left the Auth user",
    );
    const rejected = await fetch(`${baseApi()}/profile`, {
      headers: { Authorization: `Bearer ${deletionToken}` },
      signal: timeout(),
    });
    assert(
      [401, 403].includes(rejected.status),
      "deleted session was still accepted",
    );
    pass("account deletion: Auth, data cascade and token rejection");
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    console.error(`FAIL ${currentStage}: ${reason}`);
    process.exitCode = 1;
  } finally {
    if (userId && !accountDeleted) {
      const deleted = await admin.auth.admin.deleteUser(userId);
      if (deleted.error) {
        console.error("FAIL cleanup: synthetic user cleanup failed");
        process.exitCode = 1;
      } else {
        pass("cleanup");
      }
    }
  }
}

main().catch((error) => {
  const reason = error instanceof Error ? error.message : "unknown error";
  console.error(`FAIL configuration: ${reason}`);
  process.exitCode = 1;
});
