-- Couple Passport — schema, RLS, functions (spec §5).
-- Run in Supabase → SQL Editor (or `supabase db push`). Then run 002_countries.sql, then seed.sql.

-- ============================================================
-- Tables
-- ============================================================

create table if not exists public.countries (
  code char(2) primary key,
  continent text not null check (continent in ('AF','AN','AS','EU','NA','OC','SA'))
);

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  partner_a_name text not null default '',
  partner_b_name text not null default '',
  wedding_date date not null,
  wedding_place text not null default '',
  wedding_country char(2) not null default 'TH',
  issued_by text not null default '',
  issuer_note text not null default '',
  partner_a_photo text,          -- storage path in bucket "photos"
  partner_b_photo text,
  created_at timestamptz not null default now()
);

create table if not exists public.book_members (
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('couple','issuer')),
  primary key (book_id, user_id)
);
create index if not exists book_members_user_idx on public.book_members(user_id);

create table if not exists public.stamps (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  country_code char(2) not null references public.countries(code),
  color text not null default 'pink' check (color in ('red','pink','mint','butter','sky')),
  is_wedding boolean not null default false,
  memo text not null default '' check (char_length(memo) <= 500),
  first_visit_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (book_id, country_code)
);

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  stamp_id uuid not null references public.stamps(id) on delete cascade,
  city text check (char_length(city) <= 60),
  lat double precision,
  lng double precision,
  method text not null check (method in ('gps','manual')),
  checked_in_by uuid references auth.users(id) on delete set null,
  checked_in_at timestamptz not null default now(),
  local_date date not null default current_date
);
create index if not exists visits_stamp_idx on public.visits(stamp_id);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  stamp_id uuid not null references public.stamps(id) on delete cascade,
  storage_path text not null unique,
  caption text not null default '' check (char_length(caption) <= 80),
  width int not null,
  height int not null,
  bytes int not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists photos_stamp_idx on public.photos(stamp_id);

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  key text not null,
  rule text not null check (rule in ('first_trip','stamps_count','anniversary','continents','cities_count')),
  target int not null default 1 check (target between 1 and 250),
  title_th text not null default '',
  title_en text not null default '',
  desc_th text not null default '',
  desc_en text not null default '',
  icon text not null default 'star',
  color text not null default 'pink' check (color in ('red','pink','mint','butter','sky')),
  sort int not null default 0,
  unique (book_id, key)
);

-- Never selectable by the couple until unlocked (RLS below).
create table if not exists public.mission_secrets (
  mission_id uuid primary key references public.missions(id) on delete cascade,
  message text not null default '',
  unlocked_at timestamptz
);

-- ============================================================
-- Membership helpers (security definer so RLS policies can use them without recursion)
-- ============================================================

