// ═══════════════════════════════════════════════════════════
// Main-process i18n — minimal translation layer
// Only the strings rendered in Electron's native UI:
//   • Splash screen  • Context menus  • Save dialogs
//   • Notifications  • Tray menu
// The React renderer uses its own i18next instance (src/i18n.ts).
// ═══════════════════════════════════════════════════════════

type SectionMap = Record<string, string>;
type LangMap    = Record<string, SectionMap>;

const translations: Record<string, LangMap> = {
  en: {
    splash: {
      loading: 'Loading...',
    },
    contextMenu: {
      openLink:  '🔗 Open Link',
      copyLink:  '📋 Copy Link',
      cut:       'Cut',
      copy:      'Copy',
      paste:     'Paste',
      selectAll: 'Select All',
    },
    dialog: {
      saveImage:  'Save Image',
      imageSaved: 'Image Saved',
    },
    tray: {
      open:  'Æ Open AEGIS',
      close: '❌ Close',
    },
  },

  zh: {
    splash: {
      loading: '加载中…',
    },
    contextMenu: {
      openLink:  '🔗 打开链接',
      copyLink:  '📋 复制链接',
      cut:       '剪切',
      copy:      '复制',
      paste:     '粘贴',
      selectAll: '全选',
    },
    dialog: {
      saveImage:  '保存图片',
      imageSaved: '图片已保存',
    },
    tray: {
      open:  'Æ 打开 OpenClaw Station',
      close: '❌ 退出',
    },
  },

  ar: {
    splash: {
      loading: 'جاري التحميل...',
    },
    contextMenu: {
      openLink:  '🔗 فتح الرابط',
      copyLink:  '📋 نسخ الرابط',
      cut:       'قص',
      copy:      'نسخ',
      paste:     'لصق',
      selectAll: 'تحديد الكل',
    },
    dialog: {
      saveImage:  'حفظ الصورة',
      imageSaved: 'تم حفظ الصورة',
    },
    tray: {
      open:  'Æ فتح OpenClaw Station',
      close: '❌ إغلاق',
    },
  },
};

let _lang = 'en';

/**
 * Initialise from the installer-language value already detected in main.ts.
 * Call this right after detectInstallerLanguage() / loadConfig().
 */
export function initI18n(
  installerLang: string | null,
  configLang?: string | null,
): void {
  // Priority: config (user-chosen in app) > installer > 'en'
  if (configLang === 'ar' || configLang === 'en' || configLang === 'zh') {
    _lang = configLang;
  } else if (installerLang === 'ar' || installerLang === 'en' || installerLang === 'zh') {
    _lang = installerLang;
  }
  console.log(`[i18n] main-process language: ${_lang}`);
}

/**
 * Update the current language at runtime.
 * Wired to the 'i18n:setLanguage' IPC channel so the renderer
 * can push language changes to native menus.
 */
export function setLanguage(lang: string): void {
  if (lang === 'ar' || lang === 'en' || lang === 'zh') {
    _lang = lang;
    console.log(`[i18n] language updated: ${_lang}`);
  }
}

/**
 * Translate a dotted key like 'contextMenu.copy'.
 * Falls back to English, then to the raw key string.
 */
export function t(key: string): string {
  const dot = key.indexOf('.');
  if (dot === -1) return key;

  const section = key.slice(0, dot);
  const subkey  = key.slice(dot + 1);

  return (
    translations[_lang]?.[section]?.[subkey] ??
    translations['en']?.[section]?.[subkey] ??
    key
  );
}
