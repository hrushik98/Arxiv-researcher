/**
 * Password hashing (bcrypt) and the current-user helper.
 * Node runtime only (bcryptjs). Do not import from proxy.ts.
 */
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken, type SessionPayload } from "@/lib/session";

const SALT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Reads and verifies the session cookie. Returns null when unauthenticated. */
export async function getCurrentUser(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}
