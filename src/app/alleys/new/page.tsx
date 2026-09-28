import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAlley } from "../actions";
import { AlleyForm } from "../alley-form";

export default async function NewAlleyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .maybeSingle();
  const { data: artists } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .order("display_name");

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-16">
      <Link href="/alleys" className="text-sm underline">
        Back to alleys
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">New alley</h1>
      {profile?.role === "admin" ? (
        <>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <AlleyForm
            action={createAlley}
            submitLabel="Save alley"
            artists={artists ?? []}
            selectedIds={user ? [user.id] : []}
          />
        </>
      ) : (
        <p>Only an admin can create an alley.</p>
      )}
    </main>
  );
}