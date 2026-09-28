import { signIn } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
      {error ? (
        <p className="text-sm text-red-600">
          Email or password did not match.
        </p>
      ) : null}
      <form action={signIn} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            className="rounded border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            name="password"
            type="password"
            required
            className="rounded border border-neutral-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-neutral-900 px-4 py-2 text-white"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}