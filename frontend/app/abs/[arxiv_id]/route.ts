import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { BACKEND_URL } from "@/lib/backend";

// Accepts bare arxiv IDs like 1706.03762 (optionally with version, e.g. 1706.03762v3).
const ARXIV_ID_RE = /^\d{4}\.\d{4,5}(v\d+)?$/;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ arxiv_id: string }> }
) {
  const { arxiv_id } = await params;

  if (!ARXIV_ID_RE.test(arxiv_id)) {
    const url = new URL("/", request.url);
    url.searchParams.set("error", `Invalid arxiv ID: ${arxiv_id}`);
    return NextResponse.redirect(url);
  }

  const arxivUrl = `https://arxiv.org/abs/${arxiv_id}`;
  const reqId = uuidv4();

  const res = await fetch(`${BACKEND_URL}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: arxivUrl, req_id: reqId }),
  });

  if (!res.ok) {
    const url = new URL("/", request.url);
    url.searchParams.set("error", "Could not start processing this paper");
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(new URL(`/paper/${reqId}`, request.url));
}
