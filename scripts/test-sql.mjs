// Runs the Supabase migrations + seed in an in-process Postgres (PGlite) with stub auth/storage schemas,
// then checks RLS, the 5-photo limit, check_in() and mission unlocking. Usage: npm run test:sql
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const db = new PGlite();
const ok = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok  -', m); };
async function expectErr(sql, params, re, m) {
  try { await db.query(sql, params); ok(false, m + ' (no error)'); }
  catch (e) { ok(re.test(e.message), `${m} → ${e.message.slice(0, 70)}`); }
}

// --- Supabase stubs ---
await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth; create schema storage;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant usage on schema public, storage, auth to authenticated, anon;
`);
for (const f of ['001_schema.sql', '002_countries.sql']) {
  const sql = readFileSync(`${repo}/supabase/migrations/${f}`, 'utf8');
  try { await db.exec(sql); }
  catch (e) { console.log(`ERR in ${f}:`, e.message, '\n  near:', sql.slice(Math.max(0, (e.position ?? 1) - 120), (e.position ?? 1) + 60)); process.exit(1); }
}
await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated;
               grant select, insert, update, delete on storage.objects to authenticated;`);

const U = { bride: '00000000-0000-0000-0000-00000000000a', groom: '00000000-0000-0000-0000-00000000000b', issuer: '00000000-0000-0000-0000-00000000000c', stranger: '00000000-0000-0000-0000-00000000000d' };
await db.exec(`insert into auth.users values
  ('${U.bride}','bride@example.com'),('${U.groom}','groom@example.com'),('${U.issuer}','you@example.com'),('${U.stranger}','x@example.com');`);
await db.exec(readFileSync(`${repo}/supabase/seed.sql`, 'utf8'));
const bookId = (await db.query('select id from books')).rows[0].id;
ok(!!bookId, 'seed created a book');
ok((await db.query('select count(*)::int n from book_members')).rows[0].n === 3, 'seed added 3 members');
ok((await db.query('select count(*)::int n from missions')).rows[0].n === 4, 'seed added 4 missions');

async function as(user) {
  await db.exec(`reset role; select set_config('request.uid', '${user ?? ''}', false); set role authenticated;`);
}

// --- stranger sees nothing ---
await as(U.stranger);
ok((await db.query('select * from books')).rows.length === 0, 'stranger cannot read books');
ok((await db.query('select * from stamps')).rows.length === 0, 'stranger cannot read stamps');
ok((await db.query('select * from mission_secrets')).rows.length === 0, 'stranger cannot read secrets');
await expectErr('select check_in($1,$2,$3,$4,$5,$6,$7)', [bookId, 'JP', 'Tokyo', 1, 2, 'gps', new Date().toISOString().slice(0,10)], /not_allowed/, 'stranger cannot check in');

// --- issuer writes secrets ---
await as(U.issuer);
ok((await db.query('select * from mission_secrets')).rows.length === 4, 'issuer reads all secrets');
await db.query(`update mission_secrets set message = 'SECRET-' || mission_id`);
await expectErr('select check_in($1,$2,$3,$4,$5,$6,$7)', [bookId, 'JP', 'Tokyo', 1, 2, 'gps', null], /not_allowed/, 'issuer cannot check in');

// --- couple ---
await as(U.bride);
ok((await db.query('select * from books')).rows.length === 1, 'couple reads book');
ok((await db.query('select * from mission_secrets')).rows.length === 0, 'couple sees NO locked secrets');
const embed = await db.query(`select m.key, s.message from missions m left join mission_secrets s on s.mission_id = m.id`);
ok(embed.rows.every((r) => r.message === null), 'join from missions does not leak locked messages');
await expectErr(`update books set issuer_note = 'hacked'`, [], /not_allowed/, 'couple cannot edit issuer note');
await db.query(`update books set partner_a_photo = '${bookId}/book/a.webp'`);
ok(true, 'couple can set portrait photo');
await db.query(`update mission_secrets set unlocked_at = now()`);
await as(U.issuer);
ok((await db.query('select count(*)::int n from mission_secrets where unlocked_at is not null')).rows[0].n === 0, 'couple update of unlocked_at affected 0 rows');

