import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { readConfig } from "../config/env";
import { CrisisResource } from "@mori/shared";
@Injectable()
export class DatabaseService {
  readonly admin: SupabaseClient;
  constructor() {
    const env = readConfig();
    this.admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  async list<T>(
    table: string,
    user: string,
    options: {
      active?: boolean;
      equals?: Record<string, string | boolean>;
      notNull?: string[];
      limit?: number;
    } = {},
  ): Promise<T[]> {
    let q = this.admin.from(table).select("*").eq("user_id", user);
    if (options.active) q = q.is("deleted_at", null);
    for (const [k, v] of Object.entries(options.equals ?? {})) q = q.eq(k, v);
    for (const column of options.notNull ?? []) q = q.not(column, "is", null);
    const { data, error } = await q
      .order("created_at", { ascending: false })
      .limit(options.limit ?? 100);
    if (error) throw new ServiceUnavailableException();
    return data as T[];
  }
  async one<T>(
    table: string,
    user: string,
    id?: string,
    active = false,
  ): Promise<T> {
    let q = this.admin.from(table).select("*").eq("user_id", user);
    if (id) q = q.eq("id", id);
    if (active) q = q.is("deleted_at", null);
    const { data, error } = await q.maybeSingle();
    if (error) throw new ServiceUnavailableException();
    if (!data) throw new NotFoundException();
    return data as T;
  }
  async insert<T>(
    table: string,
    user: string,
    value: Record<string, unknown>,
  ): Promise<T> {
    const safeValue = this.withoutOwnership(value);
    const { data, error } = await this.admin
      .from(table)
      .insert({ ...safeValue, user_id: user })
      .select()
      .single();
    if (error) throw new ServiceUnavailableException();
    return data as T;
  }
  async update<T>(
    table: string,
    user: string,
    id: string | undefined,
    value: Record<string, unknown>,
  ): Promise<T> {
    const safeValue = this.withoutOwnership(value);
    let q = this.admin.from(table).update(safeValue).eq("user_id", user);
    if (id) q = q.eq("id", id);
    const { data, error } = await q.select().maybeSingle();
    if (error) throw new ServiceUnavailableException();
    if (!data) throw new NotFoundException();
    return data as T;
  }
  async remove(table: string, user: string, id?: string) {
    let q = this.admin.from(table).delete().eq("user_id", user);
    if (id) q = q.eq("id", id);
    const { error } = await q;
    if (error) throw new ServiceUnavailableException();
    return { ok: true };
  }
  async rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.admin.rpc(name, args);
    if (error) throw new ServiceUnavailableException();
    return data as T;
  }

  async listVerifiedCrisisResources(
    language: "vi" | "en",
  ): Promise<CrisisResource[]> {
    const { data, error } = await this.admin
      .from("crisis_resources")
      .select(
        "id,country_code,region,resource_type,name,phone,url,available_hours,language",
      )
      .eq("enabled", true)
      .not("verified_at", "is", null)
      .is("country_code", null)
      .in("language", [language, "multi"])
      .order("resource_type")
      .limit(10);
    if (error) throw new ServiceUnavailableException();
    return (data ?? []) as CrisisResource[];
  }

  async listAllForExport<T>(
    table:
      | "mood_entries"
      | "journals"
      | "memories"
      | "conversations"
      | "messages"
      | "self_care_sessions"
      | "weekly_reflections"
      | "life_map_items"
      | "memory_sources"
      | "ritual_entries",
    user: string,
    columns: string,
  ): Promise<T[]> {
    const pageSize = 500;
    const rows: T[] = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await this.admin
        .from(table)
        .select(columns)
        .eq("user_id", user)
        .order("created_at", { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (error) throw new ServiceUnavailableException();
      const page = (data ?? []) as T[];
      rows.push(...page);
      if (page.length < pageSize) return rows;
    }
  }

  async listMemoriesWithSources<T>(user: string): Promise<T[]> {
    const { data, error } = await this.admin
      .from("memories")
      .select("*,memory_sources(id,source_type,source_id,reason,created_at)")
      .eq("user_id", user)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new ServiceUnavailableException();
    return (data ?? []) as T[];
  }

  private withoutOwnership(value: Record<string, unknown>) {
    const { user_id: _ignoredUserId, ...safeValue } = value;
    return safeValue;
  }
}
