-- Couple Passport — create the logins and the real book (run ONCE in Supabase → SQL Editor, after the migrations).
--
-- Logins are USERNAME ONLY. Supabase needs an email + password per user, so each username is stored as
-- <username>@couplepassport.local with a password derived from the username (see src/lib/username.ts).
-- Nobody ever sees either, and no email is ever sent.
--
-- ⚠ The username IS the key: anyone who knows it can open the passport. Pick usernames that are hard to
--   guess (e.g. min-k7q2, not min) — especially yours, which can read every secret message.
--
-- Before running:
--   1. Authentication → Sign In / Providers: keep Email enabled, turn OFF "Allow new users to sign up".
--   2. Edit every value marked  <-- EDIT  below, then run this whole script.
--      The repo is public: keep your filled-in copy as supabase/seed.local.sql (git-ignored), not in this file.
--
-- Usernames: 3–30 characters, a–z 0–9 . _ -   (case doesn't matter).

create or replace function pg_temp.make_login(p_username text) returns uuid
language plpgsql as $f$
declare
  v_user  text := lower(trim(p_username));
  v_email text := v_user || '@couplepassport.local';
  v_pass  text := 'cp-login:' || v_user;   -- must match usernameToPassword() in the app
  v_id    uuid;
begin
  if v_user like '%change-me%' then
    raise exception 'Replace the sample username "%" with a real one (lines marked <-- EDIT)', v_user;
  end if;
  if v_user like '%change-me%' then
    raise exception 'Replace the sample username "%" with a real one (lines marked <-- EDIT)', v_user;
  end if;
  if v_user !~ '^[a-z0-9._-]{3,30}$' then
    raise exception 'Username "%" is not allowed — use 3–30 characters: a–z 0–9 . _ -', p_username;
  end if;

  select id into v_id from auth.users where lower(email) = v_email;
  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
      extensions.crypt(v_pass, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('username', v_user), now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), v_id, v_id::text,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
      'email', now(), now(), now()
    );
  else
    update auth.users
       set encrypted_password = extensions.crypt(v_pass, extensions.gen_salt('bf')), updated_at = now()
     where id = v_id;
  end if;
  return v_id;
end $f$;

do $$
declare
  b uuid;
  a_id uuid;
  b_id uuid;
  i_id uuid;
begin
  -- Logins ---------------------------------------------------------------------------------
  a_id := pg_temp.make_login('partner-a-change-me');  -- <-- EDIT partner A username
  b_id := pg_temp.make_login('partner-b-change-me');  -- <-- EDIT partner B username
  i_id := pg_temp.make_login('issuer-change-me');     -- <-- EDIT your (issuer) username

  if exists (select 1 from public.book_members where user_id in (a_id, b_id, i_id)) then
    raise notice 'A book already exists for these users — nothing changed.';
    return;
  end if;

  -- The book -------------------------------------------------------------------------------
  insert into public.books (partner_a_name, partner_b_name, wedding_date, wedding_place, wedding_country, issued_by, issuer_note)
  values (
    'MIN',                         -- <-- EDIT partner A
    'TON',                         -- <-- EDIT partner B
    '2026-11-21',                  -- <-- EDIT wedding date (YYYY-MM-DD)
    'Bangkok',                     -- <-- EDIT wedding city
    'TH',                          -- <-- EDIT wedding country (ISO alpha-2)
    'Your name',                   -- <-- EDIT issued by
    'ขอให้เล่มนี้เต็มไปด้วยแสตมป์ และทุกหน้ามีแต่รอยยิ้มของสองคนนะ'  -- <-- EDIT sticky note
  )
  returning id into b;

  insert into public.book_members (book_id, user_id, role) values
    (b, a_id, 'couple'),
    (b, b_id, 'couple'),
    (b, i_id, 'issuer');

  perform public.create_wedding_stamp(b, (select wedding_place from public.books where id = b));
  perform public.create_default_missions(b);

  raise notice 'Book created: %  — now sign in as the issuer and write the secret messages on the Issuer page.', b;
end $$;
