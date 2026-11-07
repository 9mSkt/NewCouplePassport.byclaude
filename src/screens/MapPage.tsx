import { Link } from 'react-router-dom';
import { useBook } from '../state/BookContext';
import { useI18n } from '../i18n';
import { COUNTRY_CONTINENT, countryName, flagEmoji, type Continent } from '../lib/countries';
import { Window } from '../components/ui';

const CONTINENT_NAMES: Record<Continent, [string, string]> = {
  AF: ['แอฟริกา', 'Africa'],
  AN: ['แอนตาร์กติกา', 'Antarctica'],
  AS: ['เอเชีย', 'Asia'],
  EU: ['ยุโรป', 'Europe'],
  NA: ['อเมริกาเหนือ', 'North America'],
  OC: ['โอเชียเนีย', 'Oceania'],
  SA: ['อเมริกาใต้', 'South America'],
};

/** v1 placeholder for F7 (world map is v1.1): visited countries grouped by continent. */
export function MapPage() {
  const { stamps } = useBook();
  const { t, lang, pick } = useI18n();
  const groups = new Map<Continent, typeof stamps>();
  for (const s of stamps) {
    const c = COUNTRY_CONTINENT[s.countryCode];
    if (!c) continue;
    groups.set(c, [...(groups.get(c) ?? []), s]);
  }

  return (
    <main className="page">
      <Window title="MAP.EXE">
        <p className="intro">{t('map.soon')}</p>
        {[...groups.entries()].map(([cont, list]) => (
          <section key={cont} className="continent">
            <h2 className="continent__name">
              {pick(...CONTINENT_NAMES[cont])} <span className="muted px small">{list.length}</span>
            </h2>
            <ul className="continent__list">
              {list.map((s) => (
                <li key={s.id}>
                  <Link to={`/stamps/${s.id}`} className="chip" style={{ background: `var(--${s.color})` }}>
                    <span aria-hidden="true">{flagEmoji(s.countryCode)}</span> {countryName(s.countryCode, lang)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </Window>
    </main>
  );
}
