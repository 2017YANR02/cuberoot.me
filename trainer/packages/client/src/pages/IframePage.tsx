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
        // NOTE: 允许 iframe 中的脚本和表单操作
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      />
    </div>
  );
}
