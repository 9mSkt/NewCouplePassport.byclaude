import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBook } from '../state/BookContext';
import { useI18n } from '../i18n';
import { LangToggle, PixelButton } from '../components/ui';

const OPENED_KEY = 'cp.opened';

function Emblem() {
  return (
    <svg className="cover__emblem" viewBox="0 0 120 120" role="img" aria-label="">
      <circle cx="60" cy="60" r="44" fill="none" stroke="currentColor" strokeWidth="3" />
      <ellipse cx="60" cy="60" rx="20" ry="44" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d="M16 60h88M22 38h76M22 82h76" stroke="currentColor" strokeWidth="2.5" fill="none" />
      <path
        d="M60 96s-26-15-26-34a14 14 0 0 1 26-8 14 14 0 0 1 26 8c0 19-26 34-26 34z"
        fill="var(--navy)"
        stroke="currentColor"
        strokeWidth="3.5"
      />
      <path d="M60 86s-17-10-17-23a8 8 0 0 1 17-4 8 8 0 0 1 17 4c0 13-17 23-17 23z" fill="currentColor" />
      {[0, 72, 144, 216, 288].map((a) => (
        <circle key={a} cx={60 + 54 * Math.cos(((a - 90) * Math.PI) / 180)} cy={60 + 54 * Math.sin(((a - 90) * Math.PI) / 180)} r="2.5" fill="currentColor" />
      ))}
    </svg>
  );
}

export function Cover() {
  const { book } = useBook();
  const { t } = useI18n();
  const nav = useNavigate();
  const [opening, setOpening] = useState(false);
  const year = book.weddingDate.slice(0, 4);

  const open = () => {
    let first = false;
    try {
      first = !localStorage.getItem(OPENED_KEY);
      localStorage.setItem(OPENED_KEY, '1');
    } catch {
      /* ignore */
    }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (first && !reduced) {
      setOpening(true);
      setTimeout(() => nav('/book'), 900);
    } else nav('/book');
  };

  return (
    <main className={`cover ${opening ? 'is-opening' : ''}`}>
      <div className="cover__lang">
        <LangToggle />
      </div>
      <div className="cover__book">
        <div className="cover__frame">
          <p className="cover__issued px">★ ISSUED {year} ★</p>
          <div className="cover__emblemwrap">
            <Emblem />
            <span className="cover__sticker px">{t('cover.sticker')}</span>
          </div>
          <h1 className="cover__title">
            COUPLE
            <br />
            PASSPORT
          </h1>
          <p className="cover__th" lang="th">หนังสือเดินทางคู่รัก</p>
          <p className="cover__names">
            {book.partnerAName} <span aria-label="and">♥</span> {book.partnerBName}
          </p>
        </div>
      </div>
      <PixelButton onClick={open} className="cover__open">
        {t('cover.open')}
      </PixelButton>
      <p className="cover__footer">{t('cover.footer')}</p>
    </main>
  );
}
