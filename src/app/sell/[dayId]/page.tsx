import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { endDay } from "@/app/alleys/actions";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/money";
import { Register } from "../register";

export const dynamic = "force-dynamic";

type EmbeddedAlley = { name: string };
type DaySale = {
  id: number;
  artist_name: string;
  item_name: string;
  size: string | null;
  quantity: number;
  unit_retail_price: string | number;
  unit_production_cost: string | number;
};

function first<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function SellPage({
  params,
}: {
  params: Promise<{ dayId: string }>;
}) {
  const { dayId } = await params;
  const id = Number(dayId);
  if (!Number.isInteger(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: day } = await supabase
    .from("days")
    .select("id, label, status, alley_id, alleys(name)")
    .eq("id", id)
    .maybeSingle();

  if (!day) notFound();

  const alley = first(day.alleys as EmbeddedAlley | EmbeddedAlley[] | null);
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const { data: adminFlag } = await supabase.rpc("is_admin");
  const isAdmin = adminFlag === true || profile?.role === "admin";
  let stockQuery = supabase
    .from("items")
    .select(
      "id, name, category, size, quantity, retail_price, image_path, artist_id",
    )
    .order("name");
  if (!isAdmin) stockQuery = stockQuery.eq("artist_id", user.id);
  const { data: stock, error: stockError } = await stockQuery;
  const { data: sales, error: salesError } = await supabase.rpc("day_sales", {
    p_alley_id: day.alley_id,
    p_day_id: day.id,
  });

  const nameIds = [...new Set((stock ?? []).map((item) => item.artist_id))];
  const { data: artists } = nameIds.length
    ? await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", nameIds)
    : { data: [] };
  const artistName = new Map(
    (artists ?? []).map((artist) => [artist.id, artist.display_name]),
  );

  const saleRows = ((sales ?? []) as DaySale[]).map((sale) => {
    const profit =
      sale.quantity *
      (Number(sale.unit_retail_price) - Number(sale.unit_production_cost));
    return {
      id: sale.id,
      name: sale.item_name
        ? `${sale.item_name}${sale.size ? ` (${sale.size})` : ""}`
        : "Item",
      artist: sale.artist_name ?? "",
      quantity: sale.quantity,
      retail: String(sale.unit_retail_price),
      profit: profit.toFixed(2),
    };
  });
  const dayProfit = saleRows.reduce(
    (sum, sale) => sum + Number(sale.profit),
    0,
  );
  const isOpen = day.status === "open";

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href={`/alleys/${day.alley_id}`}
            className="text-sm underline"
          >
            Back to {alley?.name ?? "alley"}
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">
            {day.label}
            {isOpen ? "" : " · closed"}
          </h1>
        </div>
        {isOpen ? (
          <form action={endDay}>
            <input type="hidden" name="alley_id" value={day.alley_id} />
            <input type="hidden" name="day_id" value={day.id} />
            <button
              type="submit"
              className="rounded border border-neutral-900 px-4 py-2"
            >
              End day
            </button>
          </form>
        ) : null}
      </div>
      {salesError ? (
        <p className="text-sm text-red-600">{salesError.message}</p>
      ) : null}
      {stockError ? (
        <p className="text-sm text-red-600">{stockError.message}</p>
      ) : null}
      <Register
        dayId={day.id}
        isOpen={isOpen}
        profit={dayProfit.toFixed(2)}
        profitLabel={isAdmin ? "Sales profit" : "Your profit"}
        items={(stock ?? []).map((item) => ({
          id: item.id,
          name: item.name,
          artist: isAdmin ? (artistName.get(item.artist_id) ?? "") : "",
          category: item.category,
          size: item.size,
          quantity: item.quantity,
          retailPrice: String(item.retail_price),
          imageUrl: item.image_path,
        }))}
        sales={saleRows}
      />
    </main>
  );
}
