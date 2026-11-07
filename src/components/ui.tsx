import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { useI18n } from '../i18n';

/** 90s window title bar with three coloured squares. */
export function WindowBar({ title, back, right }: { title: string; back?: string; right?: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="windowbar">
      {back ? (
        <Link to={back} className="windowbar__back" aria-label={t('common.back')}>
          <Icon name="back" size={18} />
        </Link>
      ) : null}
      <span className="windowbar__title px">{title}</span>
      {right}
      <span className="windowbar__dots" aria-hidden="true">
        <i style={{ background: 'var(--pink)' }} />
        <i style={{ background: 'var(--butter)' }} />
        <i style={{ background: 'var(--mint)' }} />
      </span>
    </div>
  );
}

export function Window({ title, back, right, children, className = '' }: {
  title: string;
  back?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`window ${className}`}>
      <WindowBar title={title} back={back} right={right} />
      <div className="window__body">{children}</div>
    </section>
  );
}

type Variant = 'red' | 'paper' | 'butter' | 'mint';

export function PixelButton({
  variant = 'red',
  arrows = true,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; arrows?: boolean }) {
  return (
    <button className={`pixbtn pixbtn--${variant} ${className}`} {...rest}>
      <span>{children}</span>
      {arrows ? <span className="px pixbtn__arrows" aria-hidden="true">&gt;&gt;</span> : null}
    </button>
  );
}

export function LangToggle() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="langtoggle" role="group" aria-label={t('common.language')}>
      {(['th', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          className={lang === l ? 'is-active' : ''}
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
          lang={l}
        >
          {l === 'th' ? 'ไทย' : 'EN'}
        </button>
      ))}
    </div>
  );
}

/** Circular rubber-stamp postmark with text around the edge. */
export function Postmark({ top, center, bottom, size = 110, rotate = -12, className = '' }: {
  top: string;
  center: string;
  bottom?: string;
  size?: number;
  rotate?: number;
  className?: string;
}) {
  const id = `pm-${top.replace(/\W/g, '')}-${size}`;
  return (
    <svg
      className={`postmark ${className}`}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      style={{ transform: `rotate(${rotate}deg)` }}
      role="img"
      aria-label={[top, center, bottom].filter(Boolean).join(' · ')}
    >
      <defs>
        <path id={`${id}-t`} d="M 16 60 A 44 44 0 0 1 104 60" />
        <path id={`${id}-b`} d="M 16 60 A 44 44 0 0 0 104 60" />
      </defs>
      <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth="4" />
      <circle cx="60" cy="60" r="37" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
      <text className="postmark__ring" fill="currentColor">
        <textPath href={`#${id}-t`} startOffset="50%" textAnchor="middle">{top}</textPath>
      </text>
      {bottom ? (
        <text className="postmark__ring" fill="currentColor">
          <textPath href={`#${id}-b`} startOffset="50%" textAnchor="middle" dominantBaseline="hanging">{bottom}</textPath>
        </text>
      ) : null}
      <text x="60" y="66" textAnchor="middle" className="postmark__center" fill="currentColor">{center}</text>
    </svg>
  );
}

export function ProgressBar({ value, max, color = 'var(--red)' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className="progress__fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="spinner" role="status">
      <span className="spinner__dot" />
      <span className="spinner__dot" />
      <span className="spinner__dot" />
      <span className="sr-only">{label ?? t('common.loading')}</span>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="errorbox" role="alert">
      <p>{message}</p>
      {onRetry ? (
        <button type="button" className="linkbtn" onClick={onRetry}>
          {t('common.retry')}
        </button>
      ) : null}
    </div>
  );
}
