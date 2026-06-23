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

  // "all" is used by the Citations view, which needs every message (across every
  // session) for the paper rather than just the most recent conversation.
  if (searchParams.get("all") === "true") {
    const rows = await sql`
      SELECT id, user_id, paper_id, role, content, highlight, citations,
             web_sources AS "webSources", session_id, created_at
      FROM chat_messages
      WHERE user_id = ${user.sub} AND paper_id = ${paperId}
      ORDER BY created_at ASC
    `;
    return Response.json({ session_id: null, messages: rows });
  }

  let sessionId = searchParams.get("session_id");
  if (!sessionId) {
    const latest = await sql`
      SELECT session_id FROM chat_messages
      WHERE user_id = ${user.sub} AND paper_id = ${paperId}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    sessionId = (latest[0]?.session_id as string | undefined) ?? null;
  }

  if (!sessionId) {
    return Response.json({ session_id: null, messages: [] });
  }

  const rows = await sql`
    SELECT id, user_id, paper_id, role, content, highlight, citations,
           web_sources AS "webSources", session_id, created_at
    FROM chat_messages
    WHERE user_id = ${user.sub} AND paper_id = ${paperId} AND session_id = ${sessionId}
    ORDER BY created_at ASC
  `;

  return Response.json({ session_id: sessionId, messages: rows });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  type Attachment = { name: string; mime_type: string; data: string };
  let body: {
    paper_id?: string;
    message?: string;
    highlight?: string | null;
    attachments?: Attachment[];
    session_id?: string;
    web_search?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { paper_id, message, highlight, attachments, web_search } = body;
  if (!paper_id || !message) {
    return Response.json({ error: "Missing paper_id or message" }, { status: 400 });
  }
  // A session groups a "New Chat" conversation's messages together; the client
  // generates one up front so the first message in a thread still has an id.
  const sessionId = body.session_id || crypto.randomUUID();

  // 1. Call the Python FastAPI backend to get the answer
  let data;
  try {
    const backendRes = await fetch(`${BACKEND_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        req_id: paper_id,
        message,
        highlight: highlight || null,
        attachments: attachments && attachments.length > 0 ? attachments : null,
        web_search: web_search || false,
      }),
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
  const webSources = data.web_sources || [];

  // 2. Save both user message and assistant message to Neon DB
  const sql = getSql();

  // Save user message
  await sql`
    INSERT INTO chat_messages (user_id, paper_id, role, content, highlight, session_id)
    VALUES (${user.sub}, ${paper_id}, 'user', ${message}, ${highlight || null}, ${sessionId})
  `;

  // Save assistant message (citations/web_sources persisted so they survive reloads)
  await sql`
    INSERT INTO chat_messages (user_id, paper_id, role, content, citations, web_sources, session_id)
    VALUES (
      ${user.sub}, ${paper_id}, 'assistant', ${answer},
      ${JSON.stringify(citations)}::jsonb, ${JSON.stringify(webSources)}::jsonb, ${sessionId}
    )
  `;

  return Response.json({
    answer,
    citations,
    web_sources: webSources,
    session_id: sessionId,
  });
}
