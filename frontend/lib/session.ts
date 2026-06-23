/**
 * Session helpers. Uses `jose` (Web Crypto) so it runs in BOTH the Node
 * runtime (route handlers) and the Edge runtime (proxy.ts). Do NOT import
 * bcrypt here — keep this file edge-safe.
 */
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export const SESSION_COOKIE = "session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  sub: string; // user id
  email: string;
};

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sub === "string" && typeof payload.email === "string") {
      return { sub: payload.sub, email: payload.email };
    }
    return null;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};
