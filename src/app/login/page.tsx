import { signInWithEmail, signInWithOAuth } from "./actions";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; sent?: string };
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <h1 className="text-3xl font-serif">Sign in</h1>
      <p className="mt-2 text-sm opacity-80">
        We&apos;ll email you a magic link. No passwords.
      </p>

      {searchParams.sent && (
        <p className="mt-4 border border-rule px-3 py-2 text-sm">
          Check your email for the sign-in link.
        </p>
      )}
      {searchParams.error && (
        <p className="mt-4 border border-red-400 px-3 py-2 text-sm text-red-700">
          {searchParams.error}
        </p>
      )}

      <form action={signInWithEmail} className="mt-6 space-y-3">
        <input
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          className="w-full border border-ink bg-transparent px-3 py-2"
        />
        <button
          type="submit"
          className="w-full border border-ink px-3 py-2 hover:bg-ink hover:text-parchment"
        >
          Send magic link
        </button>
      </form>

      <div className="my-6 text-center text-xs uppercase tracking-widest opacity-60">
        or
      </div>

      <div className="space-y-2">
        <form action={async () => { "use server"; await signInWithOAuth("google"); }}>
          <button className="w-full border border-ink px-3 py-2 hover:bg-ink hover:text-parchment">
            Continue with Google
          </button>
        </form>
        <form action={async () => { "use server"; await signInWithOAuth("apple"); }}>
          <button className="w-full border border-ink px-3 py-2 hover:bg-ink hover:text-parchment">
            Continue with Apple
          </button>
        </form>
      </div>
    </main>
  );
}
