/**
 * Stash for "we already asked the wallet to pay, but the server confirmation
 * call hasn't succeeded yet" — keyed by queue entry id.
 *
 * The flow is:
 *   1. sendFee resolves with a BOC → write the BOC here BEFORE calling
 *      /api/queue/[id]/confirm. If the network drops between sendFee and
 *      confirm, the BOC survives.
 *   2. confirm succeeds → clear the stash.
 *   3. On retry: read the stash. If non-empty, re-call /confirm with the
 *      stored BOC instead of asking the wallet again. Combined with the
 *      idempotent RPC server-side, this guarantees no double-charge.
 *
 * localStorage keeps it across page reloads / Mini App restarts. Cleanup is
 * caller-driven; nothing else trims it.
 */

const PREFIX = "ezc:pending-boc:";

export function readPendingBoc(entryId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(PREFIX + entryId);
  } catch {
    return null;
  }
}

export function writePendingBoc(entryId: string, boc: string): void {
  try {
    localStorage.setItem(PREFIX + entryId, boc);
  } catch { /* quota / private mode — best-effort */ }
}

export function clearPendingBoc(entryId: string): void {
  try {
    localStorage.removeItem(PREFIX + entryId);
  } catch { /* noop */ }
}
