import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/money";
import { loadPersonalProfit } from "@/lib/profit";

export default async function AlleysPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .maybeSingle();
  const { data: alleys, error } = await supabase
    .from("alleys")
    .select("id, name, starts_on, ends_on, tabling_fee")
    .order("starts_on", { ascending: false });
  const { data: memberships } = await supabase
    .from("alley_artists")
    .select("alley_id");
  const artistsByAlley = new Map<number, number>();
  for (const membership of memberships ?? []) {
    artistsByAlley.set(
      membership.alley_id,
      (artistsByAlley.get(membership.alley_id) ?? 0) + 1,
    );
  }
  const isAdmin = profile?.role === "admin";
  const personal = user ? await loadPersonalProfit(supabase, user.id) : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-16">
      <Link href="/" className="text-sm underline">
        Back to stock
      </Link>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-4xl font-semibold tracking-tight">Alleys</h1>
        {isAdmin ? (
          <Link href="/alleys/new" className="text-sm underline">
            New alley
          </Link>
        ) : null}
      </div>
      {error ? <p className="text-red-600">{error.message}</p> : null}
      {alleys && alleys.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-300 text-left">
                <th className="py-2 pr-3 font-medium">Alley</th>
                <th className="py-2 pr-3 font-medium">Dates</th>
                <th className="py-2 pr-3 font-medium">Artists</th>
                <th className="py-2 pr-3 font-medium">Fee</th>
                <th className="py-2 pr-3 font-medium">Your share</th>
                <th className="py-2 font-medium">Your profit</th>
              </tr>
            </thead>
            <tbody>
              {alleys.map((alley) => {
                const artistCount = artistsByAlley.get(alley.id) ?? 0;
                const yours = personal?.byAlley.get(alley.id);
                return (
                  <tr key={alley.id} className="border-b border-neutral-200">
                    <td className="py-2 pr-3">
                      <Link href={`/alleys/${alley.id}`} className="underline">
                        {alley.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">
                      {alley.starts_on ?? "—"} – {alley.ends_on ?? "—"}
                    </td>
                    <td className="py-2 pr-3">{artistCount}</td>
                    <td className="py-2 pr-3">${money(alley.tabling_fee)}</td>
                    <td className="py-2 pr-3">
                      {yours?.participating ? `$${money(yours.share)}` : "—"}
                    </td>
                    <td className="py-2">
                      {yours?.participating ? `$${money(yours.profit)}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-neutral-600">No alleys yet.</p>
      )}
    </main>
  );
}