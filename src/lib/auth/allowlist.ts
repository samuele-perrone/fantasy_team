/**
 * Email allow-list. Google sign-in is open to every Google account, so authentication alone
 * does not make the site private — this is what actually restricts it.
 *
 * The list comes from ALLOWED_EMAILS (comma separated) so it can change without a deploy.
 * It fails closed: an unset or empty list denies everyone rather than silently opening the
 * site up, and the login page explains that case so it is recoverable rather than baffling.
 */

/**
 * Gmail ignores dots and anything after a `+`, so `sam.p+fpl@gmail.com` and `samp@gmail.com`
 * are the same account. Normalising avoids a lockout that would look like a bug.
 */
function normalise(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at < 1) return trimmed;

  let local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);

  const plus = local.indexOf("+");
  if (plus >= 0) local = local.slice(0, plus);
  if (domain === "gmail.com" || domain === "googlemail.com") {
    local = local.replaceAll(".", "");
    return `${local}@gmail.com`;
  }
  return `${local}@${domain}`;
}

/**
 * Split on any separator someone might reasonably reach for.
 *
 * Comma is what the docs say, but a multi-line textarea in the Vercel dashboard invites one
 * address per line, and that arrives either as a real newline or as the two characters `\` and
 * `n`. Splitting on commas alone turned `a@x.com\nb@x.com` into a single entry containing two
 * `@` signs, which matched nobody — locking out every address including the ones that had
 * previously worked. The separator a person chose is never worth a lockout.
 */
export function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .replace(/\\n|\\r/g, "\n")
    .split(/[\s,;]+/)
    .map((e) => e.trim())
    .filter(Boolean);
}

/** True when the list is missing entirely — the site denies everyone until it is set. */
export function allowlistUnconfigured(): boolean {
  return allowedEmails().length === 0;
}

export function isAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = allowedEmails();
  if (list.length === 0) return false;

  const candidate = normalise(email);
  return list.some((entry) => {
    // A bare domain entry ("@example.com") admits everyone at that domain.
    if (entry.startsWith("@")) return candidate.endsWith(entry.toLowerCase());
    return normalise(entry) === candidate;
  });
}