create or replace function public.member_role(p_book uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from public.book_members where book_id = p_book and user_id = auth.uid()
  order by role limit 1;
$$;

create or replace function public.is_member(p_book uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.book_members where book_id = p_book and user_id = auth.uid());
$$;

create or replace function public.is_couple(p_book uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.book_members where book_id = p_book and user_id = auth.uid() and role = 'couple');
$$;

create or replace function public.is_issuer(p_book uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.book_members where book_id = p_book and user_id = auth.uid() and role = 'issuer');
$$;

create or replace function public.stamp_book(p_stamp uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select book_id from public.stamps where id = p_stamp;
$$;

create or replace function public.mission_book(p_mission uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select book_id from public.missions where id = p_mission;
$$;

-- Storage object names look like "<book_id>/<stamp_id|book>/<file>"
create or replace function public.path_book(p_name text)
returns uuid language plpgsql immutable as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

-- ============================================================
-- Triggers
-- ============================================================

-- Hard limit: 5 photos per country (spec F5).
create or replace function public.enforce_photo_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform 1 from public.stamps where id = new.stamp_id for update; -- serialise concurrent inserts per stamp
  if (select count(*) from public.photos where stamp_id = new.stamp_id) >= 5 then
    raise exception 'photo_limit: a country can hold at most 5 photos' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists photos_limit on public.photos;
create trigger photos_limit before insert on public.photos
  for each row execute function public.enforce_photo_limit();

-- Couple members may only change their portrait photos; everything else on the data page is issuer-only.
create or replace function public.guard_book_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_issuer(old.id) then
    return new;
  end if;
  if (new.partner_a_name, new.partner_b_name, new.wedding_date, new.wedding_place,
      new.wedding_country, new.issued_by, new.issuer_note, new.id, new.created_at)
     is distinct from
     (old.partner_a_name, old.partner_b_name, old.wedding_date, old.wedding_place,
      old.wedding_country, old.issued_by, old.issuer_note, old.id, old.created_at) then
    raise exception 'not_allowed: only the issuer can edit the data page' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists books_guard on public.books;
create trigger books_guard before update on public.books
  for each row execute function public.guard_book_update();

-- Keep the wedding stamp in sync with the wedding date.
create or replace function public.sync_wedding_stamp()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.wedding_date is distinct from old.wedding_date then
    update public.stamps set first_visit_at = new.wedding_date::timestamptz
      where book_id = new.id and is_wedding;
    update public.visits v set local_date = new.wedding_date
      from public.stamps s
      where s.id = v.stamp_id and s.book_id = new.id and s.is_wedding and v.local_date = old.wedding_date;
  end if;
  return new;
end;
$$;
drop trigger if exists books_sync_wedding on public.books;
create trigger books_sync_wedding after update on public.books
  for each row execute function public.sync_wedding_stamp();

-- Couples may only edit the memo of a stamp.
create or replace function public.guard_stamp_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- SQL editor (no user) or a nested trigger such as sync_wedding_stamp() may change anything
  if auth.uid() is null or pg_trigger_depth() > 1 then return new; end if;
  if (new.id, new.book_id, new.country_code, new.color, new.is_wedding, new.first_visit_at, new.created_at)
     is distinct from
     (old.id, old.book_id, old.country_code, old.color, old.is_wedding, old.first_visit_at, old.created_at) then
    raise exception 'not_allowed: only the memo can be edited' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists stamps_guard on public.stamps;
create trigger stamps_guard before update on public.stamps
  for each row execute function public.guard_stamp_update();

-- ============================================================
-- Mission engine (server-side; the client can never set unlocked_at)
-- Mirrors src/lib/missions.ts
-- ============================================================

create or replace function public.check_missions(p_book uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_cur int;
  v_wed date;
  v_out jsonb := '[]'::jsonb;
begin
  if auth.uid() is not null and not public.is_member(p_book) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select wedding_date into v_wed from public.books where id = p_book;

  for r in
    select m.id, m.rule, m.target
    from public.missions m
    join public.mission_secrets s on s.mission_id = m.id
    where m.book_id = p_book and s.unlocked_at is null
  loop
    v_cur := case r.rule
      when 'first_trip' then
        (select count(*) from public.stamps where book_id = p_book and not is_wedding)
      when 'stamps_count' then
        (select count(*) from public.stamps where book_id = p_book and not is_wedding)
      when 'continents' then
        (select count(distinct c.continent) from public.stamps st
           join public.countries c on c.code = st.country_code where st.book_id = p_book)
      when 'cities_count' then
        (select count(distinct lower(btrim(v.city))) from public.visits v
           join public.stamps st on st.id = v.stamp_id
           where st.book_id = p_book and nullif(btrim(v.city), '') is not null)
      when 'anniversary' then
        (select count(distinct extract(year from v.local_date)) from public.visits v
           join public.stamps st on st.id = v.stamp_id
           where st.book_id = p_book
             and to_char(v.local_date, 'MM-DD') = to_char(v_wed, 'MM-DD')
             and v.local_date > v_wed)
      else 0
    end;

    if v_cur >= r.target then
      update public.mission_secrets set unlocked_at = now() where mission_id = r.id and unlocked_at is null;
      v_out := v_out || to_jsonb(r.id);
    end if;
  end loop;
  return v_out;
end;
$$;

-- Atomic check-in: create-or-reuse the country stamp, add a visit, evaluate missions.
create or replace function public.check_in(
  p_book uuid,
  p_country text,
  p_city text,
  p_lat double precision,
  p_lng double precision,
  p_method text,
  p_local_date date
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_code char(2) := upper(p_country);
  v_stamp_id uuid;
  v_created boolean := false;
  v_count int;
  v_date date := p_local_date;
  v_palette text[] := array['red','pink','mint','butter','sky'];
begin
  if not public.is_couple(p_book) then
    raise exception 'not_allowed: only the couple can check in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.countries where code = v_code) then
    raise exception 'bad_country: %', p_country;
  end if;
  if p_method not in ('gps','manual') then
    raise exception 'bad_method';
  end if;
  -- The local date may differ from UTC by at most a day (time zones); anything else is rejected.
  if v_date is null or abs(v_date - (now() at time zone 'utc')::date) > 1 then
    v_date := (now() at time zone 'utc')::date;
  end if;

  select id into v_stamp_id from public.stamps where book_id = p_book and country_code = v_code;
  if v_stamp_id is null then
    select count(*) into v_count from public.stamps where book_id = p_book;
    insert into public.stamps (book_id, country_code, color, first_visit_at)
      values (p_book, v_code, v_palette[1 + (v_count % 5)], now())
      on conflict (book_id, country_code) do nothing
      returning id into v_stamp_id;
    if v_stamp_id is null then
      select id into v_stamp_id from public.stamps where book_id = p_book and country_code = v_code;
    else
      v_created := true;
    end if;
  end if;

  insert into public.visits (stamp_id, city, lat, lng, method, checked_in_by, checked_in_at, local_date)
    values (v_stamp_id, nullif(left(btrim(coalesce(p_city, '')), 60), ''),
            round(p_lat::numeric, 4)::double precision, round(p_lng::numeric, 4)::double precision,
            p_method, auth.uid(), now(), v_date);

  return jsonb_build_object(
    'stamp_id', v_stamp_id,
    'created', v_created,
    'unlocked', public.check_missions(p_book)
  );
end;
$$;

-- Keep-alive endpoint for the GitHub Action (spec §6.5).
create or replace function public.ping()
returns int language sql stable as $$ select 1 $$;

-- ============================================================
-- Admin helpers (SQL editor only)
-- ============================================================

create or replace function public.create_wedding_stamp(p_book uuid, p_city text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; b public.books;
begin
  select * into b from public.books where id = p_book;
  insert into public.stamps (book_id, country_code, color, is_wedding, first_visit_at)
    values (p_book, b.wedding_country, 'red', true, b.wedding_date::timestamptz)
    on conflict (book_id, country_code) do update set is_wedding = true
    returning id into v_id;
  insert into public.visits (stamp_id, city, method, local_date, checked_in_at)
    values (v_id, p_city, 'manual', b.wedding_date, b.wedding_date::timestamptz);
  return v_id;
end;
$$;

create or replace function public.create_default_missions(p_book uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.missions (book_id, key, rule, target, title_th, title_en, desc_th, desc_en, icon, color, sort)
  values
    (p_book, 'first_trip', 'first_trip', 1, 'ทริปแรกหลังแต่งงาน', 'First trip as newlyweds',
     'เช็คอินประเทศแรกด้วยกัน', 'Check in to your first country together', 'heart', 'pink', 1),
    (p_book, 'collector_5', 'stamps_count', 5, 'นักสะสมแสตมป์', 'Stamp Collector',
     'สะสมแสตมป์ให้ครบ 5 ประเทศ', 'Collect 5 country stamps', 'stamp', 'butter', 2),
    (p_book, 'anniversary_1', 'anniversary', 1, 'ครบรอบ 1 ปี', '1st Anniversary',
     'เช็คอินที่ไหนก็ได้ในวันครบรอบแต่งงาน', 'Check in anywhere on your wedding anniversary', 'gift', 'mint', 3),
    (p_book, 'all_continents', 'continents', 6, 'รอบโลกด้วยกัน', 'Around the World',
     'ไปเยือนให้ครบทุกทวีป (แอนตาร์กติกาไม่บังคับ)', 'Visit every continent (Antarctica optional)', 'globe', 'sky', 4)
  on conflict (book_id, key) do nothing;

  insert into public.mission_secrets (mission_id, message)
    select id, '(write your secret message here)' from public.missions where book_id = p_book
    on conflict (mission_id) do nothing;
end;
$$;

-- ============================================================
-- Grants
-- ============================================================

revoke all on function public.create_wedding_stamp(uuid, text) from public, anon, authenticated;
revoke all on function public.create_default_missions(uuid) from public, anon, authenticated;
revoke all on function public.check_in(uuid, text, text, double precision, double precision, text, date) from public, anon;
revoke all on function public.check_missions(uuid) from public, anon;
grant execute on function public.check_in(uuid, text, text, double precision, double precision, text, date) to authenticated;
grant execute on function public.check_missions(uuid) to authenticated;
grant execute on function public.ping() to anon, authenticated;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.countries       enable row level security;
alter table public.books           enable row level security;
alter table public.book_members    enable row level security;
alter table public.stamps          enable row level security;
alter table public.visits          enable row level security;
alter table public.photos          enable row level security;
alter table public.missions        enable row level security;
alter table public.mission_secrets enable row level security;

-- countries: reference data
drop policy if exists countries_read on public.countries;
create policy countries_read on public.countries for select to authenticated using (true);

-- books
drop policy if exists books_read on public.books;
create policy books_read on public.books for select to authenticated using (public.is_member(id));
drop policy if exists books_update on public.books;
create policy books_update on public.books for update to authenticated
  using (public.is_member(id)) with check (public.is_member(id));

-- book_members: see your own memberships and your book's members; managed via SQL editor only
drop policy if exists members_read on public.book_members;
create policy members_read on public.book_members for select to authenticated
  using (user_id = auth.uid() or public.is_member(book_id));

-- stamps: members read; couple edits memo / deletes non-wedding stamps; creation only via check_in()
drop policy if exists stamps_read on public.stamps;
create policy stamps_read on public.stamps for select to authenticated using (public.is_member(book_id));
drop policy if exists stamps_update on public.stamps;
create policy stamps_update on public.stamps for update to authenticated
  using (public.is_couple(book_id)) with check (public.is_couple(book_id));
drop policy if exists stamps_delete on public.stamps;
create policy stamps_delete on public.stamps for delete to authenticated
  using (public.is_couple(book_id) and not is_wedding);

-- visits: members read; created only via check_in()
drop policy if exists visits_read on public.visits;
create policy visits_read on public.visits for select to authenticated
  using (public.is_member(public.stamp_book(stamp_id)));

-- photos: couple only (spec Q4 default — the issuer cannot see them)
drop policy if exists photos_read on public.photos;
create policy photos_read on public.photos for select to authenticated
  using (public.is_couple(public.stamp_book(stamp_id)));
drop policy if exists photos_insert on public.photos;
create policy photos_insert on public.photos for insert to authenticated
  with check (
    public.is_couple(public.stamp_book(stamp_id))
    and uploaded_by = auth.uid()
    and public.path_book(storage_path) = public.stamp_book(stamp_id)
  );
drop policy if exists photos_update on public.photos;
create policy photos_update on public.photos for update to authenticated
  using (public.is_couple(public.stamp_book(stamp_id)))
  with check (public.is_couple(public.stamp_book(stamp_id)));
drop policy if exists photos_delete on public.photos;
create policy photos_delete on public.photos for delete to authenticated
  using (public.is_couple(public.stamp_book(stamp_id)));

-- missions: members read; issuer writes
drop policy if exists missions_read on public.missions;
create policy missions_read on public.missions for select to authenticated using (public.is_member(book_id));
drop policy if exists missions_write on public.missions;
create policy missions_write on public.missions for all to authenticated
  using (public.is_issuer(book_id)) with check (public.is_issuer(book_id));

-- mission_secrets: couple sees ONLY unlocked rows; issuer sees and writes all
drop policy if exists secrets_read on public.mission_secrets;
create policy secrets_read on public.mission_secrets for select to authenticated
  using (
    public.is_issuer(public.mission_book(mission_id))
    or (unlocked_at is not null and public.is_couple(public.mission_book(mission_id)))
  );
drop policy if exists secrets_write on public.mission_secrets;
create policy secrets_write on public.mission_secrets for all to authenticated
  using (public.is_issuer(public.mission_book(mission_id)))
  with check (public.is_issuer(public.mission_book(mission_id)));

-- ============================================================
-- Storage: private bucket "photos", paths "<book_id>/<stamp_id|book>/<file>"
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 1048576, array['image/webp','image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = 1048576, allowed_mime_types = array['image/webp','image/jpeg'];

drop policy if exists photos_obj_read on storage.objects;
create policy photos_obj_read on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.is_couple(public.path_book(name)));
drop policy if exists photos_obj_insert on storage.objects;
create policy photos_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.is_couple(public.path_book(name)));
drop policy if exists photos_obj_update on storage.objects;
create policy photos_obj_update on storage.objects for update to authenticated
  using (bucket_id = 'photos' and public.is_couple(public.path_book(name)));
drop policy if exists photos_obj_delete on storage.objects;
create policy photos_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.is_couple(public.path_book(name)));
