"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { money } from "@/lib/money";
import { recordSale, voidSale } from "./actions";

type Category = "print" | "sticker" | "handmade";
type Size = "A3" | "A4" | "A5";

type StockItem = {
  id: number;
  name: string;
  artist: string;
  category: Category;
  size: Size | null;
  quantity: number;
  retailPrice: string;
  imageUrl: string | null;
};

type Sale = {
  id: number;
  name: string;
  artist: string;
  quantity: number;
  retail: string;
  profit: string;
};

const categories: { id: Category; label: string }[] = [
  { id: "print", label: "Prints" },
  { id: "sticker", label: "Stickers" },
  { id: "handmade", label: "Handmade" },
];

const sizes: Size[] = ["A3", "A4", "A5"];

export function Register({
  dayId,
  isOpen,
  items,
  sales,
  profit,
  profitLabel,
}: {
  dayId: number;
  isOpen: boolean;
  items: StockItem[];
  sales: Sale[];
  profit: string;
  profitLabel: string;
}) {
  const router = useRouter();
  const [category, setCategory] = useState<Category>("print");
  const [size, setSize] = useState<Size>("A3");
  const [artist, setArtist] = useState("all");
  const artists = [...new Set(items.map((item) => item.artist).filter(Boolean))].sort();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    function refresh() {
      router.refresh();
    }
    const timer = window.setInterval(refresh, 5000);
    function onVisible() {
      if (document.visibilityState === "visible") refresh();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", refresh);
    };
  }, [router]);

  const visible = items.filter((item) => {
    if (artist !== "all" && item.artist !== artist) return false;
    if (item.category !== category) return false;
    if (category === "print") return item.size === size;
    return true;
  });

  function run(action: () => Promise<{ error: string | null }>) {
    setPending(true);
    void action()
      .then((result) => {
        setMessage(result.error);
        router.refresh();
      })
      .catch((caught: unknown) => {
        setMessage(caught instanceof Error ? caught.message : "Sale failed.");
      })
      .finally(() => setPending(false));
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {categories.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategory(tab.id)}
              className={
                category === tab.id
                  ? "rounded bg-neutral-900 px-3 py-2 text-sm text-white"
                  : "rounded border border-neutral-300 px-3 py-2 text-sm"
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
        {artists.length > 1 ? (
          <label className="flex flex-col gap-1 text-sm">
            Artist
            <select
              value={artist}
              onChange={(event) => setArtist(event.target.value)}
              className="w-fit rounded border border-neutral-300 px-3 py-2"
            >
              <option value="all">All artists</option>
              {artists.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {category === "print" ? (
          <div className="flex gap-2">
            {sizes.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSize(option)}
                className={
                  size === option
                    ? "rounded bg-neutral-900 px-3 py-1 text-sm text-white"
                    : "rounded border border-neutral-300 px-3 py-1 text-sm"
                }
              >
                {option}
              </button>
            ))}
          </div>
        ) : null}
        {message ? <p className="text-sm text-red-600">{message}</p> : null}
        {visible.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {visible.map((item) => (
              <form
                key={item.id}
                action={(formData) => run(() => recordSale(formData))}
                className="flex flex-col gap-2 rounded border border-neutral-200 p-3"
              >
                <input type="hidden" name="day_id" value={dayId} />
                <input type="hidden" name="item_id" value={item.id} />
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="h-28 w-full rounded object-cover"
                  />
                ) : (
                  <div className="flex h-28 items-center justify-center rounded bg-neutral-100 text-xs text-neutral-400">
                    No photo
                  </div>
                )}
                <p className="font-medium">{item.name}</p>
                {item.artist ? (
                  <p className="text-xs text-neutral-500">{item.artist}</p>
                ) : null}
                <p className="text-sm text-neutral-600">
                  ${money(item.retailPrice)} · {item.quantity} left
                </p>
                {isOpen && item.quantity > 0 ? (
                  <>
                    <input
                      name="quantity"
                      type="number"
                      min={1}
                      max={item.quantity}
                      defaultValue={1}
                      className="rounded border border-neutral-300 px-2 py-1"
                    />
                    <button
                      type="submit"
                      disabled={pending}
                      className="rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50"
                    >
                      Sell
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-neutral-500">
                    {isOpen ? "Sold out" : "Closed"}
                  </p>
                )}
              </form>
            ))}
          </div>
        ) : (
          <p className="text-neutral-600">Nothing in this group yet.</p>
        )}
      </section>
      <aside className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">This day</h2>
        <p>
          {profitLabel} ${money(profit)}
        </p>
        {sales.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {sales.map((sale) => (
              <li key={sale.id} className="text-sm">
                <p>
                  {sale.quantity} × {sale.name}
                  {sale.artist ? ` · ${sale.artist}` : ""} · ${money(sale.retail)}
                </p>
                {isOpen ? (
                  <form action={(formData) => run(() => voidSale(formData))}>
                    <input type="hidden" name="day_id" value={dayId} />
                    <input type="hidden" name="sale_id" value={sale.id} />
                    <button
                      type="submit"
                      disabled={pending}
                      className="underline disabled:opacity-50"
                    >
                      Undo
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-600">No sales yet.</p>
        )}
      </aside>
    </div>
  );
}
