import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from './locales/ar.json';
import en from './locales/en.json';

// ═══════════════════════════════════════════════════════════
// i18n — Internationalization (Arabic + English)
// ═══════════════════════════════════════════════════════════

// Detect language priority:
//   1. New install/upgrade: installer language wins (user chose it in setup wizard)
//   2. Normal run: localStorage wins (user may have changed it in Settings)
//   3. First run (dev/no installer): system language
//   4. Fallback: 'en'
const getInitialLang = (): string => {
  const stored = localStorage.getItem('aegis-language');
  const installerLang = (window as any).aegis?.installerLanguage as string | null;
  const currentVersion = (window as any).__APP_VERSION__ || '';
  const lastVersion = localStorage.getItem('aegis-installed-version');

  // New install or upgrade: installer language takes priority
  // (The NSIS wizard asks the user every time — respect that choice)
  if (installerLang && (installerLang === 'ar' || installerLang === 'en') && lastVersion !== currentVersion) {
    localStorage.setItem('aegis-language', installerLang);
    localStorage.setItem('aegis-installed-version', currentVersion);
    return installerLang;
  }

  // Normal run: use saved preference
  if (stored === 'ar' || stored === 'en') {
    // Sync version marker if missing
    if (!lastVersion && currentVersion) localStorage.setItem('aegis-installed-version', currentVersion);
    return stored;
  }

  // Default: English (user can switch to Arabic from Settings)
  localStorage.setItem('aegis-language', 'en');
  if (currentVersion) localStorage.setItem('aegis-installed-version', currentVersion);
  return 'en';
};

const savedLang = getInitialLang();

i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: ar },
    en: { translation: en },
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
  document.documentElement.lang = lang;
};

// Set initial direction
document.documentElement.dir = getDirection(savedLang);
document.documentElement.lang = savedLang;

export default i18n;
