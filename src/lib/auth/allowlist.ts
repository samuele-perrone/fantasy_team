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

export function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
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
