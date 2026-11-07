import { useState, type FormEvent } from 'react';
import { useBook } from '../state/BookContext';
import { useI18n } from '../i18n';
import { api } from '../data/api';
import { ACCENTS, MISSION_RULES, type Mission, type MissionDraft } from '../data/types';
import { passportDate } from '../lib/format';
import { ErrorBox, PixelButton, Window } from '../components/ui';
import { Icon, ICON_NAMES } from '../components/Icon';

function BookForm() {
  const { book, reloadBook, reloadStamps } = useBook();
  const { t, errorText } = useI18n();
  const [f, setF] = useState({
    partnerAName: book.partnerAName,
    partnerBName: book.partnerBName,
    weddingDate: book.weddingDate,
    weddingPlace: book.weddingPlace,
    issuedBy: book.issuedBy,
    issuerNote: book.issuerNote,
  });
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setState('saving');
    try {
      await api.updateBook(book.id, f);
      await Promise.all([reloadBook(), reloadStamps()]);
      setState('saved');
      setTimeout(() => setState('idle'), 1800);
    } catch (ex) {
      setErr(errorText(ex));
      setState('idle');
    }
  };

  return (
    <form className="card form" onSubmit={submit}>
      <h2>{t('issuer.book')}</h2>
      <div className="grid2">
        <label className="field">
          <span>{t('issuer.partnerA')}</span>
          <input value={f.partnerAName} onChange={set('partnerAName')} required maxLength={30} />
        </label>
        <label className="field">
          <span>{t('issuer.partnerB')}</span>
          <input value={f.partnerBName} onChange={set('partnerBName')} required maxLength={30} />
        </label>
        <label className="field">
          <span>{t('issuer.weddingDate')}</span>
          <input type="date" value={f.weddingDate} onChange={set('weddingDate')} required />
        </label>
        <label className="field">
          <span>{t('issuer.weddingPlace')}</span>
          <input value={f.weddingPlace} onChange={set('weddingPlace')} required maxLength={40} />
        </label>
      </div>
      <label className="field">
        <span>{t('issuer.issuedBy')}</span>
        <input value={f.issuedBy} onChange={set('issuedBy')} maxLength={40} />
      </label>
      <label className="field">
        <span>{t('issuer.note')}</span>
        <textarea value={f.issuerNote} onChange={set('issuerNote')} rows={4} maxLength={400} />
      </label>
      {err ? <ErrorBox message={err} /> : null}
      <PixelButton type="submit" variant="butter" arrows={false} disabled={state === 'saving'}>
        {state === 'saved' ? t('issuer.saved') : t('issuer.saveBook')}
      </PixelButton>
    </form>
  );
}

function toDraft(m: Mission): MissionDraft {
  const { unlockedAt: _u, message, ...rest } = m;
  return { ...rest, message: message ?? '' };
}

