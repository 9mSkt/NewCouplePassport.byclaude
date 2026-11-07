export type Continent = 'AF' | 'AN' | 'AS' | 'EU' | 'NA' | 'OC' | 'SA';

/** ISO 3166-1 alpha-2 codes grouped by continent. Keep in sync with supabase/migrations/002_countries.sql (npm run gen:countries-sql). */
export const CONTINENT_COUNTRIES: Record<Continent, string> = {
  AF: 'DZ AO BJ BW BF BI CV CM CF TD KM CD CG CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU YT MA MZ NA NE NG RE RW SH ST SN SC SL SO ZA SS SD TZ TG TN UG EH ZM ZW',
  AN: 'AQ BV GS HM TF',
  AS: 'AF AM AZ BH BD BT BN KH CN CY GE HK IN ID IR IQ IL JP JO KZ KW KG LA LB MO MY MV MN MM NP KP OM PK PS PH QA SA SG KR LK SY TW TJ TH TL TR TM AE UZ VN YE IO CC CX',
  EU: 'AX AL AD AT BY BE BA BG HR CZ DK EE FO FI FR DE GI GR GG HU IS IE IM IT JE XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SJ SE CH UA GB VA',
  NA: 'AI AG AW BS BB BZ BM BQ VG CA KY CR CU CW DM DO SV GL GD GP GT HT HN JM MQ MX MS NI PA PR BL KN LC MF PM VC SX TT TC US VI UM',
  OC: 'AS AU CK FJ PF GU KI MH FM NR NC NZ NU NF MP PW PG PN WS SB TK TO TV VU WF',
  SA: 'AR BO BR CL CO EC FK GF GY PY PE SR UY VE',
};

export const COUNTRY_CONTINENT: Record<string, Continent> = Object.fromEntries(
  (Object.entries(CONTINENT_COUNTRIES) as [Continent, string][]).flatMap(([cont, list]) =>
    list.split(' ').map((code) => [code, cont]),
  ),
);

export const COUNTRY_CODES = Object.keys(COUNTRY_CONTINENT);

export function isCountryCode(code: string): boolean {
  return code.toUpperCase() in COUNTRY_CONTINENT;
}

const nameCache = new Map<string, Intl.DisplayNames>();

export function countryName(code: string, lang: 'th' | 'en'): string {
  let dn = nameCache.get(lang);
  if (!dn) {
    dn = new Intl.DisplayNames([lang], { type: 'region' });
    nameCache.set(lang, dn);
  }
  try {
    return dn.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export function flagEmoji(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65));
}
