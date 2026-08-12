'use client';

/**
 * 通用 iframe 包装页组件
 * NOTE: 用于嵌入未迁移到 React 的外部模块（Solver/Alg Trainer/csTimer）
 * 零改动上游代码，通过 iframe 在 SPA 内展示原版页面
 *
 * Ported 1:1 from packages/client-vite/src/pages/IframePage.tsx
 */
import { ExternalLink } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { T, type Msg } from '@/i18n/tr';

interface IframePageProps {
  /** iframe 加载的 URL（如 /tools/solver/ 或独立应用 origin） */
  src: string;
  /** 页面标题 */
  title: string;
  /** 独立应用地址；提供后在标题栏显示新标签页入口 */
  fullAppHref?: string;
  fullAppLabel?: Msg;
  /** 路由已有 server metadata 时关闭客户端标题覆盖 */
  syncDocumentTitle?: boolean;
}

function IframeDocumentTitle({ title }: { title: string }) {
  // 工具名都是英文(csTimer / Solver / Cross Trainer 等),两语都用同一份
  useDocumentTitle(title, title);
  return null;
}

export default function IframePage({
  src,
  title,
  fullAppHref,
  fullAppLabel = { en: 'Open full app', zh: '打开完整应用' },
  syncDocumentTitle = true,
}: IframePageProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100dvh',
      background: 'var(--background)',
    }}>
      {syncDocumentTitle ? <IframeDocumentTitle title={title} /> : null}
      {/* NOTE: 顶部标题栏 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 16px',
        background: 'color-mix(in srgb, var(--background) 95%, transparent)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <span style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>{title}</span>
        {fullAppHref ? (
          <a
            href={fullAppHref}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              marginLeft: 'auto',
              color: 'var(--foreground)',
              fontSize: 14,
              whiteSpace: 'nowrap',
            }}
          >
            <T {...fullAppLabel} />
            <ExternalLink size={14} aria-hidden />
          </a>
        ) : null}
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
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads allow-top-navigation allow-top-navigation-by-user-activation"
        onLoad={(e) => {
          // 独立应用是跨域页面，浏览器本就不允许读取其 DOM；直接跳过同源链接修正。
          if (!src.startsWith('/')) return;
          try {
            const iframe = e.target as HTMLIFrameElement;
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (iframeDoc) {
              // NOTE: 防止在 iframe 内部通过 <a> 标签导航时，把 React SPA 加载到 iframe 里形成套娃。
              // 自动将同源绝对路径的链接（如 href="/cross_trainer/"）设为 _top，交给外层的 React App 路由处理。
              // 例外：指向本 iframe 自己那棵树的绝对链接（BLDDB 是 Next 应用，内部链接都带
              // basePath /tools/blddb/…）—— 打 _top 会把整个站跳出去，且 next/link 见到
              // target 就放弃客户端路由，站内导航直接废掉。
              const links = iframeDoc.querySelectorAll('a');
              links.forEach(a => {
                const href = a.getAttribute('href');
                if (href && href.startsWith('/') && !href.startsWith(src)) {
                  a.target = '_top';
                }
              });
            }
          } catch (err) {
            console.warn('Failed to intercept iframe links:', err);
          }
        }}
      />
    </div>
  );
}