function MissionForm({ initial, onDone }: { initial: MissionDraft; onDone(): void }) {
  const { book, reloadMissions, missions } = useBook();
  const { t, errorText } = useI18n();
  const [d, setD] = useState<MissionDraft>(initial);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [err, setErr] = useState<string | null>(null);
  const existing = missions.find((m) => m.id === initial.id);
  const set = <K extends keyof MissionDraft>(k: K, v: MissionDraft[K]) => setD({ ...d, [k]: v });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setState('saving');
    try {
      await api.saveMission(book.id, { ...d, key: d.key.trim() || `mission_${Date.now()}` });
      await reloadMissions();
      setState('saved');
      setTimeout(() => setState('idle'), 1800);
      if (!initial.id) onDone();
    } catch (ex) {
      setErr(errorText(ex));
      setState('idle');
    }
  };
  const del = async () => {
    if (!initial.id || !window.confirm(t('issuer.confirmDeleteMission'))) return;
    try {
      await api.deleteMission(initial.id);
      await reloadMissions();
    } catch (ex) {
      setErr(errorText(ex));
    }
  };

  return (
    <form className="card form mission-form" onSubmit={submit}>
      <header className="card__head">
        <h3>
          <span className="mission__icon small" style={{ background: `var(--${d.color})` }}>
            <Icon name={d.icon} size={16} />
          </span>{' '}
          {d.titleTh || d.titleEn || '—'}
        </h3>
        {existing ? (
          <span className={`badge ${existing.unlockedAt ? 'badge--ok' : ''}`}>
            {existing.unlockedAt
              ? t('issuer.unlockedOn', { date: passportDate(existing.unlockedAt) })
              : t('issuer.stillLocked')}
          </span>
        ) : null}
      </header>
      <div className="grid2">
        <label className="field">
          <span>{t('issuer.titleTh')}</span>
          <input value={d.titleTh} onChange={(e) => set('titleTh', e.target.value)} required maxLength={60} />
        </label>
        <label className="field">
          <span>{t('issuer.titleEn')}</span>
          <input value={d.titleEn} onChange={(e) => set('titleEn', e.target.value)} maxLength={60} />
        </label>
        <label className="field">
          <span>{t('issuer.descTh')}</span>
          <input value={d.descTh} onChange={(e) => set('descTh', e.target.value)} maxLength={120} />
        </label>
        <label className="field">
          <span>{t('issuer.descEn')}</span>
          <input value={d.descEn} onChange={(e) => set('descEn', e.target.value)} maxLength={120} />
        </label>
        <label className="field">
          <span>{t('issuer.rule')}</span>
          <select value={d.rule} onChange={(e) => set('rule', e.target.value as MissionDraft['rule'])}>
            {MISSION_RULES.map((r) => (
              <option key={r} value={r}>
                {t(`rule.${r}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('issuer.target')} (N)</span>
          <input type="number" min={1} max={250} value={d.target} onChange={(e) => set('target', Math.max(1, Number(e.target.value) || 1))} />
        </label>
        <label className="field">
          <span>{t('issuer.icon')}</span>
          <select value={d.icon} onChange={(e) => set('icon', e.target.value)}>
            {ICON_NAMES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('issuer.color')}</span>
          <select value={d.color} onChange={(e) => set('color', e.target.value as MissionDraft['color'])}>
            {ACCENTS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('issuer.sort')}</span>
          <input type="number" value={d.sort} onChange={(e) => set('sort', Number(e.target.value) || 0)} />
        </label>
        <label className="field">
          <span>{t('issuer.key')}</span>
          <input value={d.key} onChange={(e) => set('key', e.target.value.replace(/[^a-z0-9_]/gi, '_').toLowerCase())} maxLength={40} />
        </label>
      </div>
      <label className="field">
        <span>
          <Icon name="envelope" size={14} /> {t('issuer.message')}
        </span>
        <textarea value={d.message} onChange={(e) => set('message', e.target.value)} rows={4} maxLength={1000} required />
      </label>
      {err ? <ErrorBox message={err} /> : null}
      <div className="row">
        {initial.id ? (
          <button type="button" className="pixbtn pixbtn--paper small" onClick={del}>
            <Icon name="trash" size={16} /> <span>{t('issuer.deleteMission')}</span>
          </button>
        ) : (
          <button type="button" className="pixbtn pixbtn--paper small" onClick={onDone}>
            <span>{t('common.cancel')}</span>
          </button>
        )}
        <button type="submit" className="pixbtn pixbtn--red small" disabled={state === 'saving'}>
          <span>{state === 'saved' ? t('issuer.saved') : t('issuer.saveMission')}</span>
        </button>
      </div>
    </form>
  );
}

export function Issuer() {
  const { missions } = useBook();
  const { t } = useI18n();
  const [adding, setAdding] = useState(false);
  const blank: MissionDraft = {
    key: '',
    rule: 'stamps_count',
    target: 3,
    titleTh: '',
    titleEn: '',
    descTh: '',
    descEn: '',
    icon: 'star',
    color: 'pink',
    sort: (missions.at(-1)?.sort ?? 0) + 1,
    message: '',
  };

  return (
    <main className="page">
      <Window title="ISSUER.EXE">
        <h1 className="page-title">{t('issuer.title')}</h1>
        <p className="intro">{t('issuer.intro')}</p>
      </Window>
      <BookForm />
      <h2 className="section-title">{t('issuer.missions')}</h2>
      {missions.map((m) => (
        <MissionForm key={m.id + (m.unlockedAt ?? '')} initial={toDraft(m)} onDone={() => undefined} />
      ))}
      {adding ? (
        <MissionForm initial={blank} onDone={() => setAdding(false)} />
      ) : (
        <PixelButton variant="mint" className="block" onClick={() => setAdding(true)}>
          {t('issuer.addMission')}
        </PixelButton>
      )}
    </main>
  );
}
