"use client";

import { useLinkStatus } from "next/link";

/**
 * A link's label that turns into a spinner while the page it points at loads. Pages render on
 * the server per request, so without it a tap on a slow connection looks like it did nothing,
 * and people tap again. Must sit inside a <Link>.
 */
export function LinkPending({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return pending ? (
    <span
      role="status"
      aria-label="Loading"
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  ) : (
    children
  );
}
