import { useState, type FormEvent } from 'react';
import { api } from '../data/api';
import { ApiError } from '../data/types';
import { useI18n } from '../i18n';
import { isValidUsername, normalizeUsername } from '../lib/username';
import { PixelButton, Window } from '../components/ui';
import { Icon } from '../components/Icon';

export function Login() {
  const { t, errorText } = useI18n();
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    const u = normalizeUsername(username);
    if (!isValidUsername(u)) {
      setErr(t('login.badUsername'));
      return;
    }
    setBusy(true);
    try {
      await api.signIn(u);
      // The auth listener in App switches to the passport on success.
    } catch (ex) {
      setErr(ex instanceof ApiError && ex.code === 'bad_login' ? t('login.wrong') : errorText(ex));
      setBusy(false);
    }
  };

  return (
    <main className="page page--nonav">
      <Window title="LOGIN.EXE">
        <div className="login">
          <Icon name="book" size={44} className="login__icon" />
          <h1 className="page-title">{t('login.title')}</h1>
          <form onSubmit={submit}>
            <p>{t('login.intro')}</p>
            <label className="field">
              <span>{t('login.username')}</span>
              <input
                type="text"
                required
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
            {err ? <p className="field-error" role="alert">{err}</p> : null}
            <PixelButton className="block" type="submit" disabled={busy}>
              {busy ? t('login.signingIn') : t('login.signIn')}
            </PixelButton>
          </form>
        </div>
      </Window>
    </main>
  );
}
