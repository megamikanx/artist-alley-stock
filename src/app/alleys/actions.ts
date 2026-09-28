"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function alleyErrorMessage(error: { code?: string; message: string }) {
  if (error.code === "42501" || error.message.includes("row-level security")) {
    return "Only an admin can change an alley.";
  }
  return error.message;
}

type AlleyFields = {
  name: string;
  starts_on: string | null;
  ends_on: string | null;
  tabling_fee: string;
  notes: string | null;
};

type ParsedAlley =
  | { ok: false; error: string }
  | { ok: true; alley: AlleyFields; artistIds: string[] };

function readAlley(formData: FormData): ParsedAlley {
  const name = String(formData.get("name") ?? "").trim();
  const startsOn = String(formData.get("starts_on") ?? "").trim();
  const endsOn = String(formData.get("ends_on") ?? "").trim();
  const feeRaw = String(formData.get("tabling_fee") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const artistIds = formData
    .getAll("artist_id")
    .map((value) => String(value))
    .filter((value) => value.length > 0);
  const date = /^\d{4}-\d{2}-\d{2}$/;
  const money = /^\d+(\.\d{1,2})?$/;

  if (!name) return { ok: false, error: "Enter a name." };
  if (startsOn && !date.test(startsOn)) {
    return { ok: false, error: "Start date is invalid." };
  }
  if (endsOn && !date.test(endsOn)) {
    return { ok: false, error: "End date is invalid." };
  }
  if (startsOn && endsOn && endsOn < startsOn) {
    return { ok: false, error: "The end date is before the start date." };
  }
  if (!money.test(feeRaw)) {
    return { ok: false, error: "The tabling fee needs dollars and up to two cents." };
  }
  if (artistIds.length === 0) {
    return { ok: false, error: "Choose at least one artist." };
  }

  return {
    ok: true,
    alley: {
      name,
      starts_on: startsOn || null,
      ends_on: endsOn || null,
      tabling_fee: feeRaw,
      notes: notes || null,
    },
    artistIds,
  };
}

async function saveArtists(alleyId: number, artistIds: string[]) {
  const supabase = await createClient();
  const { error: deleteError } = await supabase
    .from("alley_artists")
    .delete()
    .eq("alley_id", alleyId);
  if (deleteError) return deleteError;

  const { error } = await supabase.from("alley_artists").insert(
    artistIds.map((artistId) => ({
      alley_id: alleyId,
      artist_id: artistId,
    })),
  );
  return error;
}

export async function createAlley(formData: FormData) {
  const parsed = readAlley(formData);
  if (!parsed.ok) {
    redirect(`/alleys/new?error=${encodeURIComponent(parsed.error)}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("alleys")
    .insert(parsed.alley)
    .select("id")
    .single();

  if (error || !data) {
    redirect(
      `/alleys/new?error=${encodeURIComponent(
        alleyErrorMessage(error ?? { message: "Could not save the alley." }),
      )}`,
    );
  }

  const memberError = await saveArtists(data.id, parsed.artistIds);
  if (memberError) {
    redirect(
      `/alleys/${data.id}?error=${encodeURIComponent(alleyErrorMessage(memberError))}`,
    );
  }

  redirect(`/alleys/${data.id}`);
}

export async function updateAlley(formData: FormData) {
  const id = Number(formData.get("id"));
  const back = `/alleys/${id}`;
  const parsed = readAlley(formData);
  if (!Number.isInteger(id)) redirect("/alleys");
  if (!parsed.ok) {
    redirect(`${back}?error=${encodeURIComponent(parsed.error)}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("alleys")
    .update(parsed.alley)
    .eq("id", id)
    .select("id");

  if (error) {
    redirect(`${back}?error=${encodeURIComponent(alleyErrorMessage(error))}`);
  }
  if (!data?.length) {
    redirect(`${back}?error=${encodeURIComponent("Alley not found.")}`);
  }

  const memberError = await saveArtists(id, parsed.artistIds);
  if (memberError) {
    redirect(`${back}?error=${encodeURIComponent(alleyErrorMessage(memberError))}`);
  }

  redirect(back);
}

export async function openDay(formData: FormData) {
  const alleyId = Number(formData.get("alley_id"));
  const back = `/alleys/${alleyId}`;
  if (!Number.isInteger(alleyId)) redirect("/alleys");

  const supabase = await createClient();
  const { count, error: countError } = await supabase
    .from("days")
    .select("id", { count: "exact", head: true })
    .eq("alley_id", alleyId);

  if (countError) {
    redirect(`${back}?error=${encodeURIComponent(countError.message)}`);
  }

  const { error } = await supabase.from("days").insert({
    alley_id: alleyId,
    label: `Day ${(count ?? 0) + 1}`,
  });

  if (error) {
    const message =
      error.code === "23505"
        ? "End the open day before opening another."
        : error.message;
    redirect(`${back}?error=${encodeURIComponent(message)}`);
  }

  redirect(back);
}

export async function endDay(formData: FormData) {
  const alleyId = Number(formData.get("alley_id"));
  const dayId = Number(formData.get("day_id"));
  const back = `/alleys/${alleyId}`;
  const supabase = await createClient();
  const { error } = await supabase.rpc("end_day", { p_day_id: dayId });

  if (error) {
    redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(back);
}