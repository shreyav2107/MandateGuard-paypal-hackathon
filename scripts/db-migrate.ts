import { readFileSync } from "node:fs";
import { pool } from "../lib/db";

async function main() {
  try {
    const schema = readFileSync("db/schema.sql", "utf8");
    await pool.query(schema);
    console.log("Database migration OK");
  } catch {
    console.error("Database migration failed");
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
