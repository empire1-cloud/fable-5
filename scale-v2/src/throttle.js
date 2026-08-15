/*
 * Pre-auth throttling for the two endpoints a stranger can reach: login and
 * signup.
 *
 * Backed by Postgres rather than process memory on purpose. An in-memory
 * counter resets on every deploy and is not shared across instances — both
 * moments favour an attacker, and both are routine here. This costs one small
 * insert per attempt, which is the right trade for the only auth surface the
 * product has.
 *
 * Failures are counted, successes are not: a busy legitimate user is never
 * throttled, while repeated failures against one email (or from one address)
 * are.
 */
import { pool } from "./db.js";

export const LOGIN_MAX_FAILURES = 10;
export const LOGIN_WINDOW_MINUTES = 15;
export const SIGNUP_MAX_PER_WINDOW = 5;
export const SIGNUP_WINDOW_MINUTES = 60;

/** Client address, honouring one proxy hop (Fly/Render terminate TLS ahead of
 *  the app). Only the first entry is trusted; the rest are client-supplied. */
export function clientAddress(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress ?? "unknown";
}

export async function recordAttempt(kind, subject, succeeded) {
  await pool.query(
    `INSERT INTO auth_attempts (kind, subject, succeeded) VALUES ($1,$2,$3)`,
    [kind, String(subject).slice(0, 320).toLowerCase(), succeeded],
  );
}

async function countRecentFailures(kind, subject, windowMinutes) {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS failures
       FROM auth_attempts
      WHERE kind = $1
        AND subject = $2
        AND succeeded = false
        AND created_at > now() - ($3 || ' minutes')::interval`,
    [kind, String(subject).slice(0, 320).toLowerCase(), windowMinutes],
  );
  return rows[0]?.failures ?? 0;
}

async function countRecent(kind, subject, windowMinutes) {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS attempts
       FROM auth_attempts
      WHERE kind = $1
        AND subject = $2
        AND created_at > now() - ($3 || ' minutes')::interval`,
    [kind, String(subject).slice(0, 320).toLowerCase(), windowMinutes],
  );
  return rows[0]?.attempts ?? 0;
}

/** Throttle login by email. Deliberately not by address: an attacker rotates
 *  addresses cheaply, and throttling by address alone would let a botnet walk
 *  one account while locking out a shared office NAT. */
export async function loginThrottle(email) {
  const failures = await countRecentFailures("login", email, LOGIN_WINDOW_MINUTES);
  if (failures >= LOGIN_MAX_FAILURES) {
    return {
      allowed: false,
      reason: `Too many failed sign-in attempts for this account. Try again in ${LOGIN_WINDOW_MINUTES} minutes.`,
    };
  }
  return { allowed: true, failures };
}

/** Throttle signup by client address — there is no account to key on yet. */
export async function signupThrottle(address) {
  const attempts = await countRecent("signup", address, SIGNUP_WINDOW_MINUTES);
  if (attempts >= SIGNUP_MAX_PER_WINDOW) {
    return {
      allowed: false,
      reason: `Too many organisations created from this address. Try again in ${SIGNUP_WINDOW_MINUTES} minutes.`,
    };
  }
  return { allowed: true, attempts };
}

/** Keep the table from growing without bound. Called opportunistically; the
 *  window is short so anything older is of no forensic value here. */
export async function pruneAttempts() {
  await pool.query(`DELETE FROM auth_attempts WHERE created_at < now() - interval '24 hours'`);
}
