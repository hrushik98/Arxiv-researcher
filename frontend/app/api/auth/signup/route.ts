import { cookies } from "next/headers";
import { getSql, type UserRow } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";

  if (!email || !EMAIL_RE.test(email)) {
    return Response.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);

  const sql = getSql();
  let user: UserRow;
  try {
    const rows = (await sql`
      INSERT INTO users (email, password_hash)
      VALUES (${email}, ${passwordHash})
      RETURNING id, email, password_hash, created_at
    `) as UserRow[];
    user = rows[0];
  } catch (err: unknown) {
    // 23505 = unique_violation (email already registered)
    if (typeof err === "object" && err && "code" in err && (err as { code: string }).code === "23505") {
      return Response.json({ error: "An account with this email already exists" }, { status: 409 });
    }
    console.error("signup failed:", err);
    return Response.json({ error: "Could not create account" }, { status: 500 });
  }

  const token = await createSessionToken({ sub: user.id, email: user.email });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions);

  return Response.json({ user: { id: user.id, email: user.email } }, { status: 201 });
}
