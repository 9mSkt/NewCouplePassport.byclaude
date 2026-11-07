const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const p2 = (n: number) => String(n).padStart(2, '0');

function parts(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return { y, m, d };
}

/** 21 NOV 2026 */
export function passportDate(iso: string): string {
  const { y, m, d } = parts(iso);
  return `${p2(d)} ${MONTHS[m - 1]} ${y}`;
}

/** 04-2027 */
export function monthYear(iso: string): string {
  const { y, m } = parts(iso);
  return `${p2(m)}-${y}`;
}

/** 21·11·26 */
export function dottedDate(iso: string): string {
  const { y, m, d } = parts(iso);
  return `${p2(d)}·${p2(m)}·${String(y).slice(2)}`;
}

/** 04 – 11 APR 2027, or 28 MAR – 02 APR 2027, or across years */
export function dateRange(isoDates: string[]): string {
  if (!isoDates.length) return '';
  const sorted = [...isoDates].sort();
  const a = parts(sorted[0]);
  const b = parts(sorted[sorted.length - 1]);
  if (sorted[0].slice(0, 10) === sorted[sorted.length - 1].slice(0, 10)) return passportDate(sorted[0]);
  if (a.y === b.y && a.m === b.m) return `${p2(a.d)} – ${p2(b.d)} ${MONTHS[a.m - 1]} ${a.y}`;
  if (a.y === b.y) return `${p2(a.d)} ${MONTHS[a.m - 1]} – ${p2(b.d)} ${MONTHS[b.m - 1]} ${a.y}`;
  return `${passportDate(sorted[0])} – ${passportDate(sorted[sorted.length - 1])}`;
}

export function kb(bytes: number): string {
  return `${Math.round(bytes / 1024)} KB`;
}
