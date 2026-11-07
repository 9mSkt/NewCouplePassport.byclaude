import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api } from './data/api';
import { demoRole, resetDemo, setDemoRole } from './data/demoApi';
import type { Book, Role, Session } from './data/types';
import { useI18n } from './i18n';
import { BookProvider, useBook } from './state/BookContext';
import { LangToggle, Spinner, ErrorBox } from './components/ui';
import { NavBar } from './components/NavBar';
import { Icon } from './components/Icon';
import { Cover } from './screens/Cover';
import { DataPage } from './screens/DataPage';
import { StampBook } from './screens/StampBook';
import { CountryDetail } from './screens/CountryDetail';
import { CheckIn } from './screens/CheckIn';
import { Missions } from './screens/Missions';
import { MapPage } from './screens/MapPage';
import { Issuer } from './screens/Issuer';
import { Login } from './screens/Login';
import { NotYours } from './screens/NotYours';

type Gate =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'signedOut' }
  | { state: 'noBook'; session: Session }
  | { state: 'ready'; session: Session; book: Book; role: Role };

export default function App() {
  return (
    <BrowserRouter>
      <AuthGate />
    </BrowserRouter>
  );
}

function AuthGate() {
  const { errorText } = useI18n();
  const [gate, setGate] = useState<Gate>({ state: 'loading' });

  const resolve = useCallback(
    async (session: Session | null) => {
      if (!session) return setGate({ state: 'signedOut' });
      try {
        const r = await api.loadBook();
        setGate(r ? { state: 'ready', session, ...r } : { state: 'noBook', session });
      } catch (e) {
        setGate({ state: 'error', message: errorText(e) });
      }
    },
    [errorText],
  );

  useEffect(() => {
    let lastUser: string | null | undefined;
    api.getSession().then((s) => {
      lastUser = s?.userId ?? null;
      resolve(s);
    });
    return api.onAuthChange((s) => {
      const id = s?.userId ?? null;
      if (id === lastUser) return; // ignore token refreshes
      lastUser = id;
      resolve(s);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (gate.state === 'loading')
    return (
      <Phone>
        <div className="center-screen">
          <Spinner />
        </div>
      </Phone>
    );
  if (gate.state === 'error')
    return (
      <Phone>
        <TopBar />
        <main className="page">
          <ErrorBox message={gate.message} onRetry={() => window.location.reload()} />
        </main>
      </Phone>
    );
  if (gate.state === 'signedOut')
    return (
      <Phone>
        <TopBar />
        <Login />
      </Phone>
    );
  if (gate.state === 'noBook')
    return (
      <Phone>
        <TopBar signedIn />
        <NotYours email={gate.session.email ?? ''} />
      </Phone>
    );

  return (
    <BookProvider key={gate.book.id + gate.role} book={gate.book} role={gate.role}>
      <Phone>
        <ReadyRoutes />
      </Phone>
    </BookProvider>
  );
}

function ReadyRoutes() {
  const loc = useLocation();
  const isCover = loc.pathname === '/';
  return (
    <>
      {isCover ? null : <TopBar signedIn inBook />}
      <Routes>
        <Route path="/" element={<Cover />} />
        <Route path="/book" element={<DataPage />} />
        <Route path="/stamps" element={<StampBook />} />
        <Route path="/stamps/:id" element={<CountryDetail />} />
        <Route path="/check-in" element={<CheckIn />} />
        <Route path="/missions" element={<Missions />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/issuer" element={<IssuerOnly><Issuer /></IssuerOnly>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {isCover ? null : <NavBar />}
    </>
  );
}

function IssuerOnly({ children }: { children: ReactNode }) {
  const { role } = useBook();
  return role === 'issuer' ? <>{children}</> : <Navigate to="/book" replace />;
}

function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="phone">
      {api.mode === 'demo' ? <DemoBanner /> : null}
      {children}
    </div>
  );
}

function TopBar({ signedIn = false, inBook = false }: { signedIn?: boolean; inBook?: boolean }) {
  const { t } = useI18n();
  return (
    <header className="topbar">
      <Link to="/" className="topbar__brand px" aria-label="Couple Passport">
        <Icon name="heart" size={16} /> PASSPORT
      </Link>
      <div className="topbar__right">
        {inBook ? <IssuerLink /> : null}
        <LangToggle />
        {signedIn && api.mode === 'supabase' ? (
          <button type="button" className="iconbtn" onClick={() => api.signOut()} aria-label={t('common.signOut')} title={t('common.signOut')}>
            <Icon name="logout" size={18} />
          </button>
        ) : null}
      </div>
    </header>
  );
}

function IssuerLink() {
  const { t } = useI18n();
  const { role } = useBook();
  if (role !== 'issuer') return null;
  return (
    <Link to="/issuer" className="chip">
      <Icon name="envelope" size={14} /> {t('nav.issuer')}
    </Link>
  );
}

function DemoBanner() {
  const { t } = useI18n();
  const role = demoRole();
  const switchRole = (r: Role) => {
    setDemoRole(r);
    window.location.assign(r === 'issuer' ? '/issuer' : '/book');
  };
  const reset = async (sample: boolean) => {
    if (!window.confirm(t('demo.confirmReset'))) return;
    await resetDemo(sample);
    window.location.assign('/');
  };
  return (
    <div className="demobanner">
      <span>{t('demo.banner')}</span>
      <span className="demobanner__actions">
        <label>
          {t('demo.viewAs')}{' '}
          <select value={role} onChange={(e) => switchRole(e.target.value as Role)}>
            <option value="couple">{t('demo.couple')}</option>
            <option value="issuer">{t('demo.issuer')}</option>
          </select>
        </label>
        <button type="button" className="linkbtn" onClick={() => reset(true)}>{t('demo.reset')}</button>
        <button type="button" className="linkbtn" onClick={() => reset(false)}>{t('demo.empty')}</button>
      </span>
    </div>
  );
}
