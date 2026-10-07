export const STAGING_SCHEMA_LABEL = "Wave 3 compatible";

export const STAGING_REQUIRED_TABLES = [
  "users",
  "profiles",
  "conversations",
  "messages",
  "mood_entries",
  "journals",
  "memories",
  "self_care_activities",
  "self_care_sessions",
  "garden_states",
  "garden_unlocks",
  "weekly_reflections",
  "notification_preferences",
  "safety_events",
  "crisis_resources",
  "data_export_audits",
  "life_map_items",
  "memory_sources",
  "ritual_entries",
  "letters",
  "soft_goals",
  "personal_milestones",
];

const requiredSelections = {
  conversations: "id,user_id,client_id,mode",
};

const missingRelation = (error) =>
  ["42P01", "PGRST205"].includes(error?.code) ||
  /relation .* does not exist|could not find the table/i.test(
    error?.message ?? "",
  );

export async function verifyRequiredSchema(admin) {
  const probes = await Promise.all(
    STAGING_REQUIRED_TABLES.map(async (table) => ({
      table,
      result: await admin
        .from(table)
        .select(requiredSelections[table] ?? "*", {
          head: true,
          count: "exact",
        })
        .limit(1),
    })),
  );
  const missing = probes
    .filter(({ result }) => result.error && missingRelation(result.error))
    .map(({ table }) => table);
  const unexpected = probes.find(
    ({ result }) => result.error && !missingRelation(result.error),
  );
  if (unexpected) {
    throw new Error(
      `schema probe failed for ${unexpected.table} (${unexpected.result.error.code ?? "unknown"})`,
    );
  }
  return { compatible: missing.length === 0, missing };
}
