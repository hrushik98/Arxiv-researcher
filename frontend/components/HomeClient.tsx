"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { BACKEND_URL } from "@/lib/backend";

// Accepts arxiv abs/pdf URLs or a bare id like 1706.03762 (optionally vN).
const ARXIV_RE =
  /^(https?:\/\/(www\.)?arxiv\.org\/(abs|pdf)\/)?(\d{4}\.\d{4,5})(v\d+)?(\.pdf)?$/i;

export default function HomeClient() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = url.trim();
    if (!ARXIV_RE.test(trimmed)) {
      setError("Enter a valid arxiv link, e.g. https://arxiv.org/abs/1706.03762");
      return;
    }

    setLoading(true);
    const reqId = uuidv4();
    try {
      const res = await fetch(`${BACKEND_URL}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed, req_id: reqId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "Could not start processing this paper");
        setLoading(false);
        return;
      }
      router.push(`/paper/${reqId}`);
    } catch {
      setError("Could not reach the server. Is the backend running?");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-xl flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://arxiv.org/abs/1706.03762"
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-300"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-zinc-900 px-6 py-3 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {loading ? "Starting…" : "Read paper"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
