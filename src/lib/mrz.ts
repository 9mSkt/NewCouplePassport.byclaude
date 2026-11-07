/** Decorative ICAO-9303-style machine-readable zone (2 lines × 44 chars). */

const LEN = 44;

function clean(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '<')
    .replace(/^<+|<+$/g, '');
}

export function checkDigit(s: string): number {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    let v = 0;
    if (c >= '0' && c <= '9') v = c.charCodeAt(0) - 48;
    else if (c >= 'A' && c <= 'Z') v = c.charCodeAt(0) - 55;
    sum += v * weights[i % 3];
  }
  return sum % 10;
}

const pad = (s: string, n: number) => (s + '<'.repeat(n)).slice(0, n);

export function makeMrz(opts: { nameA: string; nameB: string; date: string; bookId: string; country: string }): [string, string] {
  const a = clean(opts.nameA) || 'PARTNER';
  const b = clean(opts.nameB) || 'PARTNER';
  const cc = pad(clean(opts.country) || 'XX', 3);
  const line1 = pad(`P<${cc}${a}<<${b}`, LEN);

  const doc = pad(opts.bookId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase(), 9);
  const ymd = opts.date.replace(/-/g, '').slice(2, 8).padEnd(6, '0');
  const parts = `${doc}${checkDigit(doc)}${cc}${ymd}${checkDigit(ymd)}X${ymd}${checkDigit(ymd)}`;
  const body = pad(parts + 'LOVE<FOREVER', LEN - 1);
  const line2 = body + checkDigit(body);
  return [line1, line2];
}
