import type { ItemCategory, ItemSize } from "./types";

export function ItemForm({
  action,
  item,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  item?: {
    id?: number;
    name: string;
    category: ItemCategory;
    size: ItemSize | null;
    quantity: number;
    production_price: string | number;
    retail_price: string | number;
    image_path?: string | null;
  };
}) {
  return (
    <form action={action} className="flex max-w-md flex-col gap-4">
      {item?.id ? <input type="hidden" name="id" value={item.id} /> : null}
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          name="name"
          required
          defaultValue={item?.name ?? ""}
          className="rounded border border-neutral-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Category
        <select
          name="category"
          defaultValue={item?.category ?? "print"}
          className="rounded border border-neutral-300 px-3 py-2"
        >
          <option value="print">Print</option>
          <option value="sticker">Sticker</option>
          <option value="handmade">Handmade</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Size
        <select
          name="size"
          defaultValue={item?.size ?? ""}
          className="rounded border border-neutral-300 px-3 py-2"
        >
          <option value="">None</option>
          <option value="A3">A3</option>
          <option value="A4">A4</option>
          <option value="A5">A5</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Quantity
        <input
          name="quantity"
          type="number"
          min={0}
          step={1}
          required
          defaultValue={item?.quantity ?? 0}
          className="rounded border border-neutral-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Production price
        <input
          name="production_price"
          type="number"
          min={0}
          step="0.01"
          required
          defaultValue={item?.production_price ?? ""}
          className="rounded border border-neutral-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Photo
        {item?.image_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image_path}
            alt=""
            className="h-32 w-32 rounded object-cover"
          />
        ) : null}
        <input name="image" type="file" accept="image/*" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Retail price
        <input
          name="retail_price"
          type="number"
          min={0}
          step="0.01"
          required
          defaultValue={item?.retail_price ?? ""}
          className="rounded border border-neutral-300 px-3 py-2"
        />
      </label>
      <button
        type="submit"
        className="rounded bg-neutral-900 px-4 py-2 text-white"
      >
        {submitLabel}
      </button>
    </form>
  );
}