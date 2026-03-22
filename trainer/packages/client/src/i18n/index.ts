import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zh from './zh.json';
import en from './en.json';

// NOTE: 语言检测优先级：URL ?lang= > localStorage > 浏览器语言
function detectLanguage(): string {
  const params = new URLSearchParams(window.location.search);
  const urlLang = params.get('lang');
  if (urlLang && ['zh', 'en'].includes(urlLang)) return urlLang;

  const stored = localStorage.getItem('trainer-lang');
  if (stored && ['zh', 'en'].includes(stored)) return stored;

  return navigator.language.startsWith('zh') ? 'zh' : 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    en: { translation: en },
  },
  lng: detectLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
