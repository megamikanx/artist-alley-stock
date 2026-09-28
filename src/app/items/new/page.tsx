import Link from "next/link";
import { createItem } from "../actions";
import { ItemForm } from "../item-form";

export default async function NewItemPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-16">
      <Link href="/" className="text-sm underline">
        Back to stock
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">Add item</h1>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <ItemForm action={createItem} submitLabel="Save item" />
    </main>
  );
}