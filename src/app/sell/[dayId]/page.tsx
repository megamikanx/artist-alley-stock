import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { endDay } from "@/app/alleys/actions";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/money";
import { Register } from "../register";

type EmbeddedItem = { name: string; size: string | null };
type EmbeddedAlley = { name: string };

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
  const { data: stock } = await supabase
    .from("items")
    .select("id, name, category, size, quantity, retail_price")
    .eq("artist_id", user.id)
    .order("name");
  const { data: sales } = await supabase
    .from("sales")
    .select(
      "id, quantity, unit_retail_price, unit_production_cost, items(name, size)",
    )
    .eq("day_id", day.id)
    .eq("artist_id", user.id)
    .order("sold_at", { ascending: false });

  const saleRows = (sales ?? []).map((sale) => {
    const item = first(sale.items as EmbeddedItem | EmbeddedItem[] | null);
    const profit =
      sale.quantity *
      (Number(sale.unit_retail_price) - Number(sale.unit_production_cost));
    return {
      id: sale.id,
      name: item
        ? `${item.name}${item.size ? ` (${item.size})` : ""}`
        : "Item",
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
      <Register
        dayId={day.id}
        isOpen={isOpen}
        profit={dayProfit.toFixed(2)}
        items={(stock ?? []).map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          size: item.size,
          quantity: item.quantity,
          retailPrice: String(item.retail_price),
        }))}
        sales={saleRows}
      />
    </main>
  );
}
