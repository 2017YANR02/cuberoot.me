/**
 * 共享语言切换 — 双状态翻译图标.
 * 灵感来自 bi:translate 双盒布局,自绘 SVG <text> 让 A/文 跟随当前语言互换:
 *   - zh 当前 → 文 在前实心盒(主导),A 在背空心盒(目标)
 *   - en 当前 → A 在前实心盒,文 在背空心盒
 * variant='inline'(默认)跟随 layout 流;'fixed' 固定右下角(降级)
 */
import { useTranslation } from 'react-i18next';
import { syncLangToUrl } from '../i18n';
import './lang_toggle.css';

interface LangToggleProps {
  variant?: 'inline' | 'fixed';
  className?: string;
}

// 当前语言的字符在前实心盒,另一个在背空心盒. 前盒填 currentColor,
// 字用 var(--background) "punch out". 字符走系统字体,无需打包字体.
function TranslateIcon({ size = 16, isZh }: { size?: number; isZh: boolean }) {
  const back = isZh ? 'A' : '文';
  const front = isZh ? '文' : 'A';
  const backIsZh = !isZh;
  const frontIsZh = isZh;
  const cnFont = "system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif";
  const enFont = "ui-sans-serif, 'Inter', -apple-system, sans-serif";
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <rect x="0.5" y="0.5" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1" />
      <text
        x="5.5" y="8.2"
        textAnchor="middle"
        fontSize={backIsZh ? 7 : 7.5}
        fontWeight={backIsZh ? 500 : 700}
        fontFamily={backIsZh ? cnFont : enFont}
        fill="currentColor"
      >{back}</text>
      <rect x="5.5" y="5.5" width="10" height="10" rx="1.5" fill="currentColor" />
      <text
        x="10.5" y="13.2"
        textAnchor="middle"
        fontSize={frontIsZh ? 7 : 7.5}
        fontWeight={frontIsZh ? 500 : 700}
        fontFamily={frontIsZh ? cnFont : enFont}
        fill="var(--background)"
      >{front}</text>
    </svg>
  );
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
      <TranslateIcon size={14} isZh={isZh} />
    </button>
  );
}
