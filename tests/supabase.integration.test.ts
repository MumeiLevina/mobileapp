import { ExecutionContext } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { AuthGuard } from "../apps/api/src/common/auth.guard";
import { DatabaseService } from "../apps/api/src/database/database.service";

const enabled = process.env.RUN_SUPABASE_INTEGRATION_TESTS === "true";
const integration = enabled ? describe : describe.skip;

integration("real Supabase Auth, provisioning and RLS", () => {
  const url = process.env.SUPABASE_INTEGRATION_URL!;
  const anon = process.env.SUPABASE_INTEGRATION_ANON_KEY!;
  const serviceKey = process.env.SUPABASE_INTEGRATION_SERVICE_ROLE_KEY!;
  let admin: SupabaseClient;
  let userA: SupabaseClient;
  let userB: SupabaseClient;
  let idA = "";
  let idB = "";
  let emailA = "";
  let emailB = "";
  let accessTokenA = "";
  const password = `Mori-${Date.now()}-Aa9!`;

  async function ensureUserASession() {
    const current = await userA.auth.getSession();
    if (current.data.session) return;
    const login = await userA.auth.signInWithPassword({
      email: emailA,
      password,
    });
    if (login.error) throw login.error;
  }

  beforeAll(async () => {
    if (!url || !anon || !serviceKey)
      throw new Error("Supabase integration environment is incomplete");
    admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    userA = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    userB = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    emailA = `mori-signup-${stamp}@example.test`;
    emailB = `mori-b-${stamp}@example.test`;

    const signedUpA = await userA.auth.signUp({ email: emailA, password });
    if (signedUpA.error || !signedUpA.data.user)
      throw signedUpA.error ?? new Error("User A signup failed");
    idA = signedUpA.data.user.id;
    if (!signedUpA.data.session) {
      const confirmed = await admin.auth.admin.updateUserById(idA, {
        email_confirm: true,
      });
      if (confirmed.error) throw confirmed.error;
    }

    const createdB = await admin.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
    });
    if (createdB.error || !createdB.data.user)
      throw createdB.error ?? new Error("User B creation failed");
    idB = createdB.data.user.id;

    const loginA = await userA.auth.signInWithPassword({
      email: emailA,
      password,
    });
    const loginB = await userB.auth.signInWithPassword({
      email: emailB,
      password,
    });
    if (loginA.error || loginB.error) throw loginA.error ?? loginB.error;
    accessTokenA = loginA.data.session?.access_token ?? "";

    const conversation = await admin
      .from("conversations")
      .insert({ user_id: idB, title: "synthetic private B" })
      .select("id")
      .single();
    if (conversation.error) throw conversation.error;

    const writes = await Promise.all([
      admin.from("journals").insert({
        user_id: idB,
        title: "synthetic private B",
        content: "synthetic integration fixture",
        source: "manual",
        client_id: crypto.randomUUID(),
      }),
      admin.from("memories").insert({
        user_id: idB,
        content: "synthetic private B",
        category: "preference",
        approved_by_user: true,
      }),
      admin.from("messages").insert({
        user_id: idB,
        conversation_id: conversation.data.id,
        role: "user",
        content: "synthetic integration fixture",
        client_id: crypto.randomUUID(),
      }),
      admin.from("mood_entries").insert({
        user_id: idB,
        mood: "okay",
        intensity: 0.5,
        client_id: crypto.randomUUID(),
      }),
      admin.from("data_export_audits").insert({
        user_id: idB,
        status: "completed",
        record_counts: { journals: 1 },
        completed_at: new Date().toISOString(),
      }),
    ]);
    const failed = writes.find((write) => write.error);
    if (failed?.error) throw failed.error;
  }, 30_000);

  afterAll(async () => {
    if (idA) await admin.auth.admin.deleteUser(idA);
    if (idB) await admin.auth.admin.deleteUser(idB);
  });

  test("email/password signup provisions profile, garden and preferences", async () => {
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

  test("a real JWT is accepted by AuthGuard and supplies its verified subject", async () => {
    const request = {
      headers: { authorization: `Bearer ${accessTokenA}` },
    } as {
      headers: { authorization: string };
      userId?: string;
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    const guard = new AuthGuard({ admin } as unknown as DatabaseService);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.userId).toBe(idA);
  });

  test("login session refreshes and logout clears local auth state", async () => {
    const refreshed = await userA.auth.refreshSession();
    expect(refreshed.error).toBeNull();
    expect(refreshed.data.session?.user.id).toBe(idA);
    expect((await userA.auth.signOut({ scope: "local" })).error).toBeNull();
    expect((await userA.auth.getSession()).data.session).toBeNull();
  });

  test.each([
    "profiles",
    "mood_entries",
    "journals",
    "memories",
    "conversations",
    "messages",
    "garden_states",
    "notification_preferences",
  ])("User A cannot read User B rows from %s", async (table) => {
    await ensureUserASession();
    const result = await userA.from(table).select("*").eq("user_id", idB);
    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  test("browser clients cannot read server-only export audits", async () => {
    await ensureUserASession();
    const result = await userA
      .from("data_export_audits")
      .select("*")
      .eq("user_id", idB);
    expect(result.data ?? []).toEqual([]);
    expect(result.error).not.toBeNull();
  });

  test("account deletion cascades every seeded application row", async () => {
    const deleted = await admin.auth.admin.deleteUser(idB);
    expect(deleted.error).toBeNull();
    for (const table of [
      "profiles",
      "mood_entries",
      "journals",
      "memories",
      "conversations",
      "messages",
      "garden_states",
      "notification_preferences",
      "data_export_audits",
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
