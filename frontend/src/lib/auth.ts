/**
 * Auth helpers — HMAC-SHA256 signed session cookie, no external deps.
 * Works in both Node.js API routes and the Edge middleware runtime.
 */

const COOKIE_NAME = "pounce_session";
const MAX_AGE_S   = 60 * 60 * 24 * 7; // 7 days

// ── Credentials (override via env vars in Vercel) ────────────────────────────
export const VALID_EMAIL    = process.env.AUTH_EMAIL    ?? "ashish@hemut.com";
export const VALID_PASSWORD = process.env.AUTH_PASSWORD ?? "Florida@7890";

function getSecret(): string {
  return process.env.AUTH_SECRET ?? "pounce-auth-secret-change-in-prod-2024";
}

// ── HMAC helpers (Web Crypto, Edge-safe) ─────────────────────────────────────
async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(payload: string): Promise<string> {
  const key = await importKey(getSecret());
  const sig  = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function verify(payload: string, sigB64: string): Promise<boolean> {
  try {
    const key      = await importKey(getSecret());
    const sigBytes = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));
    return crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(payload));
  } catch {
    return false;
  }
}

// ── Token encode / decode ─────────────────────────────────────────────────────
export async function createSessionToken(email: string): Promise<string> {
  const exp     = Date.now() + MAX_AGE_S * 1000;
  const payload = `${email}:${exp}`;
  const sig     = await sign(payload);
  return `${btoa(payload)}.${sig}`;
}

export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const [b64Payload, sig] = token.split(".");
    if (!b64Payload || !sig) return null;
    const payload = atob(b64Payload);
    if (!(await verify(payload, sig))) return null;
    const [email, expStr] = payload.split(":");
    if (Date.now() > Number(expStr)) return null;
    return email;
  } catch {
    return null;
  }
}

export { COOKIE_NAME, MAX_AGE_S };
