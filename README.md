# Couple Passport 💌

A wedding-gift web app: a shared "passport" where a newlywed couple collects a stamp for every country they visit together, keeps up to 5 photos per country, and unlocks secret messages left by the friend who gave the gift.

- 📄 Specification & plan: [docs/spec-and-plan.md](docs/spec-and-plan.md)
- 🎨 Design: [Figma prototype](https://www.figma.com/design/EJLXc1AeE81tdSj5iUxkxi)

**Stack:** Vite + React + TypeScript · Supabase (Postgres, Auth, Storage, RLS) · static hosting (Cloudflare Pages / Vercel) · $0/month.

---

## Quick start (demo mode — no backend needed)

```bash
npm install
npm run dev        # http://localhost:5173
```

With no Supabase keys the app runs in **demo mode**: everything is stored in your browser (localStorage + IndexedDB), pre-filled with the sample MIN ♥ TON passport from Figma. The dark banner at the top lets you switch between the **couple** and **issuer** views, reset the sample, or start from an empty book.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm test` | Unit tests (mission rules, stats, MRZ, date formats) |
| `npm run test:sql` | Runs the real SQL migrations in an in-process Postgres (PGlite) and checks RLS, the 5-photo limit, `check_in()` and mission unlocking |
| `npm run gen:countries-sql` | Regenerates `supabase/migrations/002_countries.sql` from `src/lib/countries.ts` |
| `npm run gen:icons` | Regenerates the PWA PNG icons |

---

## Going live (≈ 30 minutes)

### 1. Supabase project (free tier)
1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor** → run, in order:
   1. `supabase/migrations/001_schema.sql` — tables, RLS, triggers, `check_in()` / `check_missions()`, private `photos` bucket
   2. `supabase/migrations/002_countries.sql` — country → continent reference data
3. **Authentication → Sign In / Providers**: keep **Email** on, turn **off** "Allow new users to sign up".
4. **Authentication → URL Configuration**: set **Site URL** (and a Redirect URL) to your deployed address, e.g. `https://couple-passport.pages.dev`.
5. **Authentication → Users → Invite user**: invite both couple emails and your own (issuer) email.
6. Open `supabase/seed.sql`, edit the lines marked `<-- EDIT` (names, wedding date/place, emails, sticky note) and run it. It creates the book, the memberships, the wedding stamp and the 4 default missions.

### 2. Front-end
```bash
cp .env.example .env
# VITE_SUPABASE_URL=https://xxxx.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJ...   (Project Settings → API → anon public key)
npm run build
```

Deploy `dist/` to either:
- **Cloudflare Pages** — build command `npm run build`, output `dist`, add the two `VITE_…` env vars. `public/_redirects` and `public/_headers` are picked up automatically.
- **Vercel** — framework "Vite", same env vars. `vercel.json` handles SPA routing and headers.

### 3. Write the secret messages
Sign in with your issuer email → tap **Issuer** (top bar) → edit the data page, sticky note and each mission's secret message. You can add your own missions (conditions: first trip, N country stamps, anniversary check-in, N continents, N different cities).

### 4. Keep-alive & backups (GitHub Actions)
Add repository secrets (**Settings → Secrets and variables → Actions**):

| Secret | Used by |
|---|---|
| `SUPABASE_URL` | both workflows |
| `SUPABASE_ANON_KEY` | `keepalive.yml` — pings `rpc/ping` every 3 days so the free project never pauses |
| `SUPABASE_SERVICE_ROLE_KEY` | `backup.yml` — monthly JSON export as a 90-day artifact |

> ⚠️ The backup job only runs when the repository is **private** — artifacts of public repos can be downloaded by anyone and would spoil the secret messages.

**If the project ever pauses anyway:** Supabase dashboard → your project → **Restore project**. Data is kept; it takes a few minutes.

### 5. Gift packaging
Print a QR code of the site URL in the wedding card. The couple scans it, enters their email, taps the magic link, and their first (wedding) stamp is already there.

---

## How it works

| Spec item | Where |
|---|---|
| F1 Cover (+ first-open animation) | `src/screens/Cover.tsx` |
| F2 Data page, MRZ, wedding postmark, sticky note | `src/screens/DataPage.tsx`, `src/lib/mrz.ts` |
| F3 Stamp book, stats, locked slots | `src/screens/StampBook.tsx` |
| F4 Check-in: GPS → BigDataCloud reverse geocode → confirm → stamp animation + sound; manual picker fallback | `src/screens/CheckIn.tsx`, `src/lib/geo.ts`, `src/lib/sound.ts` |
| F5 Country detail, ≤ 5 polaroids, captions, memo, client-side resize (≤ 1600 px, WebP/JPEG, ≤ 400 KB) | `src/screens/CountryDetail.tsx`, `src/lib/image.ts` |
| F6 Secret missions + envelope reveal | `src/screens/Missions.tsx`, `check_missions()` in SQL |
| F7 World map *(v1.1)* | `src/screens/MapPage.tsx` — v1 shows collected countries by continent |
| F8 TH / EN switch (saved in `localStorage`, country names via `Intl.DisplayNames`) | `src/i18n/` |
| Issuer desk | `src/screens/Issuer.tsx` |
| PWA (manifest, icons, offline shell) | `public/` |

### Security model (spec §5.3)
- Every table has RLS; only members of a book can read it. Strangers get the "this passport isn't yours" page.
- Stamps and visits can only be **created through `check_in()`** (security definer). The client cannot set `unlocked_at`; `check_missions()` evaluates conditions server-side after every check-in.
- `mission_secrets` rows are invisible to the couple until unlocked, so locked messages never appear in any API response.
- Photos (table + private Storage bucket, `book_id/stamp_id/photo_id.webp`, signed URLs) are **couple-only** — the issuer can't see them (spec Q4 default). A DB trigger rejects the 6th photo per country.
- The couple can edit only memos, captions, photos and their portrait photos; everything else on the data page is issuer-only (trigger-enforced).
- Coordinates are rounded to ~10 m and never shown in the UI; check-in dates can't be backdated by more than a day.

### Decisions taken on the spec's open questions
| # | Question | Default used (easy to change) |
|---|---|---|
| Q1 | Names & date | Sample MIN ♥ TON, 21 Nov 2026, Bangkok — set real values in `seed.sql` or the Issuer page |
| Q3 | Stamp per country or per trip | One stamp per country; revisits add visits/cities |
| Q4 | Issuer sees photos? | No |
| Q5 | Login | Email magic link, invite-only |
| Q7 | Missions | The 4 proposed ones, plus the issuer can add custom ones in-app |
| Q9 | "Together" check-in | Left for v1.1 |
| — | "Around the World" target | 6 continents (Antarctica optional) |
| — | Data page | Added `issued_by`, `wedding_country` and two portrait photo columns to `books` (needed by the Figma data page) |
