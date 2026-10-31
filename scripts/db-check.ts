import type { Pool } from "pg";
import { getPool } from "../lib/db";

async function main() {
  let pool: Pool | undefined;

  try {
    pool = await getPool();
    await pool.query("SELECT 1");
    console.log("DB connection OK");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await pool?.end();
  }
}

void main();
