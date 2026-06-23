import { cookies } from "next/headers";
import { getSql, type UserRow } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { createSessionToken, SESSION_COOKIE, getSessionCookieOptions } from "@/lib/session";

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";

  if (!email || !password) {
    return Response.json({ error: "Email and password are required" }, { status: 400 });
  }

  const sql = getSql();
  const rows = (await sql`
    SELECT id, email, password_hash, created_at FROM users WHERE email = ${email}
  `) as UserRow[];
  const user = rows[0];

  // Always run a compare to avoid leaking which emails exist (timing).
  const ok = user
    ? await verifyPassword(password, user.password_hash)
    : await verifyPassword(password, "$2a$12$0000000000000000000000000000000000000000000000000000");

  if (!user || !ok) {
    return Response.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const token = await createSessionToken({ sub: user.id, email: user.email });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, getSessionCookieOptions(request));

  return Response.json({ user: { id: user.id, email: user.email } });
}
