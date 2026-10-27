'use client';

import { useState } from 'react';
import { CareerDetail } from '@app-foundation/careers-ui';
import { CONTACT_WECHAT_ID } from '@cuberoot/shared/contact';
import { ChevronLeft, Share2 } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { PageShareModal } from '@/components/WeChatPcShareModal';
import { tr } from '@/i18n/tr';
import type { CareerPosition } from '../positions';

export default function PositionDetail({ position }: { position: CareerPosition }) {
  const [share, setShare] = useState<{ url: string; title: string } | null>(null);
  const sections = [
    { title: tr({ zh: '工作内容', en: 'Responsibilities' }), items: position.responsibilities.map(tr) },
    { title: tr({ zh: '职位要求', en: 'Requirements' }), items: position.requirements.map(tr) },
    { title: tr({ zh: '加分项', en: 'Nice to have' }), items: position.advantages.map(tr) },
  ];
  return <main className="careers-page careers-detail">
    <AppLink className="back-home" href="/careers" prefetch={false} aria-label={tr({ zh: '返回职位列表', en: 'Back to positions' })}><ChevronLeft size={16} aria-hidden="true" /></AppLink>
    <article className="careers-detail-card" data-site-surface="panel">
      <div className="careers-detail-actions">
        <button type="button" className="careers-share" onClick={() => setShare({ url: window.location.href, title: tr(position.title) })}><Share2 size={17} aria-hidden />{tr({ zh: '分享', en: 'Share' })}</button>
        <AppLink className="careers-apply" href={`/careers/${position.id}/apply`} prefetch={false}>{tr({ zh: '申请职位', en: 'Apply' })}</AppLink>
      </div>
      <CareerDetail title={tr(position.title)} meta={<p className="careers-category">{tr(position.category)} · {tr({ zh: '上海', en: 'Shanghai' })} · CubeRoot</p>} introduction={<><p>{tr(position.summary)}</p><p>{tr({ zh: '仅限上海，办公地点在上海阿里巴巴徐汇滨江园区。', en: 'Shanghai only. Our office is at Alibaba Xuhui Riverside Campus, Shanghai.' })}</p></>} sections={sections} />
      <section><h2>{tr({ zh: '如何联系', en: 'Contact' })}</h2><p>{tr({ zh: '请私信微信', en: 'Message us on WeChat' })} <strong>{CONTACT_WECHAT_ID}</strong>{tr({ zh: '，简单介绍自己，附上作品或相关经历。', en: ' with a short introduction and examples of your work or relevant experience.' })}</p></section>
    </article>
    {share && <PageShareModal share={share} onClose={() => setShare(null)} />}
  </main>;
}
