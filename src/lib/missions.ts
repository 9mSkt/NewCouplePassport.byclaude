import type { MissionRule, Stamp } from '../data/types';
import { COUNTRY_CONTINENT } from './countries';

/**
 * Mission progress. Mirrors public.check_missions() in supabase/migrations/001_schema.sql —
 * the server is the source of truth for unlocking; this is used for progress bars and demo mode.
 */
export function missionCurrent(rule: MissionRule, stamps: Stamp[], weddingDate: string): number {
  switch (rule) {
    case 'first_trip':
    case 'stamps_count':
      return stamps.filter((s) => !s.isWedding).length;
    case 'continents':
      return new Set(stamps.map((s) => COUNTRY_CONTINENT[s.countryCode]).filter(Boolean)).size;
    case 'cities_count':
      return new Set(
        stamps.flatMap((s) => s.visits.map((v) => v.city?.trim().toLowerCase()).filter((c): c is string => !!c)),
      ).size;
    case 'anniversary': {
      const md = weddingDate.slice(5, 10);
      const years = new Set(
        stamps
          .flatMap((s) => s.visits)
          .filter((v) => v.localDate.slice(5, 10) === md && v.localDate > weddingDate)
          .map((v) => v.localDate.slice(0, 4)),
      );
      return years.size;
    }
    default:
      return 0;
  }
}

export function missionProgress(rule: MissionRule, target: number, stamps: Stamp[], weddingDate: string) {
  const current = missionCurrent(rule, stamps, weddingDate);
  return { current: Math.min(current, target), target, done: current >= target };
}

export interface BookStats {
  countries: number;
  cities: number;
  photos: number;
}

export function bookStats(stamps: Stamp[]): BookStats {
  return {
    countries: stamps.length,
    cities: missionCurrent('cities_count', stamps, '0000-00-00'),
    photos: stamps.reduce((n, s) => n + s.photoCount, 0),
  };
}

export function sortStamps(stamps: Stamp[]): Stamp[] {
  return [...stamps].sort((a, b) => {
    if (a.isWedding !== b.isWedding) return a.isWedding ? -1 : 1;
    return a.firstVisitAt.localeCompare(b.firstVisitAt);
  });
}

/** Local calendar date YYYY-MM-DD */
export function todayLocal(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
