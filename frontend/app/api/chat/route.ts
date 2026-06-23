import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { BACKEND_URL } from "@/lib/backend";

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
    SELECT id, user_id, paper_id, role, content, highlight, created_at
    FROM chat_messages
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

  let body: { paper_id?: string; message?: string; highlight?: string | null };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { paper_id, message, highlight } = body;
  if (!paper_id || !message) {
    return Response.json({ error: "Missing paper_id or message" }, { status: 400 });
  }

  // 1. Call the Python FastAPI backend to get the answer
  let data;
  try {
    const backendRes = await fetch(`${BACKEND_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ req_id: paper_id, message, highlight: highlight || null }),
    });

    data = await backendRes.json();
    if (!backendRes.ok) {
      return Response.json({ error: data.detail || "Error from chat service" }, { status: backendRes.status });
    }
  } catch (err) {
    console.error("Failed to fetch from chat backend:", err);
    return Response.json({ error: "Failed to connect to chat service" }, { status: 502 });
  }

  const answer = data.answer;
  const citations = data.citations || [];

  // 2. Save both user message and assistant message to Neon DB
  const sql = getSql();

  // Save user message
  await sql`
    INSERT INTO chat_messages (user_id, paper_id, role, content, highlight)
    VALUES (${user.sub}, ${paper_id}, 'user', ${message}, ${highlight || null})
  `;

  // Save assistant message
  await sql`
    INSERT INTO chat_messages (user_id, paper_id, role, content)
    VALUES (${user.sub}, ${paper_id}, 'assistant', ${answer})
  `;

  return Response.json({
    answer,
    citations
  });
}
