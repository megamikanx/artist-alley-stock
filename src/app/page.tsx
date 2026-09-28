import { createClient } from "@/lib/supabase/server";
import { signOut } from "./login/actions";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: items, error } = await supabase
    .from("items")
    .select("id, name, category, size, quantity")
    .order("name");

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-16">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-4xl font-semibold tracking-tight">Stock tracker</h1>
        <form action={signOut}>
          <button type="submit" className="text-sm underline">
            Sign out
          </button>
        </form>
      </div>
      {error ? <p className="text-red-600">{error.message}</p> : null}
      {items && items.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id}>
              {item.name}
              {item.size ? ` (${item.size})` : ""} — {item.quantity} left
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-neutral-600">No items yet.</p>
      )}
    </main>
  );
}