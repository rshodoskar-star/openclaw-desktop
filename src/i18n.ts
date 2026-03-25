import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from './locales/ar.json';
import en from './locales/en.json';
import zh from './locales/zh.json';

// ═══════════════════════════════════════════════════════════
// i18n — Internationalization (Arabic + English + Chinese)
// ═══════════════════════════════════════════════════════════

const APP_LANGS = new Set(['ar', 'en', 'zh']);

function isAppLang(s: string | null | undefined): s is 'ar' | 'en' | 'zh' {
  return s !== undefined && s !== null && APP_LANGS.has(s);
}

// Detect language priority:
//   1. New install/upgrade: installer language wins (user chose it in setup wizard)
//   2. Normal run: localStorage wins (user may have changed it in Settings)
//   3. First run (dev/no installer): system language (zh / ar → match, else en)
//   4. Fallback: 'en'
const getInitialLang = (): string => {
  const stored = localStorage.getItem('aegis-language');
  const installerLang = window.aegis?.installerLanguage ?? null;
  const currentVersion = (window as any).__APP_VERSION__ || '';
  const lastVersion = localStorage.getItem('aegis-installed-version');

  // New install or upgrade: installer language takes priority
  // (The NSIS wizard asks the user every time — respect that choice)
  if (isAppLang(installerLang) && lastVersion !== currentVersion) {
    localStorage.setItem('aegis-language', installerLang);
    localStorage.setItem('aegis-installed-version', currentVersion);
    return installerLang;
  }

  // Normal run: use saved preference
  if (isAppLang(stored)) {
    // Sync version marker if missing
    if (!lastVersion && currentVersion) localStorage.setItem('aegis-installed-version', currentVersion);
    return stored;
  }

  // First run: system / browser language
  const sysLang = navigator.language || navigator.languages?.[0] || '';
  if (sysLang.startsWith('zh')) {
    localStorage.setItem('aegis-language', 'zh');
    if (currentVersion) localStorage.setItem('aegis-installed-version', currentVersion);
    return 'zh';
  }
  if (sysLang.startsWith('ar')) {
    localStorage.setItem('aegis-language', 'ar');
    if (currentVersion) localStorage.setItem('aegis-installed-version', currentVersion);
    return 'ar';
  }

  // Default: English (user can switch from Settings)
  localStorage.setItem('aegis-language', 'en');
  if (currentVersion) localStorage.setItem('aegis-installed-version', currentVersion);
  return 'en';
};

const savedLang = getInitialLang();

i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: ar },
    en: { translation: en },
    zh: { translation: zh },
  },
  lng: savedLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

// Helper: get direction for current language
export const getDirection = (lang?: string): 'rtl' | 'ltr' => {
  return (lang || i18n.language) === 'ar' ? 'rtl' : 'ltr';
};

// Helper: change language and persist
export const changeLanguage = (lang: string) => {
  i18n.changeLanguage(lang);
  localStorage.setItem('aegis-language', lang);
  document.documentElement.dir = getDirection(lang);
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang;
  try {
    window.aegis?.i18n?.setLanguage?.(lang);
  } catch {
    /* preload unavailable (e.g. web build) */
  }
};

// Set initial direction
document.documentElement.dir = getDirection(savedLang);
document.documentElement.lang = savedLang === 'zh' ? 'zh-CN' : savedLang;

export default i18n;
