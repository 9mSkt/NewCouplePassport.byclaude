# Couple Passport — Specification & Implementation Plan

> A wedding-gift web app: a shared "passport" where a newlywed couple collects a stamp for every country they visit together, keeps up to 5 photos per country, and unlocks secret messages left by the friend who gave the gift.

| | |
|---|---|
| **Status** | Draft for review |
| **Author** | (you) + Claude |
| **Last updated** | 7 Nov 2026 |
| **Design** | [Figma — Couple Passport – Wedding Gift Prototype](https://www.figma.com/design/EJLXc1AeE81tdSj5iUxkxi) |
| **Budget** | $0 / month (free tiers only) |

---

## 1. Goals & non-goals

### Goals
- A gift that keeps being used for years, not just on the wedding day.
- Feels like a real passport: classic, but cute and retro (90s).
- Works well on a phone, in Thai and English (switchable at any time).
- Costs nothing to run, and needs almost no maintenance from the gift giver.
- Private: only the couple (and the gift giver, as admin) can see the book.

### Non-goals (v1)
- Public sharing, social feeds, or comments.
- Native iOS/Android apps (a PWA "Add to Home Screen" is enough).
- Unlimited photo storage or video.
- Offline-first sync (basic offline viewing only, if time allows).

---

## 2. Users & roles

| Role | Who | Can do |
|---|---|---|
| **Couple member** | Bride and groom (2 accounts) | View the book, check in, add stamps, upload/delete photos, write memos, read unlocked messages |
| **Issuer (admin)** | The friend giving the gift | Set up the book, write the first-page note, create missions and secret messages. Cannot read the couple's photos unless the couple allows it (see open question Q4) |

Both couple members share **one** book.

---

## 3. Features

### F1. Passport cover
- Navy cover, gold emblem, title "COUPLE PASSPORT / หนังสือเดินทางคู่รัก", couple's names, "Just Married!" sticker.
- "Open" button goes to the data page.
- First visit plays a short "opening the passport" animation (optional, nice-to-have).

### F2. Data page & first stamp
- Passport-style data page: two couple photos, Name, Date of issue (wedding date), Place, Issued by.
- Decorative MRZ lines at the bottom (generated from names + date).
- The **wedding stamp** is pre-stamped on this page and is also the first stamp in the stamp book.
- A sticky note from the issuer (editable by the issuer only).

### F3. Stamp book
- Header with stats: countries, cities, photos.
- Grid of postage-style stamps (3 per row on mobile), sorted by first visit date.
- Empty, locked slots ("???") after the last stamp to hint at the next trip.
- "+ Check in somewhere new" button.

### F4. Check-in & stamps
- One stamp **per country**. Revisiting a country adds a city/visit to the same stamp instead of a new stamp.
- Check-in flow:
  1. Get location from the browser (Geolocation API).
  2. Reverse-geocode to country + city (see §6.4).
  3. Show a preview of the stamp, then "Stamp it!" with a stamping animation and sound.
- Fallback: if location is denied or unavailable, the couple can pick the country manually (stamp is marked "manual" internally; it still counts).
- Optional "together" check: both partners confirm within 10 minutes to earn a "together" postmark. **Proposed for v1.1**, not v1.

### F5. Country detail & photos
- Hero card: country, cities, visit dates, "Checked in" postmark.
- **Up to 5 photos per country** (hard limit enforced in the database).
- Photos shown as polaroids with a short caption.
- Short memo per country.
- Images are resized and compressed **in the browser before upload** (see §6.3).
- Delete a photo to free a slot.

### F6. Secret missions
- List of missions with an icon, title, description, and progress bar.
- When a mission's condition is met, its secret message unlocks with a reveal animation (envelope + wax seal).
- Initial missions (editable by the issuer):

| Key | Title (TH / EN) | Condition |
|---|---|---|
| `first_trip` | ทริปแรกหลังแต่งงาน / First trip as newlyweds | ≥ 1 stamp other than the wedding stamp |
| `collector_5` | นักสะสมแสตมป์ / Stamp Collector | ≥ 5 country stamps |
| `anniversary_1` | ครบรอบ 1 ปี / 1st Anniversary | A check-in dated on the 1st wedding anniversary |
| `all_continents` | รอบโลกด้วยกัน / Around the World | Stamps on all 7 continents (Antarctica optional → 6) |

- Locked messages **must not be readable** from the client before they unlock (enforced server-side, see §5.3).

### F7. World map *(v1.1, nice-to-have)*
- World map where visited countries are filled with each stamp's color.
- Tap a country to open its detail page.

### F8. Language switch (TH / EN)
- Toggle in the top bar on every screen; default follows the browser language, choice saved in `localStorage`.
- All UI strings live in `th.json` / `en.json`.
- User content (memos, captions, issuer notes) is shown as written; not translated.
- Country names come from `Intl.DisplayNames` so both languages are covered without a manual list.
- Font note: the pixel font (Silkscreen) and typewriter font (Courier Prime) have **no Thai glyphs** — use them only for Latin/numeric labels. Thai text uses Mitr / Itim.

---

## 4. Design system (from Figma)

| Token | Value | Use |
|---|---|---|
| `--navy` | `#1F3A5F` | Cover background |
| `--gold` | `#D9B05C` | Cover emblem & title |
| `--cream` | `#FBF3E4` | App background |
| `--paper` | `#FFFCF5` | Cards, stamps |
| `--ink` | `#3B2F2F` | Text, borders, hard shadows |
| `--red` | `#E2574C` | Primary button, postmarks |
| `--pink` | `#F4A7B9` | Accent |
| `--mint` | `#8FD3C1` | Accent |
| `--butter` | `#F6D365` | Accent, active nav tab |
| `--sky` | `#96C5EF` | Accent, window bars |

- **Fonts**: DM Serif Display (cover title), Silkscreen (pixel labels), Courier Prime (passport data), Mitr (Thai UI), Itim (handwritten notes). All on Google Fonts.
- **Signature styles**: 2 px ink borders, hard shadow `4px 4px 0 var(--ink)` with no blur, dashed borders for stamps and empty slots, 90s window title bars with three colored squares.
- **Components** to build (match Figma): `Stamp`, `StampLocked`, `PixelButton`, `NavBar` / `NavItem`, `MissionCard`, `Polaroid`, `WindowBar`, `LangToggle`, `Postmark`.

---

## 5. Data & backend

### 5.1 Stack choice: Supabase (free tier)
- Postgres database, Auth, and Storage in one place.
- Free tier at time of writing: 500 MB database, 1 GB file storage, 5 GB egress/month, 2 projects.
- **Known catch**: free projects pause after 1 week of inactivity → mitigated by a keep-alive job (§6.5).

### 5.2 Schema

```sql
books (
  id uuid pk,
  partner_a_name text, partner_b_name text,
  wedding_date date, wedding_place text,
  issuer_note text,
  created_at timestamptz
)

book_members (
  book_id uuid fk → books,
  user_id uuid fk → auth.users,
  role text check (role in ('couple','issuer')),
  primary key (book_id, user_id)
)

stamps (
  id uuid pk,
  book_id uuid fk,
  country_code char(2),          -- ISO 3166-1 alpha-2
  color text,                     -- one of the accent tokens
  is_wedding boolean default false,
  memo text,
  first_visit_at timestamptz,
  created_at timestamptz,
  unique (book_id, country_code)
)

visits (
  id uuid pk,
  stamp_id uuid fk → stamps,
  city text,
  lat double precision, lng double precision,
  method text check (method in ('gps','manual')),
  checked_in_by uuid fk → auth.users,
  checked_in_at timestamptz
)

photos (
  id uuid pk,
  stamp_id uuid fk → stamps,
  storage_path text,
  caption text,
  width int, height int, bytes int,
  uploaded_by uuid,
  created_at timestamptz
)
-- trigger: reject insert when count(photos where stamp_id = NEW.stamp_id) >= 5

missions (
  id uuid pk,
  book_id uuid fk,
  key text,
  title_th text, title_en text,
  desc_th text, desc_en text,
  icon text, color text,
  sort int
)

mission_secrets (               -- never selectable by couple until unlocked
  mission_id uuid pk fk → missions,
  message text,
  unlocked_at timestamptz null
)
```

### 5.3 Security (Row Level Security)
- Every table: a user can read/write rows only for books they are a member of.
- `photos` and the Storage bucket `photos/` (private): couple members only; paths are `book_id/stamp_id/photo_id.webp`, served via signed URLs.
- `mission_secrets`:
  - Couple can `select` only rows where `unlocked_at is not null`.
  - Unlocking happens in a `security definer` Postgres function `check_missions(book_id)`, called after each check-in. It evaluates conditions server-side and sets `unlocked_at`. The client can never set it.
  - Issuer can insert/update messages.
- Auth: email magic link (no passwords to remember). Sign-ups disabled; the issuer invites the two couple emails.

### 5.4 Storage budget
- Target ~300 KB per photo → 5 photos ≈ 1.5 MB per country → 1 GB ≈ 600+ countries. Effectively unlimited for this use.
- Show the photo counter (`3 / 5`) and disable "Add photo" at 5.

---

## 6. Technical details

### 6.1 Frontend stack (proposal)
- **Vite + React + TypeScript**, CSS Modules or Tailwind with the tokens above.
- `@supabase/supabase-js` for data/auth/storage.
- Simple i18n: a tiny hook over `th.json` / `en.json` (no heavy library needed).
- PWA manifest + icon so the couple can add it to their home screens.

### 6.2 Hosting
- Static build deployed to **Cloudflare Pages** or **Vercel** (free).
- Custom domain optional (e.g. `min-and-ton.love`, ~$10–20/year — the only possible cost, and optional).

### 6.3 Image pipeline (client side)
1. User picks a photo (`<input type="file" accept="image/*">`).
2. Decode with `createImageBitmap` (handles EXIF orientation in modern browsers).
3. Resize so the long edge is ≤ 1600 px, draw to a canvas.
4. Encode as WebP at quality ~0.8 (fallback JPEG); retry at lower quality if > 400 KB.
5. Upload to Storage, then insert the `photos` row (DB trigger enforces the 5-photo limit).
6. HEIC from iPhones: Safari converts on pick; other browsers may need a fallback message.

### 6.4 Reverse geocoding (free)
- Option A: **BigDataCloud** free client-side reverse geocode (no key).
- Option B: OpenStreetMap **Nominatim** (no key; must respect 1 req/sec and send a proper User-Agent/referrer).
- Only country + city are stored; raw coordinates kept for the map but never shared.

### 6.5 Keep-alive for the free Supabase project
- GitHub Actions scheduled workflow every 3 days: a lightweight `select 1`-style request via the REST API using the anon key.
- Document how to "restore" a paused project from the Supabase dashboard as a backup plan.

### 6.6 Backups
- Monthly GitHub Action exports the database (JSON) to a private repo or artifact.
- Photos: an "Export my passport" button (zip of photos + JSON) for the couple — v1.1.

---

## 7. Implementation plan

Phases are ordered so there is always something showable. Estimates assume evenings/weekends with Claude Code doing most of the typing.

| Phase | Scope | Deliverable / acceptance criteria | Est. |
|---|---|---|---|
| **0. Setup** | Repo, Vite+React+TS, design tokens, fonts, Supabase project, hosting, i18n skeleton | Blank app deployed on a public URL; TH/EN toggle switches a test string | 0.5 day |
| **1. Static passport** | Cover, data page, stamp book, country detail, missions — with mock data, matching Figma | All 5 screens look like Figma on a 390 px phone and on desktop; TH/EN works on every screen | 1.5 days |
| **2. Auth & book** | Magic-link login, invite-only, `books` + `book_members`, RLS | Only the 2 couple accounts + issuer can open the book; others get a friendly "this passport isn't yours" page | 1 day |
| **3. Stamps & check-in** | Geolocation, reverse geocoding, manual fallback, stamp creation, stamping animation | Checking in creates or updates the right country stamp; stats update; works when GPS is denied | 1.5 days |
| **4. Photos** | Client-side resize, upload, 5-per-country limit, delete, captions, memo | 6th upload is blocked (UI + DB); average stored photo ≤ 400 KB | 1 day |
| **5. Missions & secrets** | `check_missions()` function, unlock animation, issuer editing screen | Secret text is not visible in network responses before unlock; unlocks right after the qualifying check-in | 1 day |
| **6. Polish & launch** | PWA, keep-alive Action, backups, empty/error states, accessibility pass, real names/date, seed wedding stamp | Lighthouse mobile ≥ 90; tested on iPhone Safari and Android Chrome; keep-alive runs green | 1 day |
| **7. Gift packaging** | Printed card or illustrated frame with a QR code to the app; short "how to use" note | The couple can scan, log in, and see their first stamp in under 2 minutes | 0.5 day |
| *v1.1* | World map, "together" check-in, export zip, offline viewing | — | later |

**Total v1: ~8 working days.**

### Suggested milestones
- **M1 — Looks real** (end of Phase 1): demo the static screens to a trusted friend for feedback.
- **M2 — Works end to end** (end of Phase 5): a full test run — check in, upload, unlock a mission.
- **M3 — Ready to gift** (end of Phase 7): at least **1 week before the wedding**, to leave buffer.

---

## 8. Testing checklist
- [ ] iPhone Safari + Android Chrome, portrait, small (360 px) and large phones
- [ ] TH and EN on every screen; no Thai text rendered in Silkscreen/Courier
- [ ] Location denied → manual country picker works
- [ ] Same country twice → one stamp, two visits
- [ ] 5-photo limit enforced in the UI and by the database
- [ ] Logged-out user / stranger cannot read anything (try direct API calls)
- [ ] Locked secret messages absent from all API responses
- [ ] Project un-pauses or never pauses (keep-alive verified after 7+ days)
- [ ] Large HEIC/PNG photo → stored file is small WebP/JPEG

---

## 9. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Supabase free project pauses | App "down" when they open it after a quiet month | Keep-alive Action + documented restore steps |
| Free-tier terms change | Possible cost or migration | Monthly backups; schema is plain Postgres, portable |
| GPS inaccurate near borders / airports | Wrong country stamped | Confirmation screen + manual edit of country |
| Secret messages leaked early | Spoils the surprise | Server-side unlock only; RLS tested with raw API calls |
| Gift giver's account is the only admin | Can't fix things later if they lose access | Add the couple as co-owners of the Supabase project at handoff (optional) |
| Scope creep before the wedding date | Late gift | Ship v1 only; map and extras in v1.1 as a "first anniversary update" |

---

## 10. Open questions for review

1. **Names & date** — Real couple names, wedding date, and venue for the data page and wedding stamp?
2. **Wedding date deadline** — When must M3 be done?
3. **Stamp per country or per trip?** Spec assumes one stamp per country (revisits add cities). Alternative: one stamp per trip, with 5 photos per trip.
4. **Issuer visibility** — Should you (the giver) be able to see their photos, or only manage missions/messages?
5. **Login method** — Email magic link OK, or prefer Google sign-in?
6. **Domain** — Free `*.pages.dev` / `*.vercel.app` URL, or buy a custom domain?
7. **Missions** — Keep the 4 proposed missions, or add personal ones (inside jokes, places they've talked about visiting)?
8. **Hand-drawn assets** — Will you draw the stamp art yourself? If so, which countries first, and what format (SVG/PNG)?
9. **"Together" check-in** — Worth including in v1, or leave for the anniversary update?
