import { Pool } from "pg";
export const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
type QueryValue = string | number | boolean | Date | Buffer | null | undefined | Record<string, unknown> | readonly unknown[];

export const q = (text: string, params: QueryValue[] = []) => pool.query(text, params);
export const logEvent = (checkpointId: string | null, type: string, source: string, payload: Record<string, unknown> = {}, extra: { paypalEventId?: string; verified?: boolean } = {}) =>
  q(`insert into audit_events (checkpoint_id,type,source,payload,paypal_event_id,verified)
     values ($1,$2,$3,$4,$5,$6) on conflict (paypal_event_id) do nothing`,
    [checkpointId, type, source, payload, extra.paypalEventId ?? null, extra.verified ?? null]);
