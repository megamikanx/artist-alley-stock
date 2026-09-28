import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/money";
import { loadPersonalProfit } from "@/lib/profit";
import { signOut } from "./login/actions";

const categories = ["print", "sticker", "handmade"] as const;
const sizes = ["A3", "A4", "A5"] as const;

type ArtistName = { display_name: string };

function artistName(value: ArtistName | ArtistName[] | null) {
  if (!value) return "Unknown";
  const row = Array.isArray(value) ? value[0] : value;
  return row?.display_name ?? "Unknown";
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    size?: string;
    artist?: string;
    q?: string;
  }>;
}) {
  const filters = await searchParams;
  const category = categories.includes(
    filters.category as (typeof categories)[number],
  )
    ? filters.category
    : "";
  const size = sizes.includes(filters.size as (typeof sizes)[number])
    ? filters.size
    : "";
  const artist = filters.artist ?? "";
  const q = (filters.q ?? "").trim().replace(/[%_]/g, "");
  const filtering = Boolean(category || size || artist || q);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("id", user?.id ?? "")
    .maybeSingle();
  const { data: artists } = await supabase
    .from("profiles")
    .select("id, display_name")
    .order("display_name");

  let itemQuery = supabase
    .from("items")
    .select(
      "id, name, category, size, quantity, production_price, retail_price, image_path, profiles(display_name)",
    )
    .order("name");
  if (category) itemQuery = itemQuery.eq("category", category);
  if (size) itemQuery = itemQuery.eq("size", size);
  if (artist) itemQuery = itemQuery.eq("artist_id", artist);
  if (q) itemQuery = itemQuery.ilike("name", `%${q}%`);

  const { data: items, error } = await itemQuery;
  const isAdmin = profile?.role === "admin";
  const profit = user
    ? await loadPersonalProfit(supabase, user.id)
    : null;
  const showArtistFilter = isAdmin;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-16">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Stock tracker</h1>
          {profile ? (
            <p className="text-sm text-neutral-500">
              {profile.display_name} · {profile.role}
            </p>
          ) : null}
          {profit ? (
            <div className="mt-3 text-sm">
              <p className="text-lg">Your total profit ${money(profit.total)}</p>
              <p className="text-neutral-500">
                From alleys ${money(profit.fromAlleys)} · unsold restocks −$
                {money(profit.unsoldRestockCost)}
              </p>
            </div>
          ) : null}
        </div>
        <form action={signOut}>
          <button type="submit" className="text-sm underline">
            Sign out
          </button>
        </form>
      </div>
      {profileError ? (
        <p className="text-red-600">{profileError.message}</p>
      ) : null}
      {profit?.restockError ? (
        <p className="text-red-600">
          Restocks are not set up yet. Run supabase/restocks.sql in the Supabase
          SQL editor. {profit.restockError}
        </p>
      ) : null}
      {error ? <p className="text-red-600">{error.message}</p> : null}
      <div className="flex gap-4">
        <Link href="/items/new" className="text-sm underline">
          Add item
        </Link>
        <Link href="/alleys" className="text-sm underline">
          Alleys
        </Link>
      </div>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            name="q"
            defaultValue={q}
            className="rounded border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Type
          <select
            name="category"
            defaultValue={category}
            className="rounded border border-neutral-300 px-3 py-2"
          >
            <option value="">All</option>
            <option value="print">Print</option>
            <option value="sticker">Sticker</option>
            <option value="handmade">Handmade</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Size
          <select
            name="size"
            defaultValue={size}
            className="rounded border border-neutral-300 px-3 py-2"
          >
            <option value="">All</option>
            <option value="A3">A3</option>
            <option value="A4">A4</option>
            <option value="A5">A5</option>
          </select>
        </label>
        {showArtistFilter ? (
          <label className="flex flex-col gap-1 text-sm">
            Artist
            <select
              name="artist"
              defaultValue={artist}
              className="rounded border border-neutral-300 px-3 py-2"
            >
              <option value="">All</option>
              {(artists ?? []).map((row) => (
                <option key={row.id} value={row.id}>
                  {row.display_name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button
          type="submit"
          className="rounded bg-neutral-900 px-4 py-2 text-sm text-white"
        >
          Filter
        </button>
        {filtering ? (
          <Link href="/" className="py-2 text-sm underline">
            Clear
          </Link>
        ) : null}
      </form>
      {items && items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-300 text-left">
                <th className="py-2 pr-3 font-medium">Photo</th>
                <th className="py-2 pr-3 font-medium">Name</th>
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 font-medium">Size</th>
                <th className="py-2 pr-3 font-medium">Artist</th>
                <th className="py-2 pr-3 font-medium">Left</th>
                <th className="py-2 pr-3 font-medium">Production</th>
                <th className="py-2 font-medium">Retail</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-neutral-200">
                  <td className="py-2 pr-3">
                    {item.image_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image_path}
                        alt=""
                        className="h-12 w-12 rounded object-cover"
                      />
                    ) : null}
                  </td>
                  <td className="py-2 pr-3">
                    <Link href={`/items/${item.id}`} className="underline">
                      {item.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-3">{item.category}</td>
                  <td className="py-2 pr-3">{item.size ?? "—"}</td>
                  <td className="py-2 pr-3">
                    {artistName(
                      item.profiles as ArtistName | ArtistName[] | null,
                    )}
                  </td>
                  <td className="py-2 pr-3">{item.quantity}</td>
                  <td className="py-2 pr-3">${item.production_price}</td>
                  <td className="py-2">${item.retail_price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-neutral-600">
          {filtering ? "No items match these filters." : "No items yet."}
        </p>
      )}
    </main>
  );
}
