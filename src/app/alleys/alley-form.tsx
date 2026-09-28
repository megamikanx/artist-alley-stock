export function AlleyForm({
  action,
  submitLabel,
  alley,
  artists,
  selectedIds,
}: {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  alley?: {
    id: number;
    name: string;
    starts_on: string | null;
    ends_on: string | null;
    tabling_fee: string | number;
    notes: string | null;
  };
  artists: { id: string; display_name: string; role: string }[];
  selectedIds: string[];
}) {
  const selected = new Set(selectedIds);

  return (
    <form action={action} className="flex max-w-md flex-col gap-4">
      {alley ? <input type="hidden" name="id" value={alley.id} /> : null}
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          name="name"
          required
          defaultValue={alley?.name ?? ""}
          className="rounded border border-neutral-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Starts
        <input
          name="starts_on"
          type="date"
          defaultValue={alley?.starts_on ?? ""}
          className="rounded border border-neutral-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Ends
        <input
          name="ends_on"
          type="date"
          defaultValue={alley?.ends_on ?? ""}
          className="rounded border border-neutral-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Tabling fee
        <input
          name="tabling_fee"
          type="number"
          min={0}
          step="0.01"
          required
          defaultValue={alley?.tabling_fee ?? "0"}
          className="rounded border border-neutral-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Notes
        <textarea
          name="notes"
          defaultValue={alley?.notes ?? ""}
          className="rounded border border-neutral-300 px-3 py-2"
        />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm">Artists tabling</legend>
        {artists.map((artist) => (
          <label key={artist.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="artist_id"
              value={artist.id}
              defaultChecked={selected.has(artist.id)}
            />
            {artist.display_name} ({artist.role})
          </label>
        ))}
      </fieldset>
      <button
        type="submit"
        className="rounded bg-neutral-900 px-4 py-2 text-white"
      >
        {submitLabel}
      </button>
    </form>
  );
}