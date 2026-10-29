'use client';

import { useEffect, useRef, useState } from 'react';
import { encode } from 'uqr';
import { CareerDetail } from '@app-foundation/careers-ui';
import { CONTACT_WECHAT_ID } from '@cuberoot/shared/contact';
import { ChevronLeft, Share2 } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { copyPageLink, currentPageShare } from '@/lib/page-share';
import { usePanelClamp } from '@/hooks/usePanelClamp';
import { tr } from '@/i18n/tr';
import type { CareerPosition } from '../positions';

export default function PositionDetail({ position }: { position: CareerPosition }) {
  const [shareUrl, setShareUrl] = useState('');
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle');
  const shareRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  usePanelClamp(!!shareUrl, panelRef);
  useEffect(() => {
    if (!shareUrl) return;
    const dismiss = (event: PointerEvent) => {
      if (!shareRef.current?.contains(event.target as Node)) setShareUrl('');
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setShareUrl(''); };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape); };
  }, [shareUrl]);
  const qr = shareUrl ? encode(shareUrl, { border: 4, ecc: 'M' }) : null;
  const sections = [
    { title: tr({ zh: '工作内容', en: 'Responsibilities' }), items: position.responsibilities.map(tr) },
    { title: tr({ zh: '职位要求', en: 'Requirements' }), items: position.requirements.map(tr) },
    { title: tr({ zh: '加分项', en: 'Nice to have' }), items: position.advantages.map(tr) },
  ];
  return <main className="careers-page careers-detail">
    <AppLink className="back-home" href="/careers" prefetch={false} aria-label={tr({ zh: '返回职位列表', en: 'Back to positions' })}><ChevronLeft size={16} aria-hidden="true" /></AppLink>
    <article className="careers-detail-card" data-site-surface="panel">
      <div className="careers-detail-actions">
        <div className="careers-share-wrap" ref={shareRef}>
          <button type="button" className="careers-share" aria-expanded={!!shareUrl} aria-controls="careers-share-panel" onClick={() => { setCopyState('idle'); setShareUrl(shareUrl ? '' : currentPageShare()?.url ?? window.location.href); }}><Share2 size={17} aria-hidden />{tr({ zh: '分享', en: 'Share' })}</button>
          {qr && <div id="careers-share-panel" ref={panelRef} className="careers-share-panel" data-site-surface="panel">
            <h2>{tr({ zh: '扫码分享职位', en: 'Scan to share this position' })}</h2>
            <svg className="careers-share-qr" viewBox={`0 0 ${qr.size} ${qr.size}`} role="img" aria-label={tr({ zh: '职位链接二维码', en: 'Position link QR code' })} shapeRendering="crispEdges">
              <rect width={qr.size} height={qr.size} fill="white" />
              {qr.data.map((row, y) => row.map((cell, x) => cell ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="black" /> : null))}
            </svg>
            <h2>{tr({ zh: '或使用链接分享', en: 'Or share the link' })}</h2>
            <div className="careers-share-link"><input className="careers-share-input" readOnly value={shareUrl} onFocus={event => event.currentTarget.select()} aria-label={tr({ zh: '职位链接', en: 'Position link' })} /><button className="careers-share-copy" type="button" onClick={() => { void copyPageLink(shareUrl).then(ok => setCopyState(ok ? 'success' : 'error')); }}>{copyState === 'success' ? tr({ zh: '已复制', en: 'Copied' }) : tr({ zh: '复制', en: 'Copy' })}</button></div>
            {copyState === 'error' && <p role="alert">{tr({ zh: '复制失败，请手动选择链接复制。', en: 'Copy failed. Select the link to copy it.' })}</p>}
            {copyState === 'success' && <span className="sr-only" role="status">{tr({ zh: '链接已复制', en: 'Link copied' })}</span>}
          </div>}
        </div>
        <AppLink className="careers-apply" href={`/careers/${position.id}/apply`} prefetch={false}>{tr({ zh: '申请职位', en: 'Apply' })}</AppLink>
      </div>
      <CareerDetail title={tr(position.title)} meta={<p className="careers-category">{tr(position.category)} | {tr({ zh: '上海', en: 'Shanghai' })} | CubeRoot</p>} introduction={<><h2 className="careers-section-title">{tr({ zh: '职位描述', en: 'Position description' })}</h2><p>{tr(position.summary)}</p><p>{tr({ zh: '仅限上海，办公地点在上海阿里巴巴徐汇滨江园区。', en: 'Shanghai only. Our office is at Alibaba Xuhui Riverside Campus, Shanghai.' })}</p></>} sections={sections} />
      <section><h2>{tr({ zh: '如何联系', en: 'Contact' })}</h2><p>{tr({ zh: '请私信微信', en: 'Message us on WeChat' })} <strong>{CONTACT_WECHAT_ID}</strong>{tr({ zh: '，简单介绍自己，附上作品或相关经历。', en: ' with a short introduction and examples of your work or relevant experience.' })}</p></section>
      <section className="careers-position-info"><h2 className="careers-section-title">{tr({ zh: '职位信息', en: 'Position information' })}</h2><dl><div><dt>{tr({ zh: '职位名称', en: 'Position' })}</dt><dd>{tr(position.title)}</dd></div><div><dt>{tr({ zh: '职能类型', en: 'Category' })}</dt><dd>{tr(position.category)}</dd></div><div><dt>{tr({ zh: '工作地点', en: 'Location' })}</dt><dd>{tr({ zh: '上海', en: 'Shanghai' })}</dd></div></dl></section>
    </article>
  </main>;
}
