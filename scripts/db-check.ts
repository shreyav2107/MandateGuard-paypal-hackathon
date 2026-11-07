import { pool } from "../lib/db";

async function main() {
  try {
    await pool.query("SELECT 1");
    console.log("DB connection OK");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
