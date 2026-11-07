import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useBook } from '../state/BookContext';
import { useI18n } from '../i18n';
import { api } from '../data/api';
import { stampColorFor, type CheckInResult } from '../data/types';
import { getPosition, reverseGeocode } from '../lib/geo';
import { COUNTRY_CODES, countryName, flagEmoji } from '../lib/countries';
import { todayLocal } from '../lib/missions';
import { playStampSound } from '../lib/sound';
import { ErrorBox, PixelButton, Spinner, Window } from '../components/ui';
import { StampArt } from '../components/Stamp';
import { Icon } from '../components/Icon';

type Step =
  | { s: 'start' }
  | { s: 'locating' }
  | { s: 'manual'; note?: string }
  | { s: 'confirm'; countryCode: string; city: string; lat: number | null; lng: number | null; method: 'gps' | 'manual' }
  | { s: 'stamping'; countryCode: string }
  | { s: 'done'; countryCode: string; result: CheckInResult };

function CountryPicker({ onPick }: { onPick(code: string): void }) {
  const { t, lang } = useI18n();
  const [q, setQ] = useState('');
  const all = useMemo(
    () =>
      COUNTRY_CODES.map((code) => ({ code, th: countryName(code, 'th'), en: countryName(code, 'en') })).sort((a, b) =>
        (lang === 'th' ? a.th : a.en).localeCompare(lang === 'th' ? b.th : b.en, lang),
      ),
    [lang],
  );
  const needle = q.trim().toLowerCase();
  const list = needle
    ? all.filter((c) => c.en.toLowerCase().includes(needle) || c.th.includes(needle) || c.code.toLowerCase() === needle)
    : all;

  return (
    <div className="picker">
      <label className="field">
        <span>{t('checkin.search')}</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="Japan / ญี่ปุ่น" />
      </label>
      <ul className="picker__list" role="listbox" aria-label={t('checkin.search')}>
        {list.map((c) => (
          <li key={c.code}>
            <button type="button" role="option" aria-selected={false} onClick={() => onPick(c.code)}>
              <span className="picker__flag" aria-hidden="true">{flagEmoji(c.code)}</span>
              <span>{lang === 'th' ? c.th : c.en}</span>
              <span className="muted small">{lang === 'th' ? c.en : c.th}</span>
            </button>
          </li>
        ))}
        {!list.length ? <li className="muted">{t('checkin.noResults', { q })}</li> : null}
      </ul>
    </div>
  );
}

