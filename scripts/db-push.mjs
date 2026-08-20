#!/usr/bin/env node
/**
 * Applies every SQL file in supabase/migrations in filename order.
 *
 * Migrations are written to be idempotent (`create ... if not exists`, `drop policy if
 * exists`), so re-running is safe and no migration-history table is needed for a project
 * this size. Uses the non-pooling connection because DDL over a transaction-mode pooler is
 * unreliable.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Load .env.local without adding a dotenv dependency.
for (const line of (await readFile(join(root, ".env.local"), "utf8")).split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const connectionString = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;
if (!connectionString) {
  console.error("No POSTGRES_URL_NON_POOLING in .env.local — run `vercel env pull`.");
  process.exit(1);
}

const dir = join(root, "supabase", "migrations");
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

// Supabase terminates TLS with a chain Node does not trust out of the box. Strip any
// sslmode from the URL so it cannot override the explicit ssl option below.
const url = new URL(connectionString);
url.searchParams.delete("sslmode");

const client = new pg.Client({
  connectionString: url.toString(),
  ssl: { rejectUnauthorized: false },
});
await client.connect();

try {
  for (const file of files) {
    const sql = await readFile(join(dir, file), "utf8");
    process.stdout.write(`applying ${file} … `);
    // Each file runs in one transaction so a partial migration cannot land.
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("commit");
      console.log("ok");
    } catch (err) {
      await client.query("rollback");
      console.log("FAILED");
      throw err;
    }
  }
  console.log(`\n${files.length} migration(s) applied.`);
} finally {
  await client.end();
}
