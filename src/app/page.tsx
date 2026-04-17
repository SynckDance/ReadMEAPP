import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Landing() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <h1 className="text-5xl font-serif tracking-tight">ReadMEAPP</h1>
      <p className="mt-4 max-w-prose text-lg">
        A research reader. Read long works. Highlight, outline, and think.
        Build a <em>Desk</em> of ongoing study. Fill a <em>Knowledge Bucket</em> with ideas that last.
      </p>
      <div className="mt-10 flex gap-4">
        {user ? (
          <Link
            href="/library"
            className="border border-ink px-5 py-2 hover:bg-ink hover:text-parchment"
          >
            Open library
          </Link>
        ) : (
          <Link
            href="/login"
            className="border border-ink px-5 py-2 hover:bg-ink hover:text-parchment"
          >
            Sign in
          </Link>
        )}
      </div>
    </main>
  );
}
