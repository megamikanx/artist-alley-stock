# Artist Alley Stock

Track stock, sales, and profit for shared artist-alley booths. Artists sign in, keep their own prints, stickers, and handmade pieces, and record sales on an open convention day. Profit subtracts production cost and each artist’s share of the booth fee, then subtracts the cost of restocks that have not sold yet.

## Setup

```bash
npm install
cp .env.example .env.local   # or create .env.local yourself
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign-in uses email and password through Supabase Auth.

`.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

The live database already has the tables this app expects. `src/lib/supabase/schema.sql` is a from-scratch copy for a new project. Do not run it against the existing database. Incremental SQL lives in `supabase/`. If the dashboard says restocks are not set up, run `supabase/restocks.sql` in the Supabase SQL editor.

New auth users get a `profiles` row as an artist. Promote someone to admin by setting `profiles.role` to `admin`.

## Using it

- **Stock** lists items you can see, with filters for name, type, and size. Admins can also filter by artist.
- **Add item** creates a stock row: print (A3, A4, or A5), sticker, or handmade, with quantity, production cost, and retail price. The same name can exist once per artist, type, and size.
- **Alleys** are conventions. Each alley has a tabling fee, the artists who tabled, and one or more days. Only one day per alley can be open.
- **Sell** records a sale on the open day. Quantity on hand goes down, and the sale stores the prices and artist at that moment.
- **Profit** on the home page is your margin from alleys you joined, minus your share of each booth fee (`fee / number of artists`), minus the production cost of unsold restocks.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```
