import type { Pool } from "pg";
import { getPool } from "../lib/db";

async function main() {
  let pool: Pool | undefined;

  try {
    pool = await getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mandates (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id text,
        description text,
        max_amount numeric,
        currency text DEFAULT 'USD',
        status text,
        created_at timestamptz DEFAULT now()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS checks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        mandate_id uuid REFERENCES mandates(id),
        ai_verdict text,
        ai_reason text,
        risk_score int,
        created_at timestamptz DEFAULT now()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        mandate_id uuid REFERENCES mandates(id),
        paypal_subscription_id text,
        amount numeric,
        status text,
        created_at timestamptz DEFAULT now()
      )
    `);

    await pool.query(
      "ALTER TABLE checks ADD COLUMN IF NOT EXISTS description_hash text",
    );
    await pool.query("ALTER TABLE checks ADD COLUMN IF NOT EXISTS source text");
    await pool.query(
      "CREATE INDEX IF NOT EXISTS checks_description_hash_idx ON checks (description_hash)",
    );

    console.log("Database migration OK");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await pool?.end();
  }
}

void main();
