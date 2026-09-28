"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const categories = ["print", "sticker", "handmade"] as const;
const sizes = ["A3", "A4", "A5"] as const;

function itemErrorMessage(error: { code?: string; message: string }) {
  if (error.code === "23505") {
    return "You already have an item with this name, category, and size.";
  }
  if (error.code === "23514") {
    return "Prints need a size of A3, A4, or A5.";
  }
  return error.message;
}

function readItem(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const size = String(formData.get("size") ?? "").trim();
  const quantityRaw = String(formData.get("quantity") ?? "").trim();
  const productionRaw = String(formData.get("production_price") ?? "").trim();
  const retailRaw = String(formData.get("retail_price") ?? "").trim();
  const quantity = Number(quantityRaw);
  const money = /^\d+(\.\d{1,2})?$/;

  if (!name) return { error: "Enter a name." };
  if (!categories.includes(category as (typeof categories)[number])) {
    return { error: "Choose a category." };
  }
  if (!Number.isInteger(quantity) || quantity < 0) {
    return { error: "Quantity must be a whole number, zero or more." };
  }
  if (!money.test(productionRaw) || !money.test(retailRaw)) {
    return { error: "Prices need dollars and up to two cents." };
  }

  const printSize = sizes.includes(size as (typeof sizes)[number]) ? size : "";
  if (category === "print" && !printSize) {
    return { error: "Prints need a size of A3, A4, or A5." };
  }

  return {
    item: {
      name,
      category,
      size: category === "print" ? printSize : null,
      quantity,
      production_price: productionRaw,
      retail_price: retailRaw,
    },
  };
}

async function saveImage(
  itemId: number,
  artistId: string,
  formData: FormData,
) {
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > 5 * 1024 * 1024) return "Images need to be 5MB or smaller.";
  if (!file.type.startsWith("image/")) return "Choose an image file.";

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/gif"
          ? "gif"
          : "jpg";
  const path = `${artistId}/${itemId}.${ext}`;
  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage
    .from("item-images")
    .upload(path, new Uint8Array(await file.arrayBuffer()), {
      upsert: true,
      contentType: file.type,
    });
  if (uploadError) return uploadError.message;

  const { data } = supabase.storage.from("item-images").getPublicUrl(path);
  const { error } = await supabase
    .from("items")
    .update({
      image_path: `${data.publicUrl}?v=${Date.now()}`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId);

  return error?.message ?? null;
}

export async function createItem(formData: FormData) {
  const parsed = readItem(formData);
  if ("error" in parsed && parsed.error) {
    redirect(`/items/new?error=${encodeURIComponent(parsed.error)}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("items")
    .insert({
      ...parsed.item,
      artist_id: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect(
      `/items/new?error=${encodeURIComponent(
        itemErrorMessage(error ?? { message: "Could not save the item." }),
      )}`,
    );
  }

  const imageError = await saveImage(data.id, user.id, formData);
  if (imageError) {
    redirect(`/items/${data.id}?error=${encodeURIComponent(imageError)}`);
  }

  redirect("/");
}

export async function updateItem(formData: FormData) {
  const id = Number(formData.get("id"));
  const back = `/items/${id}`;
  const parsed = readItem(formData);
  if (!Number.isInteger(id)) redirect("/?error=missing");
  if ("error" in parsed && parsed.error) {
    redirect(`${back}?error=${encodeURIComponent(parsed.error)}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("items")
    .update({ ...parsed.item, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");

  if (error) {
    redirect(`${back}?error=${encodeURIComponent(itemErrorMessage(error))}`);
  }
  if (!data?.length) {
    redirect(`${back}?error=${encodeURIComponent("Item not found.")}`);
  }

  const { data: owner } = await supabase
    .from("items")
    .select("artist_id")
    .eq("id", id)
    .maybeSingle();
  if (owner) {
    const imageError = await saveImage(id, owner.artist_id, formData);
    if (imageError) {
      redirect(`${back}?error=${encodeURIComponent(imageError)}`);
    }
  }

  redirect("/");
}

export async function restockItem(formData: FormData) {
  const id = Number(formData.get("id"));
  const quantity = Number(formData.get("quantity"));
  const unitCost = Number(formData.get("unit_cost"));
  const back = `/items/${id}`;
  if (!Number.isInteger(id)) redirect("/?error=missing");
  if (!Number.isInteger(quantity) || quantity <= 0) {
    redirect(`${back}?error=${encodeURIComponent("Add at least one copy.")}`);
  }
  if (Number.isNaN(unitCost) || unitCost < 0) {
    redirect(`${back}?error=${encodeURIComponent("Cost cannot be negative.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("restock_item", {
    p_item_id: id,
    p_quantity: quantity,
    p_unit_cost: unitCost,
  });
  if (error) {
    redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  }
  redirect(back);
}