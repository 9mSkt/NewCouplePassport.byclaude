import { api } from '../data/api';
import { useI18n } from '../i18n';
import { PixelButton, Window } from '../components/ui';
import { Icon } from '../components/Icon';

export function NotYours({ email }: { email: string }) {
  const { t } = useI18n();
  return (
    <main className="page page--nonav">
      <Window title="ACCESS_DENIED.EXE">
        <div className="login">
          <Icon name="lock" size={44} className="login__icon" />
          <h1 className="page-title">{t('notyours.title')}</h1>
          <p>{t('notyours.body', { email })}</p>
          <PixelButton variant="paper" arrows={false} className="block" onClick={() => api.signOut()}>
            {t('common.signOut')}
          </PixelButton>
        </div>
      </Window>
    </main>
  );
}
