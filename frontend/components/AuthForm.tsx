"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type Mode = "login" | "signup";

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-zinc-950">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {isSignup ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          {isSignup ? "Sign up to start reading papers." : "Log in to continue."}
        </p>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-300"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Password
            <input
              type="password"
              required
              minLength={8}
              autoComplete={isSignup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-300"
            />
          </label>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {loading ? "Please wait…" : isSignup ? "Sign up" : "Log in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          {isSignup ? (
            <>
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-zinc-900 underline dark:text-zinc-50">
                Log in
              </Link>
            </>
          ) : (
            <>
              No account?{" "}
              <Link href="/signup" className="font-medium text-zinc-900 underline dark:text-zinc-50">
                Sign up
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
