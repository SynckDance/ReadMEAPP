import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-6">
      <header className="flex items-center justify-between border-b border-rule pb-4">
        <Link href="/" className="font-serif text-xl">
          ReadMEAPP
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/library">Library</Link>
          <Link href="/desks">Desks</Link>
          <Link href="/bucket">Bucket</Link>
          <form action={signOut}>
            <button className="opacity-70 hover:opacity-100">Sign out</button>
          </form>
        </nav>
      </header>
      <div className="flex-1 py-8">{children}</div>
    </div>
  );
}
