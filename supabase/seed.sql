-- Couple Passport — create the real book (run ONCE in Supabase → SQL Editor, after the migrations).
--
-- Before running:
--   1. Authentication → Sign In / Providers: keep Email enabled, turn OFF "Allow new users to sign up".
--   2. Authentication → Users → "Invite user": invite the two couple emails and your own (issuer) email.
--   3. Authentication → URL Configuration: set Site URL to your deployed URL (e.g. https://couple-passport.pages.dev).
--   4. Edit every value marked  <-- EDIT  below, then run this whole script.

do $$
declare
  b uuid;
  missing text;
begin
  insert into public.books (partner_a_name, partner_b_name, wedding_date, wedding_place, wedding_country, issued_by, issuer_note)
  values (
    'MIN',                         -- <-- EDIT partner A
    'TON',                         -- <-- EDIT partner B
    '2026-11-21',                  -- <-- EDIT wedding date (YYYY-MM-DD)
    'Bangkok',                     -- <-- EDIT wedding city
    'TH',                          -- <-- EDIT wedding country (ISO alpha-2)
    'เพื่อนรักของแก',                 -- <-- EDIT issued by
    'ขอให้เล่มนี้เต็มไปด้วยแสตมป์ และทุกหน้ามีแต่รอยยิ้มของสองคนนะ'  -- <-- EDIT sticky note
  )
  returning id into b;

  insert into public.book_members (book_id, user_id, role)
    select b, id, 'couple' from auth.users
    where lower(email) in ('bride@example.com', 'groom@example.com');   -- <-- EDIT couple emails

  insert into public.book_members (book_id, user_id, role)
    select b, id, 'issuer' from auth.users
    where lower(email) = 'you@example.com';                             -- <-- EDIT your email

  select string_agg(e, ', ') into missing
  from unnest(array['bride@example.com','groom@example.com','you@example.com']) e   -- <-- EDIT (same 3 emails)
  where not exists (select 1 from auth.users u where lower(u.email) = e);
  if missing is not null then
    raise exception 'Invite these users first (Authentication → Users → Invite): %', missing;
  end if;

  perform public.create_wedding_stamp(b, 'Bangkok');   -- <-- EDIT wedding city (same as above)
  perform public.create_default_missions(b);

  raise notice 'Book created: %  — now sign in as the issuer and write the secret messages on the Issuer page.', b;
end $$;
