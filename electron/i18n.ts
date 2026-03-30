type NativeLanguage = 'ar' | 'en' | 'es' | 'zh';
type SectionMap = Record<string, string>;
type LangMap = Record<string, SectionMap>;

const translations: Record<NativeLanguage, LangMap> = {
  en: {
    splash: {
      loading: 'Loading...',
    },
    contextMenu: {
      openLink: 'Open Link',
      copyLink: 'Copy Link',
      cut: 'Cut',
      copy: 'Copy',
      paste: 'Paste',
      selectAll: 'Select All',
    },
    dialog: {
      saveImage: 'Save Image',
      imageSaved: 'Image Saved',
    },
    tray: {
      open: 'Open AEGIS',
      close: 'Close',
    },
  },
  ar: {
    splash: {
      loading: 'جاري التحميل...',
    },
    contextMenu: {
      openLink: 'فتح الرابط',
      copyLink: 'نسخ الرابط',
      cut: 'قص',
      copy: 'نسخ',
      paste: 'لصق',
      selectAll: 'تحديد الكل',
    },
    dialog: {
      saveImage: 'حفظ الصورة',
      imageSaved: 'تم حفظ الصورة',
    },
    tray: {
      open: 'فتح AEGIS',
      close: 'إغلاق',
    },
  },
  zh: {
    splash: {
      loading: '正在加载...',
    },
    contextMenu: {
      openLink: '打开链接',
      copyLink: '复制链接',
      cut: '剪切',
      copy: '复制',
      paste: '粘贴',
      selectAll: '全选',
    },
    dialog: {
      saveImage: '保存图片',
      imageSaved: '图片已保存',
    },
    tray: {
      open: '打开 AEGIS',
      close: '退出',
    },
  },
  es: {
    splash: {
      loading: 'Cargando...',
    },
    contextMenu: {
      openLink: 'Abrir enlace',
      copyLink: 'Copiar enlace',
      cut: 'Cortar',
      copy: 'Copiar',
      paste: 'Pegar',
      selectAll: 'Seleccionar todo',
    },
    dialog: {
      saveImage: 'Guardar imagen',
      imageSaved: 'Imagen guardada',
    },
    tray: {
      open: 'Abrir AEGIS',
      close: 'Cerrar',
    },
  },
};

let currentLanguage: NativeLanguage = 'en';

function isNativeLanguage(lang: unknown): lang is NativeLanguage {
  return lang === 'ar' || lang === 'en' || lang === 'es' || lang === 'zh';
}

export function initI18n(installerLang: string | null, configLang?: string | null): void {
  if (isNativeLanguage(configLang)) {
    currentLanguage = configLang;
  } else if (isNativeLanguage(installerLang)) {
    currentLanguage = installerLang;
  }
}

export function setLanguage(lang: string): void {
  if (isNativeLanguage(lang)) {
    currentLanguage = lang;
  }
}

export function t(key: string): string {
  const dotIndex = key.indexOf('.');
  if (dotIndex === -1) return key;

  const section = key.slice(0, dotIndex);
  const subkey = key.slice(dotIndex + 1);

  return (
    translations[currentLanguage]?.[section]?.[subkey] ??
    translations.en?.[section]?.[subkey] ??
    key
  );
}
