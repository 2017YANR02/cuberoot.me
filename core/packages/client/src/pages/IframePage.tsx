/**
 * 通用 iframe 包装页组件
 * NOTE: 用于嵌入未迁移到 React 的外部模块（Solver/Alg Trainer/csTimer）
 * 零改动上游代码，通过 iframe 在 SPA 内展示原版页面
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface IframePageProps {
  /** iframe 加载的 URL 路径（如 /solver/） */
  src: string;
  /** 页面标题 */
  title: string;
}

export default function IframePage({ src, title }: IframePageProps) {
  const { t } = useTranslation();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#0d1117',
    }}>
      {/* NOTE: 顶部导航栏 — 提供返回首页的入口 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 16px',
        background: 'rgba(13, 17, 23, 0.95)',
        borderBottom: '1px solid rgba(138, 180, 248, 0.15)',
        flexShrink: 0,
      }}>
        <Link
          to="/"
          style={{
            color: '#8ab4f8',
            textDecoration: 'none',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          ← {t('common.backToHome')}
        </Link>
        <span style={{ color: '#9aa0a6', fontSize: 14 }}>{title}</span>
      </div>

      {/* NOTE: iframe 全屏填满剩余空间 */}
      <iframe
        src={src}
        title={title}
        style={{
          flex: 1,
          border: 'none',
          width: '100%',
        }}
        // NOTE: 允许 iframe 中的脚本和表单操作，同时允许通过 target="_top" 导航顶层窗口
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-top-navigation allow-top-navigation-by-user-activation"
        onLoad={(e) => {
          try {
            const iframe = e.target as HTMLIFrameElement;
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (iframeDoc) {
              // NOTE: 防止在 iframe 内部通过 <a> 标签导航时，把 React SPA 加载到 iframe 里形成套娃。
              // 自动将同源绝对路径的链接（如 href="/cross_trainer/"）设为 _top，交给外层的 React App 路由处理。
              const links = iframeDoc.querySelectorAll('a');
              links.forEach(a => {
                const href = a.getAttribute('href');
                if (href && href.startsWith('/')) {
                  a.target = '_top';
                }
              });
            }
          } catch (err) {
            // 跨域 iframe 可能会抛出 DOMException，由于 src 一般是同源的，极少发生。
            console.warn('Failed to intercept iframe links (possibly cross-origin):', err);
          }
        }}
      />
    </div>
  );
}
