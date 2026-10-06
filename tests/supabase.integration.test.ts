import { createClient, SupabaseClient } from "@supabase/supabase-js";

const enabled = process.env.RUN_SUPABASE_INTEGRATION_TESTS === "true";
const integration = enabled ? describe : describe.skip;

integration("real Supabase Auth and RLS", () => {
  const url = process.env.SUPABASE_INTEGRATION_URL!;
  const anon = process.env.SUPABASE_INTEGRATION_ANON_KEY!;
  const serviceKey = process.env.SUPABASE_INTEGRATION_SERVICE_ROLE_KEY!;
  let admin: SupabaseClient;
  let userA: SupabaseClient;
  let userB: SupabaseClient;
  let idA = "";
  let idB = "";
  let emailA = "";
  const password = `Mori-${Date.now()}-Aa9!`;

  beforeAll(async () => {
    if (!url || !anon || !serviceKey)
      throw new Error("Supabase integration environment is incomplete");
    admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    emailA = `mori-a-${stamp}@example.test`;
    const emailB = `mori-b-${stamp}@example.test`;
    const createdA = await admin.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
    });
    const createdB = await admin.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
    });
    idA = createdA.data.user?.id ?? "";
    idB = createdB.data.user?.id ?? "";
    if (
      createdA.error ||
      createdB.error ||
      !createdA.data.user ||
      !createdB.data.user
    )
      throw (
        createdA.error ?? createdB.error ?? new Error("User creation failed")
      );
    userA = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    userB = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const loginA = await userA.auth.signInWithPassword({
      email: emailA,
      password,
    });
    const loginB = await userB.auth.signInWithPassword({
      email: emailB,
      password,
    });
    if (loginA.error || loginB.error) throw loginA.error ?? loginB.error;
    const writes = await Promise.all([
      admin.from("journals").insert({
        user_id: idB,
        title: "private B",
        content: "private",
        source: "manual",
        client_id: crypto.randomUUID(),
      }),
      admin.from("memories").insert({
        user_id: idB,
        content: "private B",
        category: "preference",
        approved_by_user: true,
      }),
      admin.from("conversations").insert({ user_id: idB, title: "private B" }),
      admin.from("mood_entries").insert({
        user_id: idB,
        mood: "okay",
        intensity: 0.5,
        client_id: crypto.randomUUID(),
      }),
    ]);
    const failed = writes.find((write) => write.error);
    if (failed?.error) throw failed.error;
  }, 30_000);

  afterAll(async () => {
    if (idA) await admin.auth.admin.deleteUser(idA);
    if (idB) await admin.auth.admin.deleteUser(idB);
  });

  test("signup trigger provisions application rows", async () => {
    for (const table of [
      "profiles",
      "garden_states",
      "notification_preferences",
    ]) {
      const result = await admin
        .from(table)
        .select("user_id")
        .eq("user_id", idA)
        .single();
      expect(result.error).toBeNull();
      expect(result.data?.user_id).toBe(idA);
    }
  });

  test("login session can be refreshed and logout clears it", async () => {
    const refreshed = await userA.auth.refreshSession();
    expect(refreshed.error).toBeNull();
    expect(refreshed.data.session?.user.id).toBe(idA);
    expect((await userA.auth.signOut()).error).toBeNull();
    expect((await userA.auth.getSession()).data.session).toBeNull();
  });

  test.each([
    "profiles",
    "journals",
    "memories",
    "conversations",
    "mood_entries",
  ])("User A cannot read User B %s", async (table) => {
    await userA.auth.signInWithPassword({ email: emailA, password });
    const result = await userA.from(table).select("*").eq("user_id", idB);
    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  test("account deletion cascades application data", async () => {
    const deleted = await admin.auth.admin.deleteUser(idB);
    expect(deleted.error).toBeNull();
    for (const table of [
      "profiles",
      "journals",
      "memories",
      "conversations",
      "mood_entries",
      "garden_states",
      "notification_preferences",
    ]) {
      const result = await admin
        .from(table)
        .select("user_id")
        .eq("user_id", idB);
      expect(result.error).toBeNull();
      expect(result.data).toEqual([]);
    }
    idB = "";
  });
});
