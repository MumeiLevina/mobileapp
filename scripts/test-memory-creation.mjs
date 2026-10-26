import assert from "node:assert/strict";

// Uses the same local PGlite database, migrations and synthetic owners as the
// existing RLS suite. No hosted database or embedding provider is contacted.
export async function testMemoryCreation(pg, a, b, embedding) {
  const client = "12121212-1212-4212-a212-121212121212";
  const create = (
    owner,
    identity = client,
    content = "Synthetic quiet mornings",
  ) =>
    pg.query(
      "select * from create_manual_memory($1,$2,$3,'preference',$4::extensions.vector)",
      [owner, identity, content, embedding],
    );
  await pg.exec("set role service_role");
  const first = (await create(a)).rows[0];
  const retry = (await create(a)).rows[0];
  const other = (await create(b)).rows[0];
  await pg.exec("reset role");
  assert.equal(retry.id, first.id);
  assert.notEqual(other.id, first.id);
  assert.equal(first.approved_by_user, true);
  assert.ok(first.approved_at);
  for (const table of [
    "memory_sources",
    "garden_unlocks",
    "personal_milestones",
  ])
    assert.equal(
      (
        await pg.query(
          `select count(*)::int as n from ${table} where user_id=$1 and ${table === "memory_sources" ? "memory_id=$2" : table === "garden_unlocks" ? "feature_key='memory_garden'" : "milestone_key='memory_garden_appeared'"}`,
          table === "memory_sources" ? [a, first.id] : [a],
        )
      ).rows[0].n,
      1,
    );
  await assert.rejects(create(a, client, "Changed retry payload"));
  await pg.query(
    "update memories set content='Edited after creation' where id=$1",
    [first.id],
  );
  assert.equal((await create(a)).rows[0].content, "Edited after creation");
  console.log(
    "PASS manual memory identity is owner-scoped, payload-bound and preserves later edits",
  );

  const counts = async () =>
    Promise.all(
      [
        "memories",
        "memory_sources",
        "garden_unlocks",
        "personal_milestones",
        "memory_creation_requests",
      ].map(
        async (table) =>
          (await pg.query(`select count(*)::int as n from ${table}`)).rows[0].n,
      ),
    );
  for (const table of [
    "memory_sources",
    "garden_unlocks",
    "personal_milestones",
  ]) {
    const before = await counts();
    await pg.exec(`create function public.reject_memory_test() returns trigger language plpgsql as $$ begin raise exception 'synthetic transaction failure'; end $$;
      create trigger reject_memory_test before insert on public.${table} for each row execute function public.reject_memory_test();`);
    await assert.rejects(create(a, "13131313-1313-4313-a313-131313131313"));
    assert.deepEqual(await counts(), before);
    await pg.exec(
      `drop trigger reject_memory_test on public.${table}; drop function public.reject_memory_test();`,
    );
    // A retry after rollback must be able to commit exactly once.
  }
  const recovered = (await create(a, "13131313-1313-4313-a313-131313131313"))
    .rows[0];
  assert.equal(
    (await create(a, "13131313-1313-4313-a313-131313131313")).rows[0].id,
    recovered.id,
  );
  console.log(
    "PASS provenance, Garden and milestone failures roll back the entire memory transaction",
  );

  await pg.exec(`set role authenticated; set request.jwt.claim.sub='${a}'`);
  await assert.rejects(create(a));
  await assert.rejects(pg.query("select * from memory_creation_requests"));
  assert.equal(
    (await pg.query("select id from memories where id=$1", [other.id])).rows
      .length,
    0,
  );
  await pg.exec("reset role; set role anon");
  await assert.rejects(create(a));
  await assert.rejects(pg.query("select * from memory_creation_requests"));
  await pg.exec("reset role");
  console.log(
    "PASS memory creation RPC and fingerprints are server-only; memory RLS still isolates owners",
  );

  await pg.query("delete from memories where id=$1", [first.id]);
  await assert.rejects(create(a));
  assert.equal(
    (
      await pg.query(
        "select memory_id from memory_creation_requests where user_id=$1 and client_id=$2",
        [a, client],
      )
    ).rows[0].memory_id,
    null,
  );
  assert.equal(
    (
      await pg.query("select id from memory_sources where memory_id=$1", [
        first.id,
      ])
    ).rows.length,
    0,
  );
  console.log(
    "PASS a delayed memory creation retry cannot resurrect forgotten content",
  );
}
