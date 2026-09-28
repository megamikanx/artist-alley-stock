import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateItem } from "../actions";
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
      "id, name, category, size, quantity, production_price, retail_price",
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