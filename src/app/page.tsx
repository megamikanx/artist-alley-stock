import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/money";
import { signOut } from "./login/actions";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("id", user?.id ?? "")
    .maybeSingle();
  const { data: items, error } = await supabase
    .from("items")
    .select("id, name, category, size, quantity, production_price, retail_price")
    .order("name");
  const { data: total, error: totalError } = await supabase
    .from("all_time_profit")
    .select("profit")
    .maybeSingle();

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
          <p className="mt-2 text-lg">
            All-time profit ${money(total?.profit ?? 0)}
          </p>
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
      {totalError ? <p className="text-red-600">{totalError.message}</p> : null}
      {error ? <p className="text-red-600">{error.message}</p> : null}
      <div className="flex gap-4">
        <Link href="/items/new" className="text-sm underline">
          Add item
        </Link>
        <Link href="/alleys" className="text-sm underline">
          Alleys
        </Link>
      </div>
      {items && items.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={`/items/${item.id}`} className="underline">
                {item.name}
              </Link>{" "}
              ({item.category}
              {item.size ? ` ${item.size}` : ""}) — {item.quantity} left · made $
              {item.production_price} · sells ${item.retail_price}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-neutral-600">No items yet.</p>
      )}
    </main>
  );
}