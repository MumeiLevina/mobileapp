import { activities } from "../packages/shared/dist/index.js";
import { writeFile } from "node:fs/promises";
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const values = activities.map(
  (a) =>
    `(${[a.id, a.title, a.description].map(quote).join(",")},${a.duration},${quote(a.category)},${quote(JSON.stringify(a.steps))}::jsonb,${quote(a.difficulty)},${quote(a.energy_level)},array[${a.time_of_day.map(quote).join(",")}],true)`,
);
await writeFile(
  "supabase/seed.sql",
  `-- Curated public library only. Never seed private user content in production.\ninsert into public.self_care_activities(id,title,description,duration,category,steps,difficulty,energy_level,time_of_day,enabled) values\n${values.join(",\n")}\non conflict(id) do nothing;\n`,
);
