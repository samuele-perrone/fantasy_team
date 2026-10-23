/**
 * Makes the "Secret Key (for OAuth)" Supabase needs for Sign in with Apple on the website, and
 * copies it to the clipboard without printing it.
 *
 *   node scripts/apple-client-secret.mjs <path to AuthKey_XXXX.p8> <Key ID>
 *
 * Then paste it into Supabase → Authentication → Sign In / Providers → Apple → Secret Key.
 * Apple caps the secret at six months, so it is made to last just under that; run this again
 * before it expires (RUNBOOK, "Sign in with Apple on the website"). The .p8 is a private key:
 * keep it out of the repository.
 */
import { execFileSync } from "node:child_process";
import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";

const TEAM_ID = "7RYYQ8M5X5";
const SERVICES_ID = "com.fantasyteamhub.web";
const LIFETIME = 180 * 24 * 60 * 60 - 60 * 60; // just under Apple's six-month limit

const [keyPath, keyId] = process.argv.slice(2);
if (!keyPath || !keyId) {
  console.error("Usage: node scripts/apple-client-secret.mjs <AuthKey_XXXX.p8> <Key ID>");
  process.exit(1);
}

const b64url = (data) => Buffer.from(data).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const header = b64url(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }));
const payload = b64url(
  JSON.stringify({
    iss: TEAM_ID,
    iat: now,
    exp: now + LIFETIME,
    aud: "https://appleid.apple.com",
    sub: SERVICES_ID,
  }),
);
// ES256 in a JWT is the raw r‖s signature, not the DER encoding Node gives by default.
const signature = sign("sha256", Buffer.from(`${header}.${payload}`), {
  key: createPrivateKey(readFileSync(keyPath)),
  dsaEncoding: "ieee-p1363",
});

execFileSync("pbcopy", { input: `${header}.${payload}.${b64url(signature)}` });
const expires = new Date((now + LIFETIME) * 1000).toISOString().slice(0, 10);
console.log(`Copied to the clipboard. It expires on ${expires}: make a new one before then.`);
