/* Route + access boundaries for the FABLE-5 site.

   One rule, stated once: the marketing site is public, every control-plane
   workspace is private. A private route without a session is refused and
   pointed at /sign-in with the intended destination carried in `?next=`.
   Kept dependency-free and pure so the boundary is unit-testable.
*/

export const PUBLIC_PATHS = [
  "/",
  "/how-it-works",
  "/proof",
  "/founding-access",
  "/trust",
  "/sign-in",
  "/signup",
  "/pricing",
] as const;

/** Control-plane workspaces a signed-in user may open. */
export const PRIVATE_PATHS = [
  "/control",
  "/control/evidence",
  "/control/decisions",
  "/control/escalations",
  "/control/settings",
  // Legacy workspace routes kept alive — WE EVOLVE, NEVER DELETE.
  "/blueprint",
  "/control-plane",
  "/evidence",
  "/genomes",
  "/allocation",
  "/governance",
  "/billing",
  "/billing/success",
  "/billing/cancel",
] as const;

export type AccessDecision =
  | { allowed: true }
  | { allowed: false; reason: "unauthenticated"; redirect: string };

export function isPublicPath(path: string): boolean {
  return (PUBLIC_PATHS as readonly string[]).includes(path);
}

export function isPrivatePath(path: string): boolean {
  return (PRIVATE_PATHS as readonly string[]).includes(path);
}

/**
 * Decide whether a path may render for a given session.
 * - public paths always render;
 * - private paths render only when authenticated;
 * - unknown paths are treated as the public home (defensive default).
 */
export function resolveAccess(path: string, authenticated: boolean): AccessDecision {
  if (isPublicPath(path)) return { allowed: true };
  if (isPrivatePath(path)) {
    if (authenticated) return { allowed: true };
    return { allowed: false, reason: "unauthenticated", redirect: `/sign-in?next=${encodeURIComponent(path)}` };
  }
  return { allowed: true };
}

/** Canonical sign-in path — keep it in one place so links and guards agree. */
export const SIGN_IN_PATH = "/sign-in";

export function afterSignInTarget(path: string): string {
  return isPrivatePath(path) ? path : "/control";
}
