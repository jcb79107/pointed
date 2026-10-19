import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { AccountDeletion } from "@/components/AccountDeletion";
import { Brand } from "@/components/Brand";
export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sessions?returnTo=/account");
  return <main className="information-page"><Brand /><article><h1>Your account</h1><p>{user.displayName}</p><AccountDeletion /><p><Link href="/privacy">How your data is stored</Link></p><Link href="/sessions">Back to sessions</Link></article></main>;
}
