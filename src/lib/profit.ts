import type { SupabaseClient } from "@supabase/supabase-js";
import { splitFee } from "@/lib/money";

type SaleDay = { alley_id: number } | { alley_id: number }[] | null;

function alleyIdFromDay(days: SaleDay) {
  if (!days) return null;
  const row = Array.isArray(days) ? days[0] : days;
  return row?.alley_id ?? null;
}

export type AlleyProfit = {
  alleyId: number;
  margin: number;
  share: number;
  profit: number;
  participating: boolean;
};

export type PersonalProfit = {
  byAlley: Map<number, AlleyProfit>;
  fromAlleys: number;
  unsoldRestockCost: number;
  total: number;
  restockError: string | null;
};

// Newest restocks are what is still on the shelf. Sold units already
// reduced alley profit, so the dashboard only subtracts the restock
// cost that has not sold yet.
function unsoldRestockCost(
  quantityOnHand: number,
  restocks: { quantity: number; unit_cost: string | number; restocked_at: string }[],
) {
  const restocked = restocks.reduce((sum, row) => sum + row.quantity, 0);
  let remaining = Math.min(Math.max(quantityOnHand, 0), restocked);
  const newestFirst = [...restocks].sort((a, b) =>
    a.restocked_at < b.restocked_at ? 1 : -1,
  );
  let cost = 0;
  for (const row of newestFirst) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, row.quantity);
    cost += take * Number(row.unit_cost);
    remaining -= take;
  }
  return cost;
}

export async function loadPersonalProfit(
  supabase: SupabaseClient,
  userId: string,
): Promise<PersonalProfit> {
  const { data: memberships } = await supabase
    .from("alley_artists")
    .select("alley_id, artist_id");
  const { data: sales } = await supabase
    .from("sales")
    .select("quantity, unit_retail_price, unit_production_cost, days!inner(alley_id)")
    .eq("artist_id", userId);
  const { data: items } = await supabase
    .from("items")
    .select("id, quantity")
    .eq("artist_id", userId);
  const { data: restocks, error: restockError } = await supabase
    .from("restocks")
    .select("item_id, quantity, unit_cost, restocked_at")
    .eq("artist_id", userId);

  const counts = new Map<number, number>();
  const mine = new Set<number>();
  for (const row of memberships ?? []) {
    counts.set(row.alley_id, (counts.get(row.alley_id) ?? 0) + 1);
    if (row.artist_id === userId) mine.add(row.alley_id);
  }

  const marginByAlley = new Map<number, number>();
  for (const sale of sales ?? []) {
    const alleyId = alleyIdFromDay(sale.days as SaleDay);
    if (alleyId == null) continue;
    const margin =
      (Number(sale.unit_retail_price) - Number(sale.unit_production_cost)) *
      sale.quantity;
    marginByAlley.set(alleyId, (marginByAlley.get(alleyId) ?? 0) + margin);
  }

  const { data: alleys } = await supabase.from("alleys").select("id, tabling_fee");
  const byAlley = new Map<number, AlleyProfit>();
  for (const alley of alleys ?? []) {
    const participating = mine.has(alley.id);
    const share = participating
      ? splitFee(alley.tabling_fee, counts.get(alley.id) ?? 0)
      : 0;
    const margin = marginByAlley.get(alley.id) ?? 0;
    const profit = participating ? margin - share : 0;
    byAlley.set(alley.id, {
      alleyId: alley.id,
      margin,
      share,
      profit,
      participating,
    });
  }

  const fromAlleys = [...byAlley.values()]
    .filter((row) => row.participating)
    .reduce((sum, row) => sum + row.profit, 0);

  const restocksByItem = new Map<
    number,
    { quantity: number; unit_cost: string | number; restocked_at: string }[]
  >();
  for (const row of restocks ?? []) {
    const list = restocksByItem.get(row.item_id) ?? [];
    list.push(row);
    restocksByItem.set(row.item_id, list);
  }
  const unsold = (items ?? []).reduce((sum, item) => {
    return sum + unsoldRestockCost(item.quantity, restocksByItem.get(item.id) ?? []);
  }, 0);

  return {
    byAlley,
    fromAlleys,
    unsoldRestockCost: unsold,
    total: fromAlleys - unsold,
    restockError: restockError?.message ?? null,
  };
}
