import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import PaperReader from "@/components/PaperReader";

export default async function PaperPage({
  params,
}: {
  params: Promise<{ req_id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { req_id } = await params;
  return <PaperReader reqId={req_id} userEmail={user.email} />;
}
