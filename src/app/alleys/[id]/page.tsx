import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateAlley } from "../actions";
import { AlleyForm } from "../alley-form";

export default async function AlleyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
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
  const { data: alley } = await supabase
    .from("alleys")
    .select("id, name, starts_on, ends_on, tabling_fee, notes")
    .eq("id", Number(id))
    .maybeSingle();

  if (!alley) notFound();

  const { data: members } = await supabase
    .from("alley_artists")
    .select("artist_id")
    .eq("alley_id", alley.id);
  const { data: artists } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .order("display_name");
  const { data: profit } = await supabase
    .from("alley_profits")
    .select("days_profit, profit, tabling_fee")
    .eq("alley_id", alley.id)
    .maybeSingle();

  const isAdmin = profile?.role === "admin";

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-16">
      <Link href="/alleys" className="text-sm underline">
        Back to alleys
      </Link>
      <h1 className="text-4xl font-semibold tracking-tight">{alley.name}</h1>
      <p className="text-neutral-700">
        Sales profit ${profit?.days_profit ?? "0.00"} · fee $
        {profit?.tabling_fee ?? alley.tabling_fee} · alley profit $
        {profit?.profit ?? "0.00"}
      </p>
      <p className="text-sm text-neutral-500">No days yet.</p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {isAdmin ? (
        <AlleyForm
          action={updateAlley}
          submitLabel="Save changes"
          alley={alley}
          artists={artists ?? []}
          selectedIds={(members ?? []).map((member) => member.artist_id)}
        />
      ) : (
        <p>You are tabling at this alley.</p>
      )}
    </main>
  );
}