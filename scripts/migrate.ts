import { readFileSync } from "fs";
import { pool } from "../lib/db";
pool.query(readFileSync("db/schema.sql", "utf8")).then(() => { console.log("migrated"); pool.end(); });
