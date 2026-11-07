import type { Accent, Book, Stamp as StampT } from '../data/types';
import { countryName } from '../lib/countries';
import { dottedDate, monthYear } from '../lib/format';
import { useI18n } from '../i18n';
import { Icon } from './Icon';
import { Landmark } from './Landmark';

export function StampArt({
  countryCode,
  color,
  isWedding,
  date,
  place,
  tilt = 0,
}: {
  countryCode: string;
  color: Accent;
  isWedding: boolean;
  /** ISO date of first visit */
  date: string;
  /** Wedding place (only for the wedding stamp) */
  place?: string;
  tilt?: number;
}) {
  const { lang, t } = useI18n();
  const en = countryName(countryCode, 'en');
  const local = lang === 'th' ? countryName(countryCode, 'th') : '';
  return (
    <div className="stamp" style={{ transform: `rotate(${tilt}deg)` }}>
      <div className="stamp__art" style={{ background: `var(--${color})` }}>
        {isWedding ? (
          <Icon name="heart" size={22} className="stamp__icon" />
        ) : (
          <Landmark countryCode={countryCode} size={30} className="stamp__icon" />
        )}
        <span className="stamp__country px">{isWedding ? t('stamps.wedding') : en}</span>
        <span className="stamp__sub">{isWedding ? place : local}</span>
        <span className="stamp__date px">{isWedding ? dottedDate(date).replace(/·/g, '-') : monthYear(date)}</span>
      </div>
    </div>
  );
}

export function StampTile({ stamp, book, index }: { stamp: StampT; book: Book; index: number }) {
  const tilt = [-2, 1.5, -1, 2, -1.5, 1][index % 6];
  return (
    <StampArt
      countryCode={stamp.countryCode}
      color={stamp.color}
      isWedding={stamp.isWedding}
      date={stamp.isWedding ? book.weddingDate : stamp.firstVisitAt}
      place={book.weddingPlace}
      tilt={tilt}
    />
  );
}

export function StampLocked({ hint }: { hint: string }) {
  return (
    <div className="stamp stamp--locked" aria-hidden="true">
      <Icon name="lock" size={20} />
      <span className="px">???</span>
      <span className="stamp__sub">{hint}</span>
    </div>
  );
}
