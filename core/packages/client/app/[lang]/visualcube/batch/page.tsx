'use client';

/**
 * /visualcube/batch — 一栏公式,一次出一批图。
 *
 * 设置不在这页重造:URL 用的是与 /visualcube 编辑器**同一套 key**(codec 的 '' 前缀),
 * 所以 `/visualcube?...` 后面挂个 `/batch` 就把当前配色 / 视图 / 遮罩 / 尺寸整套带过来,
 * 反过来也一样。这页只管「列表 → 多张图」这件编辑器不管的事。
 *
 * 渲染走 renderSpecSvg —— 与编辑器、与 /v1 服务端是同一条纯函数路径,不是近似版。
 * 需要 DOM 的那几种视图(3×3 net 涂色编辑器、sr-puzzlegen 的异形 iso/top)批量出不了,
 * 明说,不给半张假图。
 */

import { Suspense, useEffect, useMemo, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import Link from '@/components/AppLink';
import BackHome from '@/components/BackHome';
import { useImageSpec } from '@/components/puzzle-image/useImageSpec';
import { batchFileName, parseBatchList } from '@/lib/puzzle-image/batch';
import { specToParams } from '@/lib/puzzle-image/codec';
import {
  exportSvgText, saveBlob, svgToPngBlob, type PhysicalSize,
} from '@/lib/puzzle-image/image-export';
import { domRenderKindOf, renderSpecSvg } from '@/lib/puzzle-image/render';
import { makeZip, type ZipEntry } from '@/lib/zip';
import { publicApiUrl } from '@/lib/api-base';
import { useT } from '@/hooks/useT';
import { tr } from '@/i18n/tr';
import '@/components/puzzle-image/puzzle-image.css';
import './batch.css';

/** 上限。超出的行会被丢掉并明确告知(不静默截断)。 */
const MAX_ITEMS = 200;

const SAMPLE = [
  'Sune = R U R\' U R U2 R\'',
  'Anti-Sune = R U2 R\' U\' R U\' R\'',
  'T perm = R U R\' U\' R\' F R2 U\' R\' U\' R U R\' F\'',
].join('\n');

function BatchPageInner() {
  const t = useT();
  // 这页只读 spec —— 设置在编辑器里改,两边共用同一套 URL key。
  const [spec] = useImageSpec('');
  const [text, setText] = useState(SAMPLE);
  const [format, setFormat] = useState<'svg' | 'png'>('png');
  const [template, setTemplate] = useState('{i}-{name}');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const { items, dropped } = useMemo(() => parseBatchList(text, MAX_ITEMS), [text]);

  const physical: PhysicalSize | null = spec.printSize > 0
    ? { size: spec.printSize, unit: spec.printUnit }
    : null;

  // 该 spec 的渲染器需要 DOM → 批量出不了。整页只有一条 spec,所以判一次就够。
  const domOnly = domRenderKindOf(spec) !== null;

  /** 每条渲染一次。公式写错就把这条标红,不影响其余的。 */
  const rendered = useMemo(() => {
    if (domOnly) return [];
    return items.map((item) => {
      try {
        const svg = renderSpecSvg({ ...spec, algorithm: item.alg });
        return { item, svg: svg ?? null, error: svg ? null : 'unsupported' };
      } catch (e) {
        return { item, svg: null, error: e instanceof Error ? e.message : String(e) };
      }
    });
  }, [items, spec, domOnly]);

  const ok = rendered.filter((r) => r.svg);
  const bad = rendered.filter((r) => !r.svg);

  /** 编辑器链接:把当前整套设置原样带过去。 */
  const editorHref = useMemo(() => {
    const qs = specToParams(spec, '').toString();
    return `/visualcube${qs ? `?${qs}` : ''}`;
  }, [spec]);

  /** API 链接列表(每行一条),给要在别处引用的人。 */
  const urlList = useMemo(() => ok.map(({ item }) => {
    const p = specToParams({ ...spec, algorithm: item.alg }, '');
    return `${publicApiUrl('/v1/visualcube.svg')}?${p.toString()}`;
  }).join('\n'), [ok, spec]);

  async function downloadZip() {
    if (!ok.length || busy) return;
    setBusy(true);
    setNote('');
    try {
      const entries: ZipEntry[] = [];
      for (const { item, svg } of ok) {
        const name = batchFileName(template, item, ok.length, format);
        if (format === 'svg') {
          entries.push({
            name,
            data: new TextEncoder().encode(exportSvgText(svg as string, physical)),
          });
        } else {
          const blob = await svgToPngBlob(svg as string, spec.imageSize, physical);
          entries.push({ name, data: new Uint8Array(await blob.arrayBuffer()) });
        }
      }
      // 显式标注:tsgo 认不出 makeZip 声明的 Uint8Array<ArrayBuffer>(见 image-export.ts)。
      const zip: Uint8Array<ArrayBuffer> = makeZip(entries);
      saveBlob(new Blob([zip], { type: 'application/zip' }), `cube-images-${entries.length}.zip`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="vc-editor-page vcb-page">
      <BackHome />
      <header className="vc-header">
        <h1>{t('批量出图', 'Batch images')}</h1>
        <div className="vc-header-right">
          <Link className="vc-header-link" href={editorHref}>
            {t('在编辑器里调设置', 'Adjust in editor')}
          </Link>
        </div>
      </header>

      <p className="vcb-intro">
        {t(
          '一行一条公式,可写成「名字 = 公式」或从表格直接粘(制表符分隔),# 开头的行忽略。配色、视图、遮罩、尺寸这些跟编辑器共用同一条链接 —— 在编辑器调好再点过来即可。',
          'One algorithm per line — either "name = alg" or tab-separated straight from a spreadsheet; lines starting with # are ignored. Colours, view, mask and size come from the same URL the editor uses, so set them there and come back.',
        )}
      </p>

      <div className="vc-row vc-row-block">
        <label className="vc-label" htmlFor="vcb-list">{t('公式列表', 'Algorithms')}</label>
        <div className="vc-row-controls vc-col">
          <textarea
            id="vcb-list"
            className="vc-text vc-textarea vcb-list"
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
          />
        </div>
      </div>

      <div className="vc-row">
        <label className="vc-label">{t('导出', 'Export')}</label>
        <div className="vc-row-controls">
          <select
            className="vc-select" value={format}
            aria-label={t('文件格式', 'File format')}
            onChange={(e) => setFormat(e.target.value as 'svg' | 'png')}
          >
            <option value="png">PNG</option>
            <option value="svg">SVG</option>
          </select>
          <input
            className="vc-text vcb-template" value={template}
            aria-label={t('文件名模板', 'Filename template')}
            placeholder="{i}-{name}"
            onChange={(e) => setTemplate(e.target.value)}
          />
          <button type="button" className="vc-btn" disabled={!ok.length || busy} onClick={downloadZip}>
            {busy ? <Loader2 size={14} className="vcb-spin" /> : <Download size={14} />}{' '}
            {t('下载 ZIP', 'Download ZIP')} ({ok.length})
          </button>
          <button
            type="button" className="vc-btn" disabled={!ok.length}
            onClick={() => navigator.clipboard.writeText(urlList)}
          >
            {t('复制链接列表', 'Copy URL list')}
          </button>
        </div>
      </div>

      {(dropped > 0 || bad.length > 0 || note || domOnly) && (
        <div className="vcb-notes">
          {domOnly && (
            <p className="vcb-warn">
              {t(
                '当前视图要靠浏览器实时渲染,批量出不了。换成 normal / plan / trans / wca 再试。',
                'This view renders in the browser only and cannot be batched. Switch to normal / plan / trans / wca.',
              )}
            </p>
          )}
          {dropped > 0 && (
            <p className="vcb-warn">
              {tr({
                zh: `超过 ${MAX_ITEMS} 条,后面 ${dropped} 行没出图。`,
                en: `Over the ${MAX_ITEMS}-item cap — the last ${dropped} line(s) were skipped.`,
              })}
            </p>
          )}
          {bad.map(({ item, error }) => (
            <p key={item.index} className="vcb-warn">
              #{item.index} <code>{item.alg}</code> — {error}
            </p>
          ))}
          {note && <p className="vcb-warn">{note}</p>}
        </div>
      )}

      <div className="vcb-grid">
        {ok.map(({ item, svg }) => (
          <figure key={item.index} className="vcb-cell">
            <div className="vcb-img" dangerouslySetInnerHTML={{ __html: svg as string }} />
            <figcaption className="vcb-cap">
              <span className="vcb-cap-name">{item.name || `#${item.index}`}</span>
              <code className="vcb-cap-alg">{item.alg}</code>
            </figcaption>
          </figure>
        ))}
      </div>

      {!ok.length && !domOnly && (
        <p className="vcb-empty">
          {t('上面写几条公式就能看到图。', 'Type a few algorithms above to see the images.')}
        </p>
      )}

      <p className="vcb-foot">
        {tr({ zh: `输出 ${spec.imageSize}px`, en: `Output ${spec.imageSize}px` })}
        {physical
          ? tr({
            zh: `,文件自带 ${physical.size}${physical.unit}`,
            en: `, file carries ${physical.size}${physical.unit}`,
          })
          : ''}
      </p>
    </div>
  );
}

export default function VisualCubeBatchPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Loading…</div>}>
      <BatchPageInner />
    </Suspense>
  );
}
