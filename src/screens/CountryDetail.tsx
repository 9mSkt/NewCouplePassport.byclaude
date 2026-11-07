import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBook } from '../state/BookContext';
import { useI18n } from '../i18n';
import { api } from '../data/api';
import { PHOTO_LIMIT, type Photo } from '../data/types';
import { processImage } from '../lib/image';
import { countryName } from '../lib/countries';
import { dateRange } from '../lib/format';
import { ErrorBox, Postmark, Spinner, Window } from '../components/ui';
import { Icon } from '../components/Icon';

const TILTS = [-3, 2, -1.5, 3, -2];

function Polaroid({ photo, index, onOpen }: { photo: Photo; index: number; onOpen(): void }) {
  const { t } = useI18n();
  return (
    <button type="button" className="polaroid" style={{ transform: `rotate(${TILTS[index % TILTS.length]}deg)` }} onClick={onOpen}>
      <span className="polaroid__img">
        {photo.url ? <img src={photo.url} alt={photo.caption || t('detail.photos')} loading="lazy" /> : null}
      </span>
      <span className="polaroid__caption handwrite">{photo.caption || ' '}</span>
    </button>
  );
}

function PhotoViewer({ photo, canEdit, onClose, onChanged }: {
  photo: Photo;
  canEdit: boolean;
  onClose(): void;
  onChanged(): void;
}) {
  const { t, errorText } = useI18n();
  const [caption, setCaption] = useState(photo.caption);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => closeRef.current?.focus(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = async () => {
    setBusy(true);
    try {
      await api.updateCaption(photo.id, caption.trim());
      onChanged();
      onClose();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const del = async () => {
    if (!window.confirm(t('detail.confirmDeletePhoto'))) return;
    setBusy(true);
    try {
      await api.deletePhoto(photo);
      onChanged();
      onClose();
    } catch (e) {
      setErr(errorText(e));
      setBusy(false);
    }
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={t('detail.photos')} onClick={onClose}>
      <div className="modal__card" onClick={(e) => e.stopPropagation()}>
        <button ref={closeRef} type="button" className="iconbtn modal__close" onClick={onClose} aria-label={t('detail.close')}>
          <Icon name="close" />
        </button>
        <img className="modal__img" src={photo.url} alt={photo.caption || t('detail.photos')} />
        {canEdit ? (
          <>
            <label className="field">
              <span>{t('detail.caption')}</span>
              <input value={caption} maxLength={80} placeholder={t('detail.captionPlaceholder')} onChange={(e) => setCaption(e.target.value)} />
            </label>
            {err ? <p className="field-error">{err}</p> : null}
            <div className="row">
              <button type="button" className="pixbtn pixbtn--paper small" onClick={del} disabled={busy}>
                <Icon name="trash" size={16} /> <span>{t('detail.deletePhoto')}</span>
              </button>
              <button type="button" className="pixbtn pixbtn--red small" onClick={save} disabled={busy}>
                <span>{t('detail.save')}</span>
              </button>
            </div>
          </>
        ) : (
          <p className="handwrite">{photo.caption}</p>
        )}
      </div>
    </div>
  );
}

export function CountryDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { book, role, stamps, reloadStamps } = useBook();
  const { t, lang, errorText } = useI18n();
  const stamp = stamps.find((s) => s.id === id);
  const isCouple = role === 'couple';

  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState<Photo | null>(null);
  const [memo, setMemo] = useState('');
  const [memoState, setMemoState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const fileRef = useRef<HTMLInputElement>(null);

  const loadPhotos = useCallback(async () => {
    if (!id) return;
    try {
      setPhotos(await api.listPhotos(book.id, id));
    } catch (e) {
      setErr(errorText(e));
      setPhotos([]);
    }
  }, [book.id, id, errorText]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);
  useEffect(() => {
    setMemo(stamp?.memo ?? '');
  }, [stamp?.id, stamp?.memo]);

  if (!stamp) {
    return (
      <main className="page">
        <Window title="404.EXE" back="/stamps">
          {stamps.length ? <p>{t('detail.notFound')}</p> : <Spinner />}
        </Window>
      </main>
    );
  }

  const nameEn = stamp.isWedding ? 'WEDDING' : countryName(stamp.countryCode, 'en').toUpperCase();
  const nameLocal = countryName(stamp.countryCode, lang);
  const cities = [...new Set(stamp.visits.map((v) => v.city).filter(Boolean))] as string[];
  const dates = stamp.isWedding ? [book.weddingDate] : stamp.visits.map((v) => v.localDate);
  const count = photos?.length ?? stamp.photoCount;
  const full = count >= PHOTO_LIMIT;
  const exe = `${(stamp.isWedding ? 'WEDDING' : countryName(stamp.countryCode, 'en')).toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 14)}.EXE`;

  const onPick = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr(null);
    setUploading(true);
    try {
      const room = PHOTO_LIMIT - count;
      for (const f of Array.from(files).slice(0, room)) {
        const img = await processImage(f);
        await api.addPhoto(book.id, stamp.id, img, '');
      }
      if (files.length > room) setErr(t('error.photoLimit'));
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
      await loadPhotos();
      reloadStamps();
    }
  };

  const saveMemo = async () => {
    setMemoState('saving');
    try {
      await api.updateMemo(stamp.id, memo.trim());
      await reloadStamps();
      setMemoState('saved');
      setTimeout(() => setMemoState('idle'), 1800);
    } catch (e) {
      setErr(errorText(e));
      setMemoState('idle');
    }
  };

  const removeStamp = async () => {
    if (!window.confirm(t('detail.confirmDeleteStamp', { country: nameLocal }))) return;
    try {
      await api.deleteStamp(book.id, stamp.id);
      await reloadStamps();
      nav('/stamps');
    } catch (e) {
      setErr(errorText(e));
    }
  };

  return (
    <main className="page">
      <Window title={exe} back="/stamps">
        <div className="hero" style={{ background: `var(--${stamp.color})` }}>
          <h1 className="hero__name px">{nameEn}</h1>
          <p className="hero__sub">
            {stamp.isWedding ? `${nameLocal} · ${book.weddingPlace}` : [nameLocal, ...cities].join(' · ')}
          </p>
          <p className="hero__dates">
            <Icon name="pin" size={16} /> <span className="typewriter">{dateRange(dates)}</span>
            {!stamp.isWedding ? <span className="hero__visits">{t('detail.visits', { n: stamp.visits.length })}</span> : null}
          </p>
          <Postmark
            className="hero__postmark"
            top={stamp.isWedding ? 'JUST MARRIED' : 'CHECKED IN'}
            center={stamp.countryCode}
            bottom={dateRange(dates.slice(0, 1))}
            size={86}
            rotate={14}
          />
          {stamp.isWedding ? <p className="hero__caption handwrite">{t('detail.weddingCaption')}</p> : null}
        </div>
      </Window>

      <section className="card">
        <header className="card__head">
          <h2>
            <Icon name="camera" size={18} /> {t('detail.photos')}
          </h2>
          <span className="badge px">
            {count} / {PHOTO_LIMIT}
          </span>
        </header>
        {!isCouple ? (
          <p className="muted">{t('detail.issuerNoPhotos')}</p>
        ) : photos === null ? (
          <Spinner />
        ) : (
          <div className="polaroids">
            {photos.map((p, i) => (
              <Polaroid key={p.id} photo={p} index={i} onOpen={() => setViewing(p)} />
            ))}
            {!full ? (
              <button type="button" className="addphoto" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? (
                  <>
                    <Spinner />
                    <span>{t('detail.uploading')}</span>
                  </>
                ) : (
                  <span>{t('detail.addPhoto')}</span>
                )}
              </button>
            ) : null}
          </div>
        )}
        {isCouple && full ? <p className="muted">{t('detail.full')}</p> : null}
        {err ? <ErrorBox message={err} /> : null}
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onPick(e.target.files)} />
        <p className="hint">{t('detail.hint')}</p>
      </section>

      <section className="card memo">
        <header className="card__head">
          <h2>
            <span className="px">MEMO</span> · {t('detail.memo')}
          </h2>
        </header>
        {isCouple ? (
          <>
            <textarea
              className="memo__text handwrite"
              value={memo}
              maxLength={500}
              rows={4}
              placeholder={t('detail.memoPlaceholder')}
              aria-label={t('detail.memo')}
              onChange={(e) => setMemo(e.target.value)}
            />
            <div className="row end">
              <button
                type="button"
                className="pixbtn pixbtn--butter small"
                onClick={saveMemo}
                disabled={memoState === 'saving' || memo.trim() === (stamp.memo ?? '')}
              >
                <span>{memoState === 'saved' ? t('detail.saved') : t('detail.save')}</span>
              </button>
            </div>
          </>
        ) : (
          <p className="memo__text handwrite">{stamp.memo || '—'}</p>
        )}
      </section>

      {isCouple && !stamp.isWedding ? (
        <button type="button" className="linkbtn danger" onClick={removeStamp}>
          {t('detail.deleteStamp')}
        </button>
      ) : null}

      {viewing ? (
        <PhotoViewer photo={viewing} canEdit={isCouple} onClose={() => setViewing(null)} onChanged={() => { loadPhotos(); reloadStamps(); }} />
      ) : null}
    </main>
  );
}