await as(U.bride);
await expectErr(`insert into stamps (book_id, country_code) values ('${bookId}', 'FR')`, [], /row-level security/, 'couple cannot insert stamps directly');
const today = new Date().toISOString().slice(0, 10);
let r = (await db.query('select check_in($1,$2,$3,$4,$5,$6,$7) as j', [bookId, 'jp', 'Tokyo', 35.68951, 139.69171, 'gps', today])).rows[0].j;
ok(r.created === true && r.unlocked.length === 1, `first trip creates stamp & unlocks 1 mission (${JSON.stringify(r.unlocked)})`);
const secrets = (await db.query('select * from mission_secrets')).rows;
ok(secrets.length === 1 && secrets[0].message.startsWith('SECRET-'), 'couple now sees exactly the unlocked secret');
r = (await db.query('select check_in($1,$2,$3,$4,$5,$6,$7) as j', [bookId, 'JP', 'Kyoto', null, null, 'manual', today])).rows[0].j;
ok(r.created === false && r.unlocked.length === 0, 'same country again → same stamp, no new unlock');
ok((await db.query(`select count(*)::int n from stamps where country_code='JP'`)).rows[0].n === 1, 'one JP stamp');
ok((await db.query(`select count(*)::int n from visits v join stamps s on s.id=v.stamp_id where s.country_code='JP'`)).rows[0].n === 2, 'two JP visits');
ok((await db.query(`select lat from visits where city='Tokyo'`)).rows[0].lat === 35.6895, 'coordinates rounded');
r = (await db.query('select check_in($1,$2,$3,$4,$5,$6,$7) as j', [bookId, 'KR', 'Seoul', null, null, 'manual', '2020-01-01'])).rows[0].j;
ok((await db.query(`select local_date::text d from visits where city='Seoul'`)).rows[0].d !== '2020-01-01', 'backdated local_date is rejected');
await expectErr('select check_in($1,$2,$3,$4,$5,$6,$7)', [bookId, 'ZZ', null, null, null, 'manual', today], /bad_country/, 'unknown country rejected');
for (const cc of ['FR', 'IT', 'US']) await db.query('select check_in($1,$2,$3,$4,$5,$6,$7)', [bookId, cc, null, null, null, 'manual', today]);
const after = (await db.query(`select m.key from missions m join mission_secrets s on s.mission_id=m.id`)).rows.map((x) => x.key).sort();
ok(JSON.stringify(after) === JSON.stringify(['collector_5', 'first_trip']), `5 countries unlocks collector_5 (${after})`);

// stamp guard
const jp = (await db.query(`select id from stamps where country_code='JP'`)).rows[0].id;
await db.query(`update stamps set memo = 'yay' where id = $1`, [jp]);
ok(true, 'couple can edit memo');
await expectErr(`update stamps set country_code = 'DE' where id = $1`, [jp], /not_allowed/, 'couple cannot change country');
await db.query(`delete from stamps where is_wedding`);
ok((await db.query(`select count(*)::int n from stamps where is_wedding`)).rows[0].n === 1, 'wedding stamp cannot be deleted');

// photos limit + RLS
for (let i = 0; i < 5; i++)
  await db.query(`insert into photos (stamp_id, storage_path, width, height, bytes, uploaded_by) values ($1, $2, 10, 10, 100, $3)`, [jp, `${bookId}/${jp}/${i}.webp`, U.bride]);
await expectErr(`insert into photos (stamp_id, storage_path, width, height, bytes, uploaded_by) values ($1, $2, 10, 10, 100, $3)`, [jp, `${bookId}/${jp}/6.webp`, U.bride], /photo_limit/, '6th photo rejected by DB');
const fr = (await db.query(`select id from stamps where country_code='FR'`)).rows[0].id;
await expectErr(`insert into photos (stamp_id, storage_path, width, height, bytes, uploaded_by) values ($1, $2, 10, 10, 100, $3)`, [fr, `${bookId}/${fr}/7.webp`, U.groom], /row-level security/, 'cannot upload as someone else');
await expectErr(`insert into photos (stamp_id, storage_path, width, height, bytes, uploaded_by) values ($1, $2, 10, 10, 100, $3)`, [fr, `11111111-1111-1111-1111-111111111111/${fr}/8.webp`, U.bride], /row-level security/, 'photo path must be inside own book');
await db.query(`insert into storage.objects (bucket_id, name) values ('photos', '${bookId}/${jp}/0.webp')`);
ok(true, 'couple can write storage object in own book');
await expectErr(`insert into storage.objects (bucket_id, name) values ('photos', '11111111-1111-1111-1111-111111111111/x/y.webp')`, [], /row-level security/, 'couple cannot write into another book folder');

await as(U.issuer);
ok((await db.query('select * from photos')).rows.length === 0, 'issuer cannot see photos');
ok((await db.query('select * from storage.objects')).rows.length === 0, 'issuer cannot see photo files');
await db.query(`update books set wedding_date = '2026-11-22', issuer_note = 'new note'`);
ok((await db.query(`select first_visit_at::date::text d from stamps where is_wedding`)).rows[0].d === '2026-11-22', 'issuer edit syncs wedding stamp date');

// anniversary via issuer-set date equal to today's month/day one year back
await as(U.issuer);
const t = new Date(); const lastYear = `${t.getUTCFullYear() - 1}-${today.slice(5)}`;
await db.query(`update books set wedding_date = $1`, [lastYear]);
await as(U.groom);
r = (await db.query('select check_in($1,$2,$3,$4,$5,$6,$7) as j', [bookId, 'TH', 'Chiang Mai', null, null, 'manual', today])).rows[0].j;
const keys = (await db.query(`select m.key from missions m join mission_secrets s on s.mission_id=m.id`)).rows.map((x) => x.key);
ok(keys.includes('anniversary_1'), 'anniversary check-in unlocks anniversary_1');
ok(r.created === false, 'checking in to the wedding country reuses the wedding stamp');

await as(null);
await db.exec('reset role; set role anon;');
ok((await db.query('select ping() as p')).rows[0].p === 1, 'anon can ping');
await expectErr('select * from books', [], /permission denied/, 'anon cannot read books');
console.log(process.exitCode ? '\nSOME TESTS FAILED' : '\nALL SQL TESTS PASSED');
