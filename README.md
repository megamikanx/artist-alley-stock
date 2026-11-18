# Artist Alley Stock

A stock, sales, and profit tracker for artists who share a booth at convention artist alleys.

Each artist keeps their own inventory of prints, stickers, and handmade pieces. On the day, everyone records sales from their own phone or laptop. Afterwards, each artist sees what they actually made once production costs, their share of the tabling fee, and unsold restocks are taken out.

## Features

- **Per-artist stock:** prints (A3, A4, A5), stickers, and handmade items, each with quantity, production cost, retail price, and an optional image. Filter by name, type, and size. Admins can also filter by artist.
- **Alleys and days:** set up a convention with its tabling fee, the artists tabling, and one or more days. Only one day per alley can be open at a time.
- **Live sell screen:** record or void sales on the open day. Stock updates right away, and the screen stays in sync across every device at the booth.
- **Price snapshots:** each sale stores the price and cost at the moment it was made, so past profit stays accurate after prices change.
- **Restocks:** log new copies at their own unit cost.
- **Profit dashboard:** margin per alley, minus your share of the booth fee (`fee / number of artists`), minus the production cost of restocks that haven't sold yet. Admins also get a per-artist sales summary for each alley.
- **Roles:** artists see only their own items and sales, and admins manage alleys and memberships.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router, Server Actions), React 19, TypeScript
- [Tailwind CSS 4](https://tailwindcss.com)
- [Supabase](https://supabase.com): Postgres, Auth, Storage, Row Level Security

## How it works

- Pages are server components that read from Supabase. Forms call Server Actions.
- Sales and restocks go through Postgres functions (`record_sale`, `void_sale`, `restock_item`). Each one locks the rows it touches, checks the rules (the day is open, there is enough stock, the artist is on the alley), and updates stock and the sales log in a single transaction. Two artists selling the last copy at the same moment can't both succeed.
- Row Level Security policies enforce access in the database, so the UI never has to be trusted with it.
- The sell screen refreshes every 5 seconds, which keeps multiple devices in sync without a realtime subscription.
- Profit math lives in [src/lib/profit.ts](src/lib/profit.ts). The unsold restock cost counts the newest batches first, because sold units have already been charged against alley profit.

## Getting started

### 1. Install

```bash
git clone https://github.com/megamikanx/artist-alley-stock.git
cd artist-alley-stock
npm install
```

### 2. Set up Supabase

Create a Supabase project. Then, in its SQL editor, run:

1. [src/lib/supabase/schema.sql](src/lib/supabase/schema.sql), which creates the tables, functions, and policies
2. [supabase/item-images.sql](supabase/item-images.sql), which creates the storage bucket for item images

> **Already have a live database?** Don't run `schema.sql` against it. The files in [supabase/](supabase/) are one-off migrations for the existing project. Run only the ones you need. For example, run `restocks.sql` if the dashboard says restocks aren't set up.

### 3. Add environment variables

Create `.env.local` in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign up with email and password.

### 5. Make yourself an admin

Every new user starts as an artist. To promote someone, set their `role` to `admin` in the `profiles` table:

```sql
update profiles set role = 'admin' where id = '<user-uuid>';
```

## Usage

1. **Add items** to your stock from the Stock page. The same name can exist once per artist, type, and size.
2. **Create an alley** (admin): set the tabling fee and pick the artists who are tabling.
3. **Open a day** on the alley, then go to **Sell** to record sales as they happen.
4. **End the day** when the booth closes.
5. **Restock** items as you reprint. Each restock records its own unit cost.
6. Check **Profit** on the home page for your totals across every alley you've tabled at.

## Scripts

| Command         | What it does                 |
| --------------- | ---------------------------- |
| `npm run dev`   | Start the dev server         |
| `npm run build` | Build for production         |
| `npm run start` | Serve the production build   |
| `npm run lint`  | Run ESLint                   |
