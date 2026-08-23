/**
 * A random temporary password an admin can hand to a new/reset staff
 * account — not meant to be memorized, just typed once by the admin
 * relaying it and then changed by the user themselves (once Phase 8's
 * account settings support that) or reset again if lost. Uses
 * `crypto.getRandomValues` (available in both the browser and Node),
 * not `Math.random()`, since this is a real credential.
 */
export function generateTemporaryPassword(length = 12): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("");
}
