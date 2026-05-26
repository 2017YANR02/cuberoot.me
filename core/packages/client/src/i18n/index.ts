import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zh from './zh.json';
import en from './en.json';

// NOTE: 语言检测优先级：URL ?lang= > localStorage > 浏览器语言
// 与 Legacy i18n.js init() 完全对齐
function detectLanguage(): string {
  const params = new URLSearchParams(window.location.search);
  const urlLang = params.get('lang');
  if (urlLang && ['zh', 'en'].includes(urlLang)) return urlLang;

  const stored = localStorage.getItem('trainer-lang');
  if (stored && ['zh', 'en'].includes(stored)) return stored;

  return navigator.language.startsWith('zh') ? 'zh' : 'en';
}

const detectedLang = detectLanguage();

// NOTE: 初始化时如果 URL 没有 ?lang=，自动追加（对标 Legacy i18n.js L453-461）
// 使用 replaceState 不产生历史条目
const initParams = new URLSearchParams(window.location.search);
if (!initParams.get('lang')) {
  initParams.set('lang', detectedLang);
  // Collapse leading multi-slashes so newUrl never starts with `//` (which is
  // a scheme-relative URL — replaceState would parse the next segment as host
  // and throw SecurityError; reproduced when user lands on `//wca/...`).
  const safePath = window.location.pathname.replace(/^\/+/, '/');
  const newUrl = `${safePath}?${initParams.toString()}${window.location.hash}`;
  history.replaceState(null, '', newUrl);
}

// NOTE: 同步到 localStorage
localStorage.setItem('trainer-lang', detectedLang);

// 同步 <html lang>,index.html 里写死 'en' — zh 用户原本不会更新。
document.documentElement.lang = detectedLang;

i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    en: { translation: en },
  },
  lng: detectedLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

// NOTE: 切换语言时同步 URL（对标 Legacy i18n.js setLocale L704-722）
export function syncLangToUrl(lang: string): void {
  localStorage.setItem('trainer-lang', lang);
  document.documentElement.lang = lang;
  const url = new URL(window.location.href);
  url.searchParams.set('lang', lang);
  history.replaceState(null, '', url.toString());
}

// NOTE: 获取当前 ?lang= 查询串，供 <Link> 使用
// 返回 "?lang=zh" 或 "?lang=en"
export function getLangQuery(): string {
  const params = new URLSearchParams(window.location.search);
  return `?lang=${params.get('lang') || i18n.language || 'en'}`;
}

export default i18n;