export function CheckIn() {
  const { book, role, stamps, reloadStamps, reloadMissions } = useBook();
  const { t, lang, errorText } = useI18n();
  const nav = useNavigate();
  const [step, setStep] = useState<Step>({ s: 'start' });
  const [err, setErr] = useState<string | null>(null);

  if (role !== 'couple') {
    return (
      <main className="page">
        <Window title="CHECK-IN.EXE" back="/stamps">
          <p>{t('checkin.onlyCouple')}</p>
        </Window>
      </main>
    );
  }

  const locate = async () => {
    setErr(null);
    setStep({ s: 'locating' });
    let pos: GeolocationPosition;
    try {
      pos = await getPosition();
    } catch {
      setStep({ s: 'manual', note: t('checkin.denied') });
      return;
    }
    const { latitude: lat, longitude: lng } = pos.coords;
    try {
      const place = await reverseGeocode(lat, lng);
      setStep({ s: 'confirm', countryCode: place.countryCode, city: place.city ?? '', lat, lng, method: 'gps' });
    } catch {
      setStep({ s: 'manual', note: t('checkin.geoFailed') });
    }
  };

  const stampIt = async (c: Extract<Step, { s: 'confirm' }>) => {
    setErr(null);
    setStep({ s: 'stamping', countryCode: c.countryCode });
    try {
      const [result] = await Promise.all([
        api.checkIn(book.id, {
          countryCode: c.countryCode,
          city: c.city.trim() || null,
          lat: c.lat,
          lng: c.lng,
          method: c.method,
          localDate: todayLocal(),
        }),
        new Promise((r) => setTimeout(r, 650)),
      ]);
      playStampSound();
      await Promise.all([reloadStamps(), reloadMissions()]);
      setStep({ s: 'done', countryCode: c.countryCode, result });
    } catch (e) {
      setErr(errorText(e));
      setStep(c);
    }
  };

  const existing = (code: string) => stamps.find((s) => s.countryCode === code);
  const previewColor = (code: string) => existing(code)?.color ?? stampColorFor(stamps.length);

  return (
    <main className="page">
      <Window title="CHECK-IN.EXE" back="/stamps">
        {step.s === 'start' || step.s === 'locating' ? (
          <div className="checkin-start">
            <Icon name="pin" size={40} className="checkin-start__pin" />
            <h1 className="page-title">{t('checkin.title')}</h1>
            <p>{t('checkin.intro')}</p>
            {step.s === 'locating' ? (
              <div className="row center">
                <Spinner />
                <span>{t('checkin.locating')}</span>
              </div>
            ) : (
              <>
                <PixelButton className="block" onClick={locate}>
                  {t('checkin.useLocation')}
                </PixelButton>
                <button type="button" className="linkbtn" onClick={() => setStep({ s: 'manual' })}>
                  {t('checkin.pickManual')}
                </button>
              </>
            )}
          </div>
        ) : null}

        {step.s === 'manual' ? (
          <>
            {step.note ? <p className="notice">{step.note}</p> : null}
            <CountryPicker
              onPick={(code) => setStep({ s: 'confirm', countryCode: code, city: '', lat: null, lng: null, method: 'manual' })}
            />
          </>
        ) : null}

        {step.s === 'confirm' ? (
          <div className="confirm">
            <p className="px small center">{t('checkin.preview')}</p>
            <div className="confirm__stamp">
              <StampArt
                countryCode={step.countryCode}
                color={previewColor(step.countryCode)}
                isWedding={false}
                date={existing(step.countryCode)?.firstVisitAt ?? new Date().toISOString()}
              />
            </div>
            <p className="confirm__name">
              {flagEmoji(step.countryCode)} {countryName(step.countryCode, lang)}
            </p>
            {existing(step.countryCode) ? (
              <p className="notice">{t('checkin.revisit', { country: countryName(step.countryCode, lang) })}</p>
            ) : null}
            <label className="field">
              <span>{t('checkin.city')}</span>
              <input value={step.city} maxLength={60} onChange={(e) => setStep({ ...step, city: e.target.value })} />
            </label>
            {err ? <ErrorBox message={err} /> : null}
            <PixelButton className="block" onClick={() => stampIt(step)}>
              {t('checkin.stampIt')}
            </PixelButton>
            <button type="button" className="linkbtn" onClick={() => setStep({ s: 'manual' })}>
              {t('checkin.notRight')}
            </button>
          </div>
        ) : null}

        {step.s === 'stamping' || step.s === 'done' ? (
          <div className="stamping">
            <div className={`stamping__stamp ${step.s === 'done' ? 'is-down' : 'is-up'}`}>
              <StampArt
                countryCode={step.countryCode}
                color={previewColor(step.countryCode)}
                isWedding={false}
                date={existing(step.countryCode)?.firstVisitAt ?? new Date().toISOString()}
              />
            </div>
            {step.s === 'done' ? (
              <>
                <p className="stamping__label px" role="status">{t('checkin.stamped')}</p>
                {step.result.unlocked.length ? (
                  <div className="unlockedtoast">
                    <Icon name="envelope" size={22} />
                    <span>{t('checkin.unlocked')}</span>
                    <Link to="/missions" className="linkbtn">{t('checkin.readIt')}</Link>
                  </div>
                ) : null}
                <PixelButton className="block" onClick={() => nav(`/stamps/${step.result.stampId}`)}>
                  {t('checkin.viewStamp')}
                </PixelButton>
                <Link to="/stamps" className="linkbtn">{t('checkin.again')}</Link>
              </>
            ) : null}
          </div>
        ) : null}
      </Window>
    </main>
  );
}
