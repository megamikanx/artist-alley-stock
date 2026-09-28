import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { endDay, openDay, updateAlley } from "../actions";
import { AlleyForm } from "../alley-form";
import { money } from "@/lib/money";

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
  const { data: days } = await supabase
    .from("days")
    .select("id, label, status")
    .eq("alley_id", alley.id)
    .order("id");
  const { data: dayProfits } = await supabase
    .from("day_profits")
    .select("day_id, profit")
    .eq("alley_id", alley.id);

  const profitByDay = new Map(
    (dayProfits ?? []).map((row) => [row.day_id, row.profit]),
  );

  const hasOpenDay = days?.some((day) => day.status === "open");
  const isAdmin = profile?.role === "admin";

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-16">
      <Link href="/alleys" className="text-sm underline">
        Back to alleys
      </Link>
      <h1 className="text-4xl font-semibold tracking-tight">{alley.name}</h1>
      <p className="text-neutral-700">
        Sales profit ${money(profit?.days_profit ?? 0)} · fee $
        {money(profit?.tabling_fee ?? alley.tabling_fee)} · alley profit $
        {money(profit?.profit ?? 0)}
      </p>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Days</h2>
        {days && days.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {days.map((day) => (
              <li key={day.id} className="flex items-center gap-3">
                <span>
                  {day.label} — {day.status} · profit $
                  {money(profitByDay.get(day.id) ?? 0)}
                </span>
                <Link href={`/sell/${day.id}`} className="text-sm underline">
                  {day.status === "open" ? "Sell" : "Summary"}
                </Link>
                {day.status === "open" ? (
                  <form action={endDay}>
                    <input type="hidden" name="alley_id" value={alley.id} />
                    <input type="hidden" name="day_id" value={day.id} />
                    <button type="submit" className="text-sm underline">
                      End day
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">No days yet.</p>
        )}
        {hasOpenDay ? null : (
          <form action={openDay}>
            <input type="hidden" name="alley_id" value={alley.id} />
            <button
              type="submit"
              className="rounded bg-neutral-900 px-4 py-2 text-white"
            >
              Open day {(days?.length ?? 0) + 1}
            </button>
          </form>
        )}
      </section>
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