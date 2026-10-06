import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { readConfig } from "../config/env";
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
      limit?: number;
    } = {},
  ): Promise<T[]> {
    let q = this.admin.from(table).select("*").eq("user_id", user);
    if (options.active) q = q.is("deleted_at", null);
    for (const [k, v] of Object.entries(options.equals ?? {})) q = q.eq(k, v);
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
    const { data, error } = await this.admin
      .from(table)
      .insert({ ...value, user_id: user })
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
    let q = this.admin.from(table).update(value).eq("user_id", user);
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
}
