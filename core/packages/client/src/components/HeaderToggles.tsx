/**
 * 页面右上角共用容器:LangToggle + ThemeToggle.
 * 每页之前各自包一层 `.xxx-header-right`,这里收口。
 */
import LangToggle from './LangToggle';
import ThemeToggle from './ThemeToggle';
import './header_toggles.css';

export default function HeaderToggles({ className }: { className?: string }) {
  const cls = ['header-toggles', className].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      <LangToggle />
      <ThemeToggle />
    </div>
  );
}
