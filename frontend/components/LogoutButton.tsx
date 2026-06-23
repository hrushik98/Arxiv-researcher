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
      className="bg-primary-container text-white px-6 py-2 text-xs font-semibold uppercase tracking-widest transition-all duration-300 active:scale-95 hover:shadow-lg"
    >
      Log out
    </button>
  );
}
