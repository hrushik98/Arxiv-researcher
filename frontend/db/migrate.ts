/**
 * Applies db/schema.sql to the Neon database.
 * Run with: bun run db/migrate.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

const connectionString = process.env.NEON_DB_URL;
if (!connectionString) {
  console.error("NEON_DB_URL is not set (add it to frontend/.env)");
  process.exit(1);
}

const sql = neon(connectionString);
const rawSchema = readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8");

// Strip full-line comments, then split on ';' (neon http runs one stmt/call).
const schema = rawSchema
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

const statements = schema
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

for (const statement of statements) {
  console.log(`> ${statement.split("\n")[0]} ...`);
  await sql.query(statement);
}

console.log("Migration complete.");
