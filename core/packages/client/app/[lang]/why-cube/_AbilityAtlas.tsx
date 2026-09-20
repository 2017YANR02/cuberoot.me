'use client';

import { useTranslation } from 'react-i18next';
import { Eye, Hand, Route, ScanSearch, Target, UsersRound } from 'lucide-react';
import { VisualCube } from '@/components/VisualCube';
import { useT } from '../../../hooks/useT';
import './_AbilityAtlas.css';

const ABILITIES = [
  {
    Icon: Eye,
    tone: 'info',
    title: ['观察与识别', 'Observe & recognise'],
    copy: ['跟踪色块，发现重复出现的图案', 'Track pieces and spot repeating patterns'],
  },
  {
    Icon: ScanSearch,
    tone: 'success',
    title: ['空间想象', 'Spatial imagination'],
    copy: ['在脑中预演一次转动后的结果', 'Preview the result of a turn in your head'],
  },
  {
    Icon: Route,
    tone: 'accent',
    title: ['逻辑推理', 'Logical reasoning'],
    copy: ['看清条件，再选择合适的下一步', 'Read the conditions, then choose the next step'],
  },
  {
    Icon: Hand,
    tone: 'warning',
    title: ['手眼协调', 'Hand-eye coordination'],
    copy: ['让眼睛、双手与节奏同步起来', 'Synchronise your eyes, hands and rhythm'],
  },
  {
    Icon: Target,
    tone: 'success',
    title: ['专注与耐心', 'Focus & patience'],
    copy: ['出错后重新校准，一步一步完成', 'Reset after mistakes and finish one step at a time'],
  },
  {
    Icon: UsersRound,
    tone: 'info',
    title: ['自信与连接', 'Confidence & connection'],
    copy: ['从第一次还原，走向分享与赛场', 'Go from a first solve to sharing and competing'],
  },
] as const;

export default function AbilityAtlas() {
  useTranslation();
  const t = useT();

  return (
    <div
      className="wc-atlas"
      data-site-surface="panel"
      role="group"
      aria-label={t('玩魔方能锻炼的六种能力', 'Six abilities practised through cubing')}
    >
      <div className="wc-atlas-visual">
        <div className="wc-atlas-orbits" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="wc-atlas-cube">
          <VisualCube
            setup="R U R' U' F2 D L2 B U2"
            view="iso"
            size={240}
            local
            alt={t('转动中的三阶魔方', 'A turned 3×3 cube')}
          />
        </div>
        <div className="wc-atlas-core-copy">
          <strong>{t('一次转动', 'One turn')}</strong>
          <span>{t('眼、脑、手同时参与', 'eyes, mind and hands work together')}</span>
        </div>
        <div className="wc-atlas-pulse wc-atlas-pulse-a" aria-hidden="true" />
        <div className="wc-atlas-pulse wc-atlas-pulse-b" aria-hidden="true" />
      </div>

      <div className="wc-atlas-abilities">
        {ABILITIES.map(({ Icon, tone, title, copy }, index) => (
          <article className="wc-atlas-ability" data-tone={tone} key={title[0]}>
            <div className="wc-atlas-icon" aria-hidden="true">
              <Icon size={25} strokeWidth={1.8} />
              <span className="wc-atlas-icon-index">{index + 1}</span>
            </div>
            <div className="wc-atlas-ability-copy">
              <h3>{t(title[0], title[1])}</h3>
              <p>{t(copy[0], copy[1])}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="wc-atlas-sequence" aria-label={t('解决魔方问题的循环', 'The cube-solving loop')}>
        <span>{t('观察', 'Observe')}</span>
        <i aria-hidden="true" />
        <span>{t('判断', 'Decide')}</span>
        <i aria-hidden="true" />
        <span>{t('执行', 'Execute')}</span>
        <i aria-hidden="true" />
        <span>{t('复盘', 'Reflect')}</span>
      </div>
    </div>
  );
}
