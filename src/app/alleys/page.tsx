import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AlleysPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .maybeSingle();
  const { data: alleys, error } = await supabase
    .from("alleys")
    .select("id, name, starts_on, ends_on, tabling_fee")
    .order("starts_on", { ascending: false });

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-16">
      <Link href="/" className="text-sm underline">
        Back to stock
      </Link>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-4xl font-semibold tracking-tight">Alleys</h1>
        {profile?.role === "admin" ? (
          <Link href="/alleys/new" className="text-sm underline">
            New alley
          </Link>
        ) : null}
      </div>
      {error ? <p className="text-red-600">{error.message}</p> : null}
      {alleys && alleys.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {alleys.map((alley) => (
            <li key={alley.id}>
              <Link href={`/alleys/${alley.id}`} className="underline">
                {alley.name}
              </Link>
              <p className="text-sm text-neutral-600">
                {alley.starts_on ?? "No start"} – {alley.ends_on ?? "No end"} ·
                fee ${alley.tabling_fee}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-neutral-600">No alleys yet.</p>
      )}
    </main>
  );
}