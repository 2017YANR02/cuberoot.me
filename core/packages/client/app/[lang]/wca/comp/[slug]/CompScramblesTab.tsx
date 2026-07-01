'use client';

/**
 * /wca/comp/[slug] 的「打乱」页 —— 把 /scramble/gen 的「比赛」模式整套内嵌进比赛页。
 * 复用 TNoodleMode(forcedCompId 内嵌模式):自动加载本场已公布的打乱,渲染项目/轮次切换、
 * 十字步数分析、打乱图、下载 PDF 等全部能力,不跳出比赛页。
 *
 * showPreview / sq1Compact 与 /scramble/gen 共用同一组 localStorage 键,偏好跨页一致。
 * GEN_CX_VARS:十字分析的色块 / 步数徽标依赖 --gen-cx-* 变量(gen/page.tsx 同款,内联注入)。
 */
import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useT } from '@/hooks/useT';
import { CUBE_FILL } from '@/lib/cube-colors';
import TNoodleMode from '@/app/[lang]/scramble/gen/TNoodleMode';
// gen.css 平时由 /scramble/gen 的 page.tsx 引入;内嵌进比赛页时必须自带,否则 .gen-* 样式全丢。
import '@/app/[lang]/scramble/gen/gen.css';

const GEN_CX_VARS = {
  '--gen-cx-w': CUBE_FILL.U,
  '--gen-cx-y': CUBE_FILL.D,
  '--gen-cx-r': CUBE_FILL.R,
  '--gen-cx-o': CUBE_FILL.L,
  '--gen-cx-b': CUBE_FILL.B,
  '--gen-cx-g': CUBE_FILL.F,
} as CSSProperties;

const SHOW_PREVIEW_KEY = 'gen:showPreview';
const SQ1_COMPACT_KEY = 'gen:sq1Compact';
function readShowPreview(): boolean {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(SHOW_PREVIEW_KEY) !== '0';
}
function readSq1Compact(): boolean {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(SQ1_COMPACT_KEY) !== '0';
}

export default function CompScramblesTab({ slug }: { slug: string }) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = useT();

  const [showPreview, setShowPreviewState] = useState<boolean>(readShowPreview);
  const setShowPreview = (v: boolean) => {
    setShowPreviewState(v);
    try { localStorage.setItem(SHOW_PREVIEW_KEY, v ? '1' : '0'); } catch { /* swallow */ }
  };

  const [sq1Compact, setSq1CompactState] = useState<boolean>(readSq1Compact);
  const setSq1Compact = (v: boolean) => {
    setSq1CompactState(v);
    try { localStorage.setItem(SQ1_COMPACT_KEY, v ? '1' : '0'); } catch { /* swallow */ }
  };

  return (
    <div className="gen-page comp-scrambles-embed" style={GEN_CX_VARS}>
      <TNoodleMode
        t={t}
        isZh={isZh}
        showPreview={showPreview}
        onTogglePreview={() => setShowPreview(!showPreview)}
        sq1Compact={sq1Compact}
        onSq1CompactChange={setSq1Compact}
        forcedCompId={slug}
      />
    </div>
  );
}
