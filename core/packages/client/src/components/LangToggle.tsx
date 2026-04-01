/**
 * 共享语言切换按钮组件
 * NOTE: 统一所有页面的语言切换逻辑
 *
 * variant="inline" → 嵌入页面 header（推荐，行业标准）
 * variant="fixed"  → 固定右下角（仅在无法嵌入 header 时使用）
 */
import { useTranslation } from 'react-i18next';
import { syncLangToUrl } from '../i18n';
import './lang_toggle.css';

interface LangToggleProps {
  variant?: 'inline' | 'fixed';
  /** 额外的 className（叠加在 variant 基础样式上） */
  className?: string;
}

export default function LangToggle({ variant = 'inline', className }: LangToggleProps) {
  const { i18n, t } = useTranslation();
  const isZh = i18n.language === 'zh';

  const toggle = () => {
    const next = isZh ? 'en' : 'zh';
    i18n.changeLanguage(next);
    syncLangToUrl(next);
  };

  const baseClass = variant === 'fixed' ? 'lang-toggle-fixed' : 'lang-toggle-inline';
  const cls = [baseClass, className].filter(Boolean).join(' ');

  return (
    <button className={cls} onClick={toggle} title={isZh ? 'Switch to English' : '切换为中文'}>
      🌐 {t('common.langToggleLabel')}
    </button>
  );
}
