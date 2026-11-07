import { Link, useNavigate } from 'react-router-dom';
import { useBook } from '../state/BookContext';
import { useI18n, type MsgKey } from '../i18n';
import { bookStats } from '../lib/missions';
import { countryName } from '../lib/countries';
import { PixelButton, Window } from '../components/ui';
import { StampLocked, StampTile } from '../components/Stamp';

const HINTS: MsgKey[] = ['stamps.hint1', 'stamps.hint2', 'stamps.hint3'];

export function StampBook() {
  const { book, role, stamps } = useBook();
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const stats = bookStats(stamps);

  // Always show at least 3 locked slots, and fill the last row of 3.
  const minLocked = 3;
  const total = Math.ceil((stamps.length + minLocked) / 3) * 3;
  const lockedCount = total - stamps.length;

  return (
    <main className="page">
      <Window title="STAMP BOOK" right={<span className="windowbar__tag px">P.02</span>}>
        <h1 className="page-title">{t('stamps.title')}</h1>
        <div className="stats">
          <div className="stat" style={{ background: 'var(--pink)' }}>
            <strong className="px">{stats.countries}</strong>
            <span>{t('stamps.countries')}</span>
          </div>
          <div className="stat" style={{ background: 'var(--mint)' }}>
            <strong className="px">{stats.cities}</strong>
            <span>{t('stamps.cities')}</span>
          </div>
          <div className="stat" style={{ background: 'var(--butter)' }}>
            <strong className="px">{stats.photos}</strong>
            <span>{t('stamps.photos')}</span>
          </div>
        </div>

        <ul className="stampgrid">
          {stamps.map((s, i) => (
            <li key={s.id}>
              <Link
                to={`/stamps/${s.id}`}
                className="stamplink"
                aria-label={t('stamps.openStamp', { country: s.isWedding ? t('stamps.wedding') : countryName(s.countryCode, lang) })}
              >
                <StampTile stamp={s} book={book} index={i} />
              </Link>
            </li>
          ))}
          {Array.from({ length: lockedCount }, (_, i) => (
            <li key={`locked-${i}`}>
              <StampLocked hint={t(HINTS[i % HINTS.length])} />
            </li>
          ))}
        </ul>
      </Window>

      {role === 'couple' ? (
        <PixelButton className="block" onClick={() => nav('/check-in')}>
          {t('stamps.checkin')}
        </PixelButton>
      ) : null}
    </main>
  );
}
