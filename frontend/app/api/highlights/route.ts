import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const paperId = searchParams.get("paper_id");
  if (!paperId) {
    return Response.json({ error: "Missing paper_id parameter" }, { status: 400 });
  }

  const sql = getSql();
  const rows = await sql`
    SELECT id, user_id, paper_id, text, note, color, page_number, created_at
    FROM highlights
    WHERE user_id = ${user.sub} AND paper_id = ${paperId}
    ORDER BY created_at ASC
  `;

  return Response.json(rows);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { paper_id?: string; text?: string; note?: string; color?: string; page_number?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { paper_id, text, note, color, page_number } = body;
  if (!paper_id || !text || !color || page_number === undefined) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const sql = getSql();
  const rows = await sql`
    INSERT INTO highlights (user_id, paper_id, text, note, color, page_number)
    VALUES (${user.sub}, ${paper_id}, ${text}, ${note || null}, ${color}, ${page_number})
    RETURNING id, user_id, paper_id, text, note, color, page_number, created_at
  `;

  return Response.json(rows[0]);
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "Missing id parameter" }, { status: 400 });
  }

  const sql = getSql();
  await sql`DELETE FROM highlights WHERE id = ${id} AND user_id = ${user.sub}`;

  return Response.json({ ok: true });
}
