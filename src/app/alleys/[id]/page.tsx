import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { endDay, openDay, updateAlley } from "../actions";
import { AlleyForm } from "../alley-form";
import { money, splitFee } from "@/lib/money";
import { loadPersonalProfit } from "@/lib/profit";

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
    .select("artist_id, profiles(display_name)")
    .eq("alley_id", alley.id);
  const { data: artists } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .order("display_name");
  const { data: profit } = await supabase
    .from("alley_profits")
    .select("days_profit")
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
  const artistCount = members?.length ?? 0;
  const salesProfit = Number(profit?.days_profit ?? 0);
  const feeShare = splitFee(alley.tabling_fee, artistCount);
  const alleyProfit = isAdmin ? salesProfit - Number(alley.tabling_fee) : salesProfit - feeShare;
  const personal = user ? await loadPersonalProfit(supabase, user.id) : null;
  const yours = personal?.byAlley.get(alley.id);

  const artistTotals = new Map<
    string,
    { name: string; units: number; revenue: number; profit: number }
  >();
  for (const member of members ?? []) {
    const profileRow = member.profiles as
      | { display_name: string }
      | { display_name: string }[]
      | null;
    const name = Array.isArray(profileRow)
      ? profileRow[0]?.display_name
      : profileRow?.display_name;
    artistTotals.set(member.artist_id, {
      name: name ?? "Artist",
      units: 0,
      revenue: 0,
      profit: 0,
    });
  }

  let artistSalesError: string | null = null;
  if (isAdmin) {
    const { data: summed, error: summedError } = await supabase.rpc(
      "alley_artist_sales",
      { p_alley_id: alley.id },
    );
    if (summedError || !summed) {
      const dayIds = (days ?? []).map((day) => day.id);
      const { data: sales, error: salesError } = dayIds.length
        ? await supabase
            .from("sales")
            .select(
              "artist_id, quantity, unit_retail_price, unit_production_cost",
            )
            .in("day_id", dayIds)
        : { data: [], error: null };
      artistSalesError = salesError?.message ?? null;
      for (const sale of sales ?? []) {
        const current = artistTotals.get(sale.artist_id) ?? {
          name: "Artist",
          units: 0,
          revenue: 0,
          profit: 0,
        };
        current.units += sale.quantity;
        current.revenue += sale.quantity * Number(sale.unit_retail_price);
        current.profit +=
          sale.quantity *
          (Number(sale.unit_retail_price) - Number(sale.unit_production_cost));
        artistTotals.set(sale.artist_id, current);
      }
    } else {
      for (const row of summed as {
        artist_id: string;
        artist_name: string;
        units: number;
        revenue: string | number;
        profit: string | number;
      }[]) {
        const current = artistTotals.get(row.artist_id) ?? {
          name: row.artist_name ?? "Artist",
          units: 0,
          revenue: 0,
          profit: 0,
        };
        current.name = row.artist_name ?? current.name;
        current.units += row.units;
        current.revenue += Number(row.revenue);
        current.profit += Number(row.profit);
        artistTotals.set(row.artist_id, current);
      }
    }
  }
  const artistSales = [...artistTotals.entries()].sort((a, b) =>
    a[1].name.localeCompare(b[1].name),
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-16">
      <Link href="/alleys" className="text-sm underline">
        Back to alleys
      </Link>
      <h1 className="text-4xl font-semibold tracking-tight">{alley.name}</h1>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          {isAdmin ? "Alley profit" : "Your profit"}
        </h2>
        <p className="text-sm text-neutral-600">
          The artists checked below are the people who can sign in and see this
          alley. The fee is divided by that count. Each person pays $
          {money(feeShare)}.
          {isAdmin
            ? " The alley total still subtracts the full fee once."
            : " Your total subtracts only your share."}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-300 text-left">
                <th className="py-2 pr-3 font-medium">Sales profit</th>
                <th className="py-2 pr-3 font-medium">Artists</th>
                <th className="py-2 pr-3 font-medium">Full fee</th>
                <th className="py-2 pr-3 font-medium">Your share</th>
                <th className="py-2 font-medium">Profit</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-2 pr-3">${money(salesProfit)}</td>
                <td className="py-2 pr-3">{artistCount}</td>
                <td className="py-2 pr-3">${money(alley.tabling_fee)}</td>
                <td className="py-2 pr-3">${money(feeShare)}</td>
                <td className="py-2">${money(alleyProfit)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {yours?.participating ? (
          <p className="text-sm">
            Your profit at this alley ${money(yours.profit)}. That is your own
            sales minus your fee share. Restock spending is not included here.
          </p>
        ) : null}
      </section>
      {isAdmin ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Sales by artist</h2>
          <p className="text-sm text-neutral-600">
            Totals for every sale at this alley. 
            Profit = Revenue - Production Cost.
            After fee = Profit - Tabling fee.
          </p>
          {artistSalesError ? (
            <p className="text-sm text-red-600">{artistSalesError}</p>
          ) : null}
          {artistSales.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-neutral-300 text-left">
                    <th className="py-2 pr-3 font-medium">Artist</th>
                    <th className="py-2 pr-3 font-medium">Sold</th>
                    <th className="py-2 pr-3 font-medium">Revenue</th>
                    <th className="py-2 pr-3 font-medium">Profit</th>
                    <th className="py-2 font-medium">After fee</th>
                  </tr>
                </thead>
                <tbody>
                  {artistSales.map(([artistId, row]) => (
                    <tr key={artistId} className="border-b border-neutral-200">
                      <td className="py-2 pr-3">
                        {row.name}
                        {artistId === user?.id ? " (you)" : ""}
                      </td>
                      <td className="py-2 pr-3">{row.units}</td>
                      <td className="py-2 pr-3">${money(row.revenue)}</td>
                      <td className="py-2 pr-3">${money(row.profit)}</td>
                      <td className="py-2">${money(row.profit - feeShare)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">No artists on this alley.</p>
          )}
        </section>
      ) : null}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Artists</h2>
        {members && members.length > 0 ? (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-300 text-left">
                <th className="py-2 pr-3 font-medium">Artist</th>
                <th className="py-2 font-medium">Fee share</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const profileRow = member.profiles as
                  | { display_name: string }
                  | { display_name: string }[]
                  | null;
                const name = Array.isArray(profileRow)
                  ? profileRow[0]?.display_name
                  : profileRow?.display_name;
                return (
                  <tr key={member.artist_id} className="border-b border-neutral-200">
                    <td className="py-2 pr-3">
                      {name ?? "Artist"}
                      {member.artist_id === user?.id ? " (you)" : ""}
                    </td>
                    <td className="py-2">${money(feeShare)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-neutral-500">No artists on this alley.</p>
        )}
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Days</h2>
        {days && days.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-300 text-left">
                  <th className="py-2 pr-3 font-medium">Day</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Sales profit</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {days.map((day) => (
                  <tr key={day.id} className="border-b border-neutral-200">
                    <td className="py-2 pr-3">{day.label}</td>
                    <td className="py-2 pr-3">{day.status}</td>
                    <td className="py-2 pr-3">
                      ${money(profitByDay.get(day.id) ?? 0)}
                    </td>
                    <td className="py-2">
                      <span className="flex items-center gap-3">
                        <Link href={`/sell/${day.id}`} className="underline">
                          {day.status === "open" ? "Sell" : "Summary"}
                        </Link>
                        {day.status === "open" ? (
                          <form action={endDay}>
                            <input type="hidden" name="alley_id" value={alley.id} />
                            <input type="hidden" name="day_id" value={day.id} />
                            <button type="submit" className="underline">
                              End day
                            </button>
                          </form>
                        ) : null}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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