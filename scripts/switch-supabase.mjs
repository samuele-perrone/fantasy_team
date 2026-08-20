#!/usr/bin/env node
/**
 * Repoints the app at the Supabase project in .env.migrate.
 *
 * The marketplace-managed resource injects env vars for a different project, so those are
 * replaced on Vercel across every environment and rewritten locally. Run after the schema
 * migration has been applied to the target project.
 */
import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** Run a command, optionally piping `input` to its stdin (which execFile cannot do). */
function run(cmd, args, { input } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) =>
      code === 0 ? resolve({ stdout: out }) : reject(new Error(err || out || `exit ${code}`)),
    );
    if (input !== undefined) child.stdin.write(input);
    child.stdin.end();
  });
}
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TARGET_URL = "https://ebfhufyataxktvfgkjkh.supabase.co";

const migrate = await readFile(join(root, ".env.migrate"), "utf8");
const key = migrate.match(/^TARGET_PUBLISHABLE_KEY=(.+)$/m)?.[1]?.trim();
if (!key) {
  console.error("TARGET_PUBLISHABLE_KEY is empty in .env.migrate — nothing to do.");
  process.exit(1);
}

// Sanity-check the key actually belongs to the target project before changing anything.
const res = await fetch(`${TARGET_URL}/auth/v1/settings`, { headers: { apikey: key } });
if (!res.ok) {
  console.error(`That key was rejected by ${TARGET_URL} (HTTP ${res.status}). Check you copied
the publishable/anon key from the ebfhufyataxktvfgkjkh project.`);
  process.exit(1);
}
const settings = await res.json();
console.log(`key accepted · google enabled: ${settings.external?.google ? "yes" : "NO"}`);

const vars = {
  NEXT_PUBLIC_SUPABASE_URL: TARGET_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: key,
  SUPABASE_URL: TARGET_URL,
  SUPABASE_PUBLISHABLE_KEY: key,
  SUPABASE_ANON_KEY: key,
};

// Rewrite .env.local so local dev matches production.
let local = await readFile(join(root, ".env.local"), "utf8");
for (const [name, value] of Object.entries(vars)) {
  local = local.match(new RegExp(`^${name}=`, "m"))
    ? local.replace(new RegExp(`^${name}=.*$`, "m"), `${name}="${value}"`)
    : `${local.trimEnd()}\n${name}="${value}"\n`;
}
await writeFile(join(root, ".env.local"), local);
console.log("rewrote .env.local");

for (const [name, value] of Object.entries(vars)) {
  for (const env of ["production", "preview", "development"]) {
    // Remove first: `env add` refuses to overwrite an existing var.
    await run("vercel", ["env", "rm", name, env, "--yes"]).catch(() => {});
    await run("vercel", ["env", "add", name, env], { input: value }).catch((e) => {
      console.error(`  failed to set ${name} (${env}): ${e.message.split("\n")[0]}`);
    });
  }
  console.log(`  set ${name}`);
}

console.log("\nDone. Redeploy with: vercel deploy --prod --yes");
