"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function recordSale(formData: FormData) {
  const dayId = Number(formData.get("day_id"));
  const itemId = Number(formData.get("item_id"));
  const quantity = Number(formData.get("quantity"));

  if (!Number.isInteger(dayId) || !Number.isInteger(itemId)) {
    return { error: "That sale could not be recorded." };
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { error: "Quantity must be a whole number of at least 1." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_sale", {
    p_day_id: dayId,
    p_item_id: itemId,
    p_quantity: quantity,
  });

  if (error) return { error: error.message };

  revalidatePath(`/sell/${dayId}`);
  revalidatePath("/");
  return { error: null };
}

export async function voidSale(formData: FormData) {
  const dayId = Number(formData.get("day_id"));
  const saleId = Number(formData.get("sale_id"));

  if (!Number.isInteger(dayId) || !Number.isInteger(saleId)) {
    return { error: "That sale could not be removed." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("void_sale", { p_sale_id: saleId });

  if (error) return { error: error.message };

  revalidatePath(`/sell/${dayId}`);
  revalidatePath("/");
  return { error: null };
}
