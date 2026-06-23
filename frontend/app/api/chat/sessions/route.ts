import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";

// Lists this user's conversation sessions for a paper, most-recently-updated
// first, so the chat panel's History dropdown can let them reopen one.
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
    SELECT
      session_id,
      MIN(created_at) AS started_at,
      MAX(created_at) AS updated_at,
      (
        SELECT content FROM chat_messages c2
        WHERE c2.session_id = c1.session_id AND c2.role = 'user'
        ORDER BY c2.created_at ASC LIMIT 1
      ) AS preview
    FROM chat_messages c1
    WHERE user_id = ${user.sub} AND paper_id = ${paperId}
    GROUP BY session_id
    ORDER BY updated_at DESC
  `;

  return Response.json(rows);
}
