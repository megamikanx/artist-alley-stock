import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { endDay } from "@/app/alleys/actions";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/money";
import { Register } from "../register";

export const dynamic = "force-dynamic";

type EmbeddedAlley = { name: string };
type DaySale = {
  id: number;
  artist_name: string | null;
  item_name: string | null;
  size: string | null;
  quantity: number;
  unit_retail_price: string | number;
  unit_production_cost: string | number;
};
type TableSale = {
  id: number;
  day_id: number;
  alley_id: number | null;
  item_id: number;
  artist_id: string;
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
  noStore();
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
  const stockArtistIds = [
    ...new Set((stock ?? []).map((item) => item.artist_id)),
  ];
  const { data: artists } = stockArtistIds.length
    ? await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", stockArtistIds)
    : { data: [] };
  const artistName = new Map(
    (artists ?? []).map((artist) => [artist.id, artist.display_name]),
  );
  const { data: tableSales, error: tableError } = await supabase
    .from("sales")
    .select(
      "id, day_id, alley_id, item_id, artist_id, quantity, unit_retail_price, unit_production_cost",
    )
    .eq("day_id", day.id)
    .order("id", { ascending: false });
  const { data: fnSales, error: fnError } = await supabase.rpc("day_sales", {
    p_alley_id: day.alley_id,
    p_day_id: day.id,
  });
  const salesError = tableError ?? fnError;

  const listed = new Map<number, TableSale>();
  for (const sale of (tableSales ?? []) as TableSale[]) {
    listed.set(sale.id, sale);
  }
  const itemIds = [...listed.values()].map((sale) => sale.item_id);
  const artistIds = [...listed.values()].map((sale) => sale.artist_id);
  const { data: soldItems } = itemIds.length
    ? await supabase.from("items").select("id, name, size").in("id", itemIds)
    : { data: [] };
  const { data: soldArtists } = artistIds.length
    ? await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", artistIds)
    : { data: [] };
  const itemById = new Map((soldItems ?? []).map((item) => [item.id, item]));
  const soldArtistName = new Map(
    (soldArtists ?? []).map((artist) => [artist.id, artist.display_name]),
  );

  const saleRows = [...listed.values()].map((sale) => {
    const item = itemById.get(sale.item_id);
    const profit =
      Number(sale.quantity) *
      (Number(sale.unit_retail_price) - Number(sale.unit_production_cost));
    const size = item?.size ? ` (${item.size})` : "";
    return {
      id: sale.id,
      name: item ? `${item.name}${size}` : `Item ${sale.item_id}`,
      artist: soldArtistName.get(sale.artist_id) ?? "",
      quantity: sale.quantity,
      retail: String(sale.unit_retail_price),
      profit: profit.toFixed(2),
    };
  });
  for (const sale of (fnSales ?? []) as DaySale[]) {
    if (saleRows.some((row) => row.id === sale.id)) continue;
    const profit =
      Number(sale.quantity) *
      (Number(sale.unit_retail_price) - Number(sale.unit_production_cost));
    const size = sale.size ? ` (${sale.size})` : "";
    saleRows.push({
      id: sale.id,
      name: sale.item_name ? `${sale.item_name}${size}` : "Item",
      artist: sale.artist_name ?? "",
      quantity: sale.quantity,
      retail: String(sale.unit_retail_price),
      profit: profit.toFixed(2),
    });
  }
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
