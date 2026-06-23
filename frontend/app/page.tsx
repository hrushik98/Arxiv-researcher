import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import HomeClient from "@/components/HomeClient";
import LogoutButton from "@/components/LogoutButton";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between border-b border-black/10 px-6 py-4 dark:border-white/10">
        <span className="font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Arxiv Researcher
        </span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">{user.email}</span>
          <LogoutButton />
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="mb-3 max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-zinc-900 dark:text-zinc-50">
          Read any arxiv paper with an AI assistant
        </h1>
        <p className="mb-8 max-w-md text-zinc-500 dark:text-zinc-400">
          Paste an arxiv link. We&apos;ll load the PDF and let you chat with it,
          highlight passages, and ask questions.
        </p>
        <HomeClient />
      </main>
    </div>
  );
}
