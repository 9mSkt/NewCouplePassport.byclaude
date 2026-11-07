// Exports every app table to backup-YYYY-MM-DD.json using the service-role key (bypasses RLS).
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backup.mjs
// Photos themselves stay in Storage; their paths are included so they can be re-downloaded.
import { writeFileSync } from 'node:fs';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const TABLES = ['books', 'book_members', 'stamps', 'visits', 'photos', 'missions', 'mission_secrets'];
const out = { exported_at: new Date().toISOString(), tables: {} };

for (const t of TABLES) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${url}/rest/v1/${t}?select=*`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}` },
    });
    if (!res.ok) throw new Error(`${t}: HTTP ${res.status} ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) break;
  }
  out.tables[t] = rows;
  console.log(`${t}: ${rows.length} rows`);
}

const file = `backup-${new Date().toISOString().slice(0, 10)}.json`;
writeFileSync(file, JSON.stringify(out, null, 2));
console.log(`wrote ${file}`);
