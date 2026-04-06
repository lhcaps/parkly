import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import vi from './locales/vi.json'

export const LOCALE_STORAGE_KEY = 'parkly-locale'

export const SUPPORTED_LOCALES = ['vi', 'en'] as const
export type AppLocale = (typeof SUPPORTED_LOCALES)[number]

function readStoredLocale(): AppLocale {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY)?.trim().toLowerCase()
    if (raw === 'en' || raw === 'vi') return raw
  } catch {
    /* ignore */
  }
  return 'vi'
}

function applyDocumentLang(lng: string) {
  document.documentElement.lang = lng === 'en' ? 'en' : 'vi'
}

i18n.use(initReactI18next).init({
  resources: {
    vi: { translation: vi },
    en: { translation: en },
  },
  lng: readStoredLocale(),
  fallbackLng: 'vi',
  showSupportNotice: false,
  interpolation: { escapeValue: false },
})

applyDocumentLang(i18n.language)

i18n.on('languageChanged', (lng) => {
  applyDocumentLang(lng)
})

export function setAppLocale(next: AppLocale) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, next)
  } catch {
    /* ignore */
  }
  void i18n.changeLanguage(next)
}

export default i18n
