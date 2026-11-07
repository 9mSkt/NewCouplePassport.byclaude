import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import en from './en.json';
import th from './th.json';
import { ApiError } from '../data/types';

export type Lang = 'th' | 'en';
export type MsgKey = keyof typeof en;

const DICTS: Record<Lang, Record<string, string>> = { en, th };
const STORAGE_KEY = 'cp.lang';

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'th' || saved === 'en') return saved;
  } catch {
    /* ignore */
  }
  return navigator.language?.toLowerCase().startsWith('th') ? 'th' : 'en';
}

interface I18n {
  lang: Lang;
  setLang(l: Lang): void;
  t(key: MsgKey, vars?: Record<string, string | number>): string;
  /** Pick the right language field from user/issuer content with TH/EN variants */
  pick(th: string, en: string): string;
  errorText(e: unknown): string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<I18n>(() => {
    const t: I18n['t'] = (key, vars) => {
      let s = DICTS[lang][key] ?? DICTS.en[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
      return s;
    };
    return {
      lang,
      setLang,
      t,
      pick: (thText, enText) => (lang === 'th' ? thText || enText : enText || thText),
      errorText(e) {
        if (e instanceof ApiError) {
          if (e.code === 'photo_limit') return t('error.photoLimit');
          if (e.code === 'not_allowed') return t('error.notAllowed');
          if (e.code === 'network') return t('error.network');
          if (e.code === 'unsupported_image') return t('error.unsupportedImage');
        }
        return t('error.generic', { msg: e instanceof Error ? e.message : String(e) });
      },
    };
  }, [lang, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside provider');
  return v;
}
