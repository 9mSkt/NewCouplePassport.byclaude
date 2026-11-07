import { describe, expect, it } from 'vitest';
import type { Stamp } from '../data/types';
import { bookStats, missionCurrent, missionProgress, sortStamps } from './missions';
import { checkDigit, makeMrz } from './mrz';
import { dateRange } from './format';

let n = 0;
function stamp(cc: string, visits: [string | null, string][], extra: Partial<Stamp> = {}): Stamp {
  const id = `s${n++}`;
  return {
    id,
    countryCode: cc,
    color: 'pink',
    isWedding: false,
    memo: '',
    firstVisitAt: `${visits[0]?.[1] ?? '2027-01-01'}T00:00:00Z`,
    photoCount: 0,
    visits: visits.map(([city, d], i) => ({ id: `${id}v${i}`, stampId: id, city, method: 'gps', checkedInAt: `${d}T00:00:00Z`, localDate: d })),
    ...extra,
  };
}

const WED = '2026-11-21';
const wedding = stamp('TH', [['Bangkok', WED]], { isWedding: true });

describe('mission rules', () => {
  it('first_trip ignores the wedding stamp', () => {
    expect(missionProgress('first_trip', 1, [wedding], WED).done).toBe(false);
    expect(missionProgress('first_trip', 1, [wedding, stamp('JP', [['Tokyo', '2027-04-04']])], WED).done).toBe(true);
  });

  it('stamps_count counts countries, not visits', () => {
    const jp = stamp('JP', [['Tokyo', '2027-04-04'], ['Kyoto', '2027-04-08'], ['Osaka', '2028-01-01']]);
    const p = missionProgress('stamps_count', 5, [wedding, jp], WED);
    expect(p.current).toBe(1);
    expect(p.done).toBe(false);
  });

  it('continents counts distinct continents including the wedding country', () => {
    const list = [wedding, stamp('JP', [['Tokyo', '2027-04-04']]), stamp('FR', [['Paris', '2027-05-01']]), stamp('IT', [['Rome', '2027-05-04']])];
    expect(missionCurrent('continents', list, WED)).toBe(2);
  });

  it('anniversary needs a check-in on the same month/day in a later year', () => {
    expect(missionCurrent('anniversary', [wedding], WED)).toBe(0);
    const s = stamp('JP', [['Tokyo', '2027-11-21']]);
    expect(missionProgress('anniversary', 1, [wedding, s], WED).done).toBe(true);
    const off = stamp('KR', [['Seoul', '2027-11-20']]);
    expect(missionCurrent('anniversary', [wedding, off], WED)).toBe(0);
  });

  it('cities_count de-duplicates case-insensitively and ignores empty cities', () => {
    const a = stamp('JP', [['Tokyo', '2027-01-01'], ['tokyo', '2028-01-01'], [null, '2028-02-02']]);
    expect(missionCurrent('cities_count', [wedding, a], WED)).toBe(2);
  });

  it('progress is capped at target', () => {
    const many = ['JP', 'KR', 'FR', 'IT', 'US', 'AU'].map((c) => stamp(c, [[c, '2027-01-01']]));
    expect(missionProgress('stamps_count', 5, many, WED)).toEqual({ current: 5, target: 5, done: true });
  });
});

describe('stats & sorting', () => {
  it('computes countries / cities / photos', () => {
    const jp = stamp('JP', [['Tokyo', '2027-04-04'], ['Kyoto', '2027-04-08']], { photoCount: 3 });
    expect(bookStats([wedding, jp])).toEqual({ countries: 2, cities: 3, photos: 3 });
  });
  it('keeps the wedding stamp first, then by first visit', () => {
    const late = stamp('FR', [['Paris', '2029-01-01']]);
    const early = stamp('JP', [['Tokyo', '2027-01-01']]);
    expect(sortStamps([late, early, wedding]).map((s) => s.countryCode)).toEqual(['TH', 'JP', 'FR']);
  });
});

describe('mrz', () => {
  it('uses the ICAO 7-3-1 check digit', () => {
    expect(checkDigit('L898902C3')).toBe(6); // ICAO 9303 specimen
    expect(checkDigit('740812')).toBe(2);
  });
  it('produces two 44-char lines', () => {
    const [a, b] = makeMrz({ nameA: 'Min', nameB: 'Ton', date: WED, bookId: 'abc-123', country: 'TH' });
    expect(a).toHaveLength(44);
    expect(b).toHaveLength(44);
    expect(a.startsWith('P<TH<MIN<<TON')).toBe(true);
  });
  it('falls back when names have no Latin letters', () => {
    const [a] = makeMrz({ nameA: 'มิน', nameB: 'ต้น', date: WED, bookId: 'x', country: 'TH' });
    expect(a).toContain('PARTNER<<PARTNER');
  });
});

describe('format', () => {
  it('formats date ranges', () => {
    expect(dateRange(['2027-04-11', '2027-04-04'])).toBe('04 – 11 APR 2027');
    expect(dateRange(['2027-03-28', '2027-04-02'])).toBe('28 MAR – 02 APR 2027');
    expect(dateRange(['2026-11-21'])).toBe('21 NOV 2026');
  });
});
