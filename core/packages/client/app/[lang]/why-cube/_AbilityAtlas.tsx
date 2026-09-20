'use client';

import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import {
  AudioWaveform,
  Brain,
  Braces,
  ChevronDown,
  Eye,
  Flag,
  Gauge,
  Hand,
  Hourglass,
  ListTree,
  Map as MapIcon,
  MessageCircle,
  RefreshCw,
  Route,
  ScanSearch,
  SearchCheck,
  Shapes,
  Shield,
  Target,
  Telescope,
  UsersRound,
} from 'lucide-react';
import AlgPlayer from '@/components/AlgPlayer/AlgPlayer';
import { useT } from '../../../hooks/useT';
import { ABILITY_COUNT, ABILITY_GROUPS } from './_ability-details';
import './_AbilityAtlas.css';

const ABILITY_ICONS = {
  observation: Eye,
  'spatial-imagination': ScanSearch,
  'pattern-recognition': Shapes,
  'hand-eye-coordination': Hand,
  'logical-reasoning': Route,
  'task-decomposition': ListTree,
  planning: MapIcon,
  'algorithmic-thinking': Braces,
  'memory-strategy': Brain,
  lookahead: Telescope,
  'decision-speed': Gauge,
  rhythm: AudioWaveform,
  focus: Target,
  patience: Hourglass,
  'error-diagnosis': SearchCheck,
  reflection: RefreshCw,
  'goal-management': Flag,
  resilience: Shield,
  communication: MessageCircle,
  'confidence-connection': UsersRound,
} as const;

const ABILITY_INDEX = new Map(
  ABILITY_GROUPS.flatMap(group => group.abilities).map((ability, index) => [ability.id, index + 1]),
);

const DETAIL_LABELS = [
  ['家长常见的困扰', 'What parents often notice'],
  ['课堂会怎么练', 'How the lesson works'],
  ['您能看到的变化', 'What you can expect to see'],
] as const;

export default function AbilityAtlas() {
  useTranslation();
  const t = useT();

  return (
    <div
      className="wc-atlas"
      data-site-surface="panel"
      aria-label={t('玩魔方能反复练习的二十种能力', 'Twenty abilities practised through cubing')}
    >
      <div className="wc-atlas-overview">
        <div className="wc-atlas-visual">
          <div className="wc-atlas-orbits" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="wc-atlas-cube">
            <AlgPlayer
              puzzle="3x3"
              set=""
              engine="sim"
              alg=""
              setup="R U R' U' F2 D L2 B U2"
              controlMode="none"
              size={240}
            />
          </div>
          <div className="wc-atlas-core-copy">
            <strong>{t('一次转动', 'One turn')}</strong>
            <span>{t('眼、脑、手同时参与', 'eyes, mind and hands work together')}</span>
          </div>
          <div className="wc-atlas-pulse wc-atlas-pulse-a" aria-hidden="true" />
          <div className="wc-atlas-pulse wc-atlas-pulse-b" aria-hidden="true" />
        </div>

        <div className="wc-atlas-overview-copy">
          <span className="wc-atlas-kicker">{t('20 项成长地图', 'A map of 20 growth areas')}</span>
          <h3>{t('魔方的价值，远不止“会还原”', 'Cubing offers far more than a completed solve')}</h3>
          <p>
            {t(
              '下面把一次还原里反复发生的观察、思考、执行与复盘，拆成 20 项可以向家长清楚说明的能力。每一项都能展开阅读，既讲课堂里怎样练，也说明能观察什么证据、宣传时应该守住什么边界。',
              'Below, the observation, reasoning, execution and reflection inside every solve are unpacked into 20 abilities. Open any item to see how it can be practised, what evidence parents can observe, and how to describe the value without overclaiming.',
            )}
          </p>
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
      </div>

      <div className="wc-atlas-groups">
        {ABILITY_GROUPS.map(group => (
          <section className="wc-atlas-group" key={group.id} aria-labelledby={`wc-atlas-${group.id}`}>
            <div className="wc-atlas-group-intro">
              <div className="wc-atlas-group-image">
                <Image
                  src={group.image}
                  alt={t(group.imageAlt[0], group.imageAlt[1])}
                  width={1440}
                  height={960}
                  sizes="(max-width: 780px) 100vw, 34vw"
                />
              </div>
              <span>{t(group.eyebrow[0], group.eyebrow[1])}</span>
              <h3 id={`wc-atlas-${group.id}`}>{t(group.title[0], group.title[1])}</h3>
              <p>{t(group.intro[0], group.intro[1])}</p>
            </div>

            <div className="wc-atlas-ability-list">
              {group.abilities.map(ability => {
                const Icon = ABILITY_ICONS[ability.id as keyof typeof ABILITY_ICONS];
                const index = ABILITY_INDEX.get(ability.id);

                return (
                  <details className="wc-atlas-ability" data-tone={ability.tone} key={ability.id}>
                    <summary>
                      <span className="wc-atlas-icon" aria-hidden="true">
                        <Icon size={24} strokeWidth={1.8} />
                        <span className="wc-atlas-icon-index">{String(index).padStart(2, '0')}</span>
                      </span>
                      <span className="wc-atlas-ability-heading">
                        <strong>{t(ability.title[0], ability.title[1])}</strong>
                        <span>{t(ability.summary[0], ability.summary[1])}</span>
                      </span>
                      <span className="wc-atlas-expand" aria-hidden="true">
                        <span className="wc-atlas-expand-closed">{t('看看怎么练', 'See how it works')}</span>
                        <span className="wc-atlas-expand-open">{t('收起', 'Collapse')}</span>
                        <ChevronDown size={18} />
                      </span>
                    </summary>
                    <div className="wc-atlas-ability-body">
                      {ability.paragraphs.map((paragraph, paragraphIndex) => (
                        <div className="wc-atlas-ability-point" key={paragraphIndex}>
                          <strong>
                            {t(DETAIL_LABELS[paragraphIndex][0], DETAIL_LABELS[paragraphIndex][1])}
                          </strong>
                          <p>{t(paragraph[0], paragraph[1])}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <p className="wc-atlas-footnote">
        {t(
          `以上共 ${ABILITY_COUNT} 项。它们描述的是魔方学习中可以被设计、观察和记录的练习机会，不等同于医疗效果，也不承诺自动迁移到所有学科。`,
          `These ${ABILITY_COUNT} areas describe practice opportunities that can be designed, observed and recorded through cubing. They are not medical outcomes and do not promise automatic transfer to every subject.`,
        )}
      </p>
    </div>
  );
}
