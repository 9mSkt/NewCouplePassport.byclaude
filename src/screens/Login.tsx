import { useState, type FormEvent } from 'react';
import { api } from '../data/api';
import { useI18n } from '../i18n';
import { PixelButton, Window } from '../components/ui';
import { Icon } from '../components/Icon';

export function Login() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setState('sending');
    try {
      await api.signIn(email.trim());
      setState('sent');
    } catch (ex) {
      setErr(t('login.error', { msg: ex instanceof Error ? ex.message : String(ex) }));
      setState('idle');
    }
  };

  return (
    <main className="page page--nonav">
      <Window title="LOGIN.EXE">
        <div className="login">
          <Icon name="book" size={44} className="login__icon" />
          <h1 className="page-title">{t('login.title')}</h1>
          {state === 'sent' ? (
            <p className="notice" role="status">{t('login.sent')}</p>
          ) : (
            <form onSubmit={submit}>
              <p>{t('login.intro')}</p>
              <label className="field">
                <span>{t('login.email')}</span>
                <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              {err ? <p className="field-error">{err}</p> : null}
              <PixelButton className="block" type="submit" disabled={state === 'sending'}>
                {state === 'sending' ? t('login.sending') : t('login.send')}
              </PixelButton>
            </form>
          )}
        </div>
      </Window>
    </main>
  );
}
