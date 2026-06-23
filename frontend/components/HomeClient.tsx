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
    <form onSubmit={onSubmit} className="w-full">
      <div className="flex flex-col md:flex-row border border-outline focus-within:border-primary transition-all duration-500 bg-surface-container-lowest shadow-sm">
        <div className="flex-1 flex items-center px-6 py-4">
          <span className="material-symbols-outlined text-outline mr-4">link</span>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://arxiv.org/abs/1706.03762"
            className="bg-transparent border-none focus:outline-none text-on-surface w-full placeholder:text-outline/50"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-primary text-white px-10 py-5 text-xs font-semibold uppercase tracking-[0.2em] transition-all hover:bg-primary-container active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? "STARTING…" : "READ PAPER"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-error">{error}</p>}
    </form>
  );
}
