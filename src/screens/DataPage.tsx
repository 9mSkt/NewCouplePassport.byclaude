import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBook } from '../state/BookContext';
import { useI18n } from '../i18n';
import { api } from '../data/api';
import { processImage } from '../lib/image';
import { makeMrz } from '../lib/mrz';
import { passportDate, dottedDate } from '../lib/format';
import { Postmark, Spinner, Window } from '../components/ui';
import { Icon } from '../components/Icon';

function PortraitSlot({ slot, name, url, canEdit }: { slot: 'a' | 'b'; name: string; url: string | null; canEdit: boolean }) {
  const { book, reloadBook } = useBook();
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { errorText } = useI18n();

  const onPick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setErr(null);
    try {
      const img = await processImage(f, 900);
      await api.setBookPhoto(book.id, slot, img);
      await reloadBook();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const label = t('data.photoOf', { name });
  const inner = url ? (
    <img src={url} alt={label} />
  ) : (
    <span className="portrait__empty">
      <Icon name="camera" size={22} />
      <span>{canEdit ? t('data.addPhoto') : name}</span>
    </span>
  );

  return (
    <div className="portrait">
      {canEdit ? (
        <button type="button" className="portrait__frame" onClick={() => input.current?.click()} aria-label={label} disabled={busy}>
          {busy ? <Spinner /> : inner}
        </button>
      ) : (
        <div className="portrait__frame">{inner}</div>
      )}
      <span className="portrait__name px">{name}</span>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => onPick(e.target.files?.[0])} />
      {err ? <p className="field-error">{err}</p> : null}
    </div>
  );
}

export function DataPage() {
  const { book, role } = useBook();
  const { t } = useI18n();
  const [l1, l2] = makeMrz({
    nameA: book.partnerAName,
    nameB: book.partnerBName,
    date: book.weddingDate,
    bookId: book.id,
    country: book.weddingCountry,
  });
  const isCouple = role === 'couple';

  return (
    <main className="page">
      <Window title="PAGE 01 — DATA PAGE">
        <div className="datapage">
          <div className="datapage__portraits">
            <PortraitSlot slot="a" name={book.partnerAName} url={book.partnerAPhoto} canEdit={isCouple} />
            <Icon name="heart" size={26} className="datapage__heart" />
            <PortraitSlot slot="b" name={book.partnerBName} url={book.partnerBPhoto} canEdit={isCouple} />
          </div>

          <dl className="datafields">
            <div>
              <dt><span className="px">NAME</span> · {t('data.name')}</dt>
              <dd className="typewriter">{book.partnerAName} &amp; {book.partnerBName}</dd>
            </div>
            <div>
              <dt><span className="px">DATE OF ISSUE</span> · {t('data.dateOfIssue')}</dt>
              <dd className="typewriter">{passportDate(book.weddingDate)}</dd>
            </div>
            <div>
              <dt><span className="px">PLACE</span> · {t('data.place')}</dt>
              <dd className="typewriter">{book.weddingPlace.toUpperCase()}, {book.weddingCountry}</dd>
            </div>
            <div>
              <dt><span className="px">ISSUED BY</span> · {t('data.issuedBy')}</dt>
              <dd className="handwrite">{book.issuedBy}</dd>
            </div>
          </dl>

          <Postmark
            className="datapage__postmark"
            top="JUST MARRIED"
            center="♥"
            bottom={dottedDate(book.weddingDate)}
            size={104}
            rotate={-14}
          />

          <div className="mrz" aria-hidden="true">
            <div>{l1}</div>
            <div>{l2}</div>
          </div>
        </div>
      </Window>

      {book.issuerNote ? (
        <aside className="sticky">
          <p>{book.issuerNote}</p>
          <p className="sticky__from">{t('data.noteFrom', { issuer: book.issuedBy })}</p>
          {role === 'issuer' ? (
            <Link to="/issuer" className="linkbtn">{t('data.editNote')}</Link>
          ) : null}
        </aside>
      ) : role === 'issuer' ? (
        <Link to="/issuer" className="linkbtn">{t('data.editNote')}</Link>
      ) : null}
    </main>
  );
}
