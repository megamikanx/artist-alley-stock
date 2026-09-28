import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { restockItem, updateItem } from "../actions";
import { ItemForm } from "../item-form";
import type { ItemCategory, ItemSize } from "../types";

export default async function EditItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("items")
    .select(
      "id, name, category, size, quantity, production_price, retail_price, image_path",
    )
    .eq("id", Number(id))
    .maybeSingle();

  if (!item) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-16">
      <Link href="/" className="text-sm underline">
        Back to stock
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">Edit item</h1>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <form action={restockItem} className="flex flex-col gap-3 border border-neutral-200 p-4">
        <h2 className="text-lg font-semibold">Restock</h2>
        <p className="text-sm text-neutral-600">
          This adds copies and records what you paid. The spend lowers your
          total profit on the dashboard until those copies sell. It does not
          change any alley&apos;s profit.
        </p>
        <input type="hidden" name="id" value={item.id} />
        <label className="flex flex-col gap-1 text-sm">
          Copies to add
          <input
            name="quantity"
            type="number"
            min={1}
            step={1}
            required
            className="border border-neutral-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Cost each
          <input
            name="unit_cost"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={item.production_price}
            className="border border-neutral-300 px-2 py-1"
          />
        </label>
        <button type="submit" className="w-fit border border-neutral-800 px-3 py-1 text-sm">
          Log restock
        </button>
      </form>
      <ItemForm
        action={updateItem}
        submitLabel="Save changes"
        item={{
          ...item,
          category: item.category as ItemCategory,
          size: item.size as ItemSize | null,
        }}
      />
    </main>
  );
}