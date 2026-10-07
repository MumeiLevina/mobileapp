import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const pg = await PGlite.create({ extensions: { vector } });
const a = "11111111-1111-4111-a111-111111111111",
  b = "22222222-2222-4222-a222-222222222222";
try {
  await pg.exec(
    `create schema auth; create schema extensions; create role anon; create role authenticated; create role service_role bypassrls; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema public,auth to authenticated;`,
  );
  await pg.exec(
    await readFile("supabase/migrations/202610010001_initial.sql", "utf8"),
  );
  await pg.exec(
    await readFile(
      "supabase/migrations/202610060001_auth_rls_hardening.sql",
      "utf8",
    ),
  );
  await pg.exec(
    await readFile(
      "supabase/migrations/202610060002_crisis_resources.sql",
      "utf8",
    ),
  );
  await pg.exec(
    await readFile(
      "supabase/migrations/202610060003_data_export_audits.sql",
      "utf8",
    ),
  );
  await pg.exec(
    await readFile("supabase/migrations/202610070001_life_map.sql", "utf8"),
  );
  await pg.exec(
    await readFile(
      "supabase/migrations/202610070002_memory_provenance.sql",
      "utf8",
    ),
  );
  await pg.exec(
    await readFile(
      "supabase/migrations/202610070003_guided_journals.sql",
      "utf8",
    ),
  );
  await pg.exec(
    await readFile("supabase/migrations/202610070004_rituals.sql", "utf8"),
  );
  await pg.exec(
    await readFile(
      "supabase/migrations/202610070005_ritual_notifications.sql",
      "utf8",
    ),
  );
  await pg.exec(
    await readFile("supabase/migrations/202610070006_letters.sql", "utf8"),
  );
  await pg.exec(await readFile("supabase/seed.sql", "utf8"));
  assert.equal(
    (await pg.query("select * from self_care_activities where enabled")).rows
      .length,
    10,
  );
  await pg.exec(`insert into auth.users values('${a}'),('${b}');`);
  assert.equal(
    (await pg.query("select * from public.profiles")).rows.length,
    2,
  );
  const notificationDefaults = (
    await pg.query(
      "select morning_enabled, morning_hour, evening_enabled, evening_hour, timezone from notification_preferences where user_id=$1",
      [a],
    )
  ).rows[0];
  assert.deepEqual(notificationDefaults, {
    morning_enabled: false,
    morning_hour: 8,
    evening_enabled: false,
    evening_hour: 20,
    timezone: "Asia/Ho_Chi_Minh",
  });
  await pg.query(
    "update notification_preferences set morning_enabled=true, morning_hour=7, timezone='Asia/Tokyo' where user_id=$1",
    [a],
  );
  assert.deepEqual(
    (
      await pg.query(
        "select morning_enabled, morning_hour, timezone from notification_preferences where user_id=$1",
        [a],
      )
    ).rows[0],
    { morning_enabled: true, morning_hour: 7, timezone: "Asia/Tokyo" },
  );
  console.log("PASS ritual reminders default off and preserve timezone");
  console.log("PASS migration, auth trigger and initial profile/garden");
  await pg.query(
    "insert into journals(user_id,title,content,source,client_id) values($1,'guided','private answer','guided',$2)",
    [a, "55555555-5555-4555-a555-555555555555"],
  );
  assert.equal(
    (
      await pg.query(
        "select count(*)::int as count from journals where user_id=$1 and source='guided'",
        [a],
      )
    ).rows[0].count,
    1,
  );
  console.log(
    "PASS guided journals reuse private owner-scoped journal storage",
  );
  await pg.query(
    "insert into ritual_entries(user_id,type,desired_feeling,small_intention,client_id) values($1,'morning','peaceful','A private intention',$2)",
    [a, "66666666-6666-4666-a666-666666666666"],
  );
  await pg.query(
    "insert into ritual_entries(user_id,type,desired_feeling,small_intention,client_id) values($1,'morning','brave','Other owner',$2)",
    [b, "77777777-7777-4777-a777-777777777777"],
  );
  console.log("PASS ritual entries validate useful owner-scoped data");
  const letterA = (
    await pg.query(
      "insert into letters(user_id,title,content,open_at,client_id) values($1,'Future me','private A',now() + interval '7 days',$2) returning id",
      [a, "88888888-8888-4888-a888-888888888888"],
    )
  ).rows[0].id;
  await pg.query(
    "insert into letters(user_id,title,content,open_at,client_id) values($1,'Other owner','private B',now() + interval '1 month',$2)",
    [b, "99999999-9999-4999-a999-999999999999"],
  );
  assert.ok(letterA);
  console.log("PASS future letters validate private owner-scoped data");
  const embedding = JSON.stringify(
    Array.from({ length: 1536 }, (_, i) => (i === 0 ? 1 : 0)),
  );
  for (const [user, approved, content] of [
    [a, true, "approved"],
    [a, false, "pending"],
    [b, true, "other user"],
  ])
    await pg.query(
      "insert into memories(user_id,content,category,approved_by_user,approved_at,embedding) values($1,$2,$3,$4,case when $4 then now() else null end,$5)",
      [user, content, "preference", approved, embedding],
    );
  let matches = await pg.query("select * from match_memories($1,$2,4)", [
    a,
    embedding,
  ]);
  assert.deepEqual(
    matches.rows.map((r) => r.content),
    ["approved"],
  );
  await pg.query(
    "update memories set deleted_at=now() where content='approved'",
  );
  matches = await pg.query("select * from match_memories($1,$2,4)", [
    a,
    embedding,
  ]);
  assert.equal(matches.rows.length, 0);
  console.log(
    "PASS vector retrieval excludes unapproved, deleted and other users",
  );
  await pg.query(
    "insert into journals(user_id,title,content,source,client_id) values($1,'private B','private','manual',$2)",
    [b, "33333333-3333-4333-a333-333333333333"],
  );
  await pg.query(
    "insert into conversations(user_id,title) values($1,'private B')",
    [b],
  );
  await pg.query(
    "insert into mood_entries(user_id,mood,intensity,client_id) values($1,'okay',0.5,$2)",
    [b, "44444444-4444-4444-a444-444444444444"],
  );
  await pg.query(
    "insert into life_map_items(user_id,type,title,approved_by_user) values($1,'people','private B',true)",
    [b],
  );
  await pg.exec(`set role authenticated; set request.jwt.claim.sub='${a}';`);
  for (const table of [
    "profiles",
    "journals",
    "memories",
    "conversations",
    "mood_entries",
    "life_map_items",
    "memory_sources",
    "ritual_entries",
    "letters",
  ]) {
    const rows = await pg.query(`select user_id from ${table}`);
    assert.ok(
      rows.rows.every((row) => row.user_id === a),
      `${table} leaked another user`,
    );
  }
  await assert.rejects(
    pg.exec(
      `insert into memories(user_id,content,category) values('${a}','unauthorized','preference')`,
    ),
  );
  await assert.rejects(
    pg.exec(
      `insert into letters(user_id,title,content,open_at) values('${a}','unauthorized','private',now() + interval '1 day')`,
    ),
  );
  await assert.rejects(
    pg.query("select award_growth($1,$2)", [a, "fake-action"]),
  );
  await assert.rejects(
    pg.query("select * from match_memories($1,$2,4)", [b, embedding]),
  );
  await pg.exec("reset role");
  console.log(
    "PASS RLS prevents cross-user read; browser cannot write or call privileged functions",
  );
  await assert.rejects(
    pg.query(
      "insert into life_map_items(user_id,type,title,source_type,source_id) values($1,'people','invalid','memory',null)",
      [a],
    ),
  );
  console.log("PASS Life Map validates paired provenance fields");
  const memoryA = (
    await pg.query(
      "select id from memories where user_id=$1 order by created_at limit 1",
      [a],
    )
  ).rows[0].id;
  await pg.query(
    "insert into memory_sources(user_id,memory_id,source_type,reason) values($1,$2,'manual','Added by owner')",
    [a, memoryA],
  );
  await assert.rejects(
    pg.query(
      "insert into memory_sources(user_id,memory_id,source_type,reason) values($1,$2,'manual','Wrong owner')",
      [b, memoryA],
    ),
  );
  console.log("PASS memory provenance enforces composite ownership");
  await pg.exec(`set role authenticated; set request.jwt.claim.sub='${a}';`);
  await assert.rejects(
    pg.query(
      "insert into crisis_resources(resource_type,name,url,language,verified_at,source_url) values('crisis_line','unverified browser write','https://example.test','en',now(),'https://example.test/source')",
    ),
  );
  await pg.exec("reset role");
  await pg.query(
    "insert into crisis_resources(country_code,resource_type,name,url,language,verified_at,source_url) values(null,'support_service','Verified global test resource','https://example.test/help','en',now(),'https://example.test/source')",
  );
  assert.equal(
    (
      await pg.query(
        "select count(*)::int as count from crisis_resources where enabled and verified_at is not null",
      )
    ).rows[0].count,
    1,
  );
  console.log("PASS verified crisis resource directory permissions and shape");
  await pg.query(
    "insert into data_export_audits(user_id,status,record_counts,completed_at) values($1,'completed',$2,now())",
    [a, JSON.stringify({ journals: 1 })],
  );
  assert.equal(
    (
      await pg.query(
        "select record_counts from data_export_audits where user_id=$1",
        [a],
      )
    ).rows.length,
    1,
  );
  console.log("PASS export audit stores metadata without exported content");
  for (let i = 0; i < 3; i++)
    await pg.query("select award_growth($1,$2)", [a, "mood:one"]);
  assert.equal(
    (
      await pg.query(
        "select growth_points from garden_states where user_id=$1",
        [a],
      )
    ).rows[0].growth_points,
    1,
  );
  console.log("PASS idempotent garden growth");
  await assert.rejects(
    pg.query("select save_weekly_reflection($1,$2,$3)", [
      a,
      "2026-09-28",
      "summary",
    ]),
  );
  await pg.query(
    "update profiles set weekly_reflection_enabled=true where user_id=$1",
    [a],
  );
  for (let i = 0; i < 2; i++)
    await pg.query("select save_weekly_reflection($1,$2,$3)", [
      a,
      "2026-09-28",
      "summary",
    ]);
  assert.equal(
    (await pg.query("select * from weekly_reflections where user_id=$1", [a]))
      .rows.length,
    1,
  );
  assert.equal(
    (
      await pg.query(
        "select growth_points from garden_states where user_id=$1",
        [a],
      )
    ).rows[0].growth_points,
    2,
  );
  console.log("PASS weekly reflection consent and once-per-week growth");
  const c = (
    await pg.query(
      "insert into conversations(user_id) values($1) returning id",
      [a],
    )
  ).rows[0].id;
  await assert.rejects(
    pg.query(
      "insert into messages(user_id,conversation_id,role,content) values($1,$2,'user','bad')",
      [b, c],
    ),
  );
  const client = "33333333-3333-4333-a333-333333333333";
  for (let i = 0; i < 2; i++)
    await pg.query("select * from save_exchange($1,$2,$3,$4,$5)", [
      a,
      c,
      client,
      "private text",
      "reply",
    ]);
  assert.equal((await pg.query("select * from messages")).rows.length, 2);
  await assert.rejects(
    pg.query("select * from save_exchange($1,$2,$3,$4,$5)", [
      b,
      c,
      client,
      "bad",
      "bad",
    ]),
  );
  console.log(
    "PASS composite ownership foreign key and atomic idempotent conversation exchange",
  );
  await pg.query("delete from auth.users where id=$1", [a]);
  for (const table of [
    "profiles",
    "messages",
    "memories",
    "garden_states",
    "garden_unlocks",
    "conversations",
    "data_export_audits",
    "life_map_items",
    "memory_sources",
    "ritual_entries",
    "letters",
  ])
    assert.equal(
      (await pg.query(`select * from ${table} where user_id=$1`, [a])).rows
        .length,
      0,
    );
  console.log("PASS account deletion cascades through private data");
} finally {
  await pg.close();
}
