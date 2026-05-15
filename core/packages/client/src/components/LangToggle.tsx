/**
 * 共享语言切换 — "中文 | English" 裸文字。当前 lang 高亮,点击切到另一个。
 * variant='inline'(默认)跟随 layout 流;'fixed' 固定右下角(降级)
 */
import { useTranslation } from 'react-i18next';
import { syncLangToUrl } from '../i18n';
import './lang_toggle.css';

interface LangToggleProps {
  variant?: 'inline' | 'fixed';
  className?: string;
}

export default function LangToggle({ variant = 'inline', className }: LangToggleProps) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  const toggle = () => {
    const next = isZh ? 'en' : 'zh';
    i18n.changeLanguage(next);
    syncLangToUrl(next);
  };

  const cls = [
    'lang-toggle',
    variant === 'fixed' ? 'lang-toggle--fixed' : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={cls}
      onClick={toggle}
      title={isZh ? 'Switch to English' : '切换为中文'}
      aria-label={isZh ? 'Switch to English' : '切换为中文'}
    >
      {isZh ? '中文' : 'EN'}
    </button>
  );
}
