"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  return (
    <button
      onClick={logout}
      className="rounded-lg border border-black/10 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-black/[.04] dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/[.06]"
    >
      Log out
    </button>
  );
}
