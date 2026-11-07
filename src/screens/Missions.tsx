import { useState } from 'react';
import { useBook } from '../state/BookContext';
import { useI18n } from '../i18n';
import type { Mission } from '../data/types';
import { missionProgress } from '../lib/missions';
import { ProgressBar, Window } from '../components/ui';
import { Icon } from '../components/Icon';

const SEEN_KEY = 'cp.seenSecrets';

function seenSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}
function markSeen(id: string) {
  try {
    const s = seenSet();
    s.add(id);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...s]));
  } catch {
    /* ignore */
  }
}

function SecretCard({ mission, n }: { mission: Mission; n: number }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(() => seenSet().has(mission.id));
  const reveal = () => {
    setOpen(true);
    markSeen(mission.id);
  };
  return (
    <div className={`secret ${open ? 'is-open' : ''}`}>
      <p className="secret__title">
        <Icon name="envelope" size={18} /> {t('missions.secretUnlocked', { n })}
      </p>
      {open ? (
        <p className="secret__msg handwrite">{mission.message}</p>
      ) : (
        <button type="button" className="envelope" onClick={reveal} aria-label={t('missions.tapSeal')}>
          <span className="envelope__flap" />
          <span className="envelope__seal">♥</span>
          <span className="envelope__hint">{t('missions.tapSeal')}</span>
        </button>
      )}
    </div>
  );
}

export function Missions() {
  const { book, stamps, missions } = useBook();
  const { t, pick } = useI18n();
  let secretNo = 0;

  return (
    <main className="page">
      <Window title="SECRET MISSIONS ★">
        <p className="intro">{t('missions.intro')}</p>
        {!missions.length ? <p className="muted">{t('missions.empty')}</p> : null}
        <ul className="missions">
          {missions.map((m) => {
            const p = missionProgress(m.rule, m.target, stamps, book.weddingDate);
            const unlocked = !!m.unlockedAt;
            const shown = unlocked ? { ...p, current: p.target } : p;
            if (unlocked) secretNo++;
            return (
              <li key={m.id}>
                <article className={`mission ${unlocked ? 'is-done' : ''}`}>
                  <span className="mission__icon" style={{ background: `var(--${m.color})` }}>
                    <Icon name={m.icon} size={22} />
                  </span>
                  <div className="mission__body">
                    <h2 className="mission__title">{pick(m.titleTh, m.titleEn)}</h2>
                    <p className="mission__desc">{pick(m.descTh, m.descEn)}</p>
                    <div className="mission__progress">
                      <ProgressBar value={shown.current} max={shown.target} color={`var(--${m.color === 'butter' ? 'red' : m.color})`} />
                      <span className="px small">
                        {shown.current}/{shown.target}
                      </span>
                    </div>
                  </div>
                  <span className="mission__state" aria-label={unlocked ? t('missions.done') : t('missions.locked')}>
                    <Icon name={unlocked ? 'heart' : 'lock'} size={20} />
                  </span>
                </article>
                {unlocked && m.message ? <SecretCard mission={m} n={secretNo} /> : null}
              </li>
            );
          })}
        </ul>
      </Window>
    </main>
  );
}
