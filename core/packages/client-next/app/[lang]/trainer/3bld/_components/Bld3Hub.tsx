'use client';

// Shared 3BLD module grid — rendered both as the standalone hub page
// (/trainer/3bld) and inline on /trainer when the puzzle selector is set to
// 三盲/3BLD. `embedded` drops the page-level wrapper + big title so it nests
// cleanly under the /trainer landing.

import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { Brain, Library, FileText, Compass, Timer as TimerIcon } from 'lucide-react';
import { EventIcon } from '@/components/EventIcon/EventIcon';

import helperIcon from '../_icons/helper.svg';
import edgeIcon from '../_icons/edge.svg';
import cornerIcon from '../_icons/corner.svg';
import twistIcon from '../_icons/twist.svg';
import flipIcon from '../_icons/flip.svg';
import edgeFloatIcon from '../_icons/edge-float.svg';
import cornerFloatIcon from '../_icons/corner-float.svg';
import twoC2cIcon from '../_icons/2c2c.svg';
import twoE2eIcon from '../_icons/2e2e.svg';
import ltctIcon from '../_icons/ltct.svg';
import parityIcon from '../_icons/parity.svg';

import '../3bld.css';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

type StaticImg = { src: string };

interface BldModule {
  href: string;
  zh: string;
  en: string;
  img?: StaticImg;
  icon?: React.ReactNode;
}

interface BldGroup {
  zh: string;
  en: string;
  modules: BldModule[];
}

const GROUPS: BldGroup[] = [
  {
    zh: '读码还原',
    en: 'Read & Solve',
    modules: [
      { href: '/trainer/3bld/helper', zh: '读码还原助手', en: 'Read-Code Helper', img: helperIcon
    },
    ]
},
  {
    zh: '公式训练',
    en: 'Algorithm Drills',
    modules: [
      { href: '/trainer/3bld/edge', zh: '棱块公式训练', en: 'Edge Trainer', img: edgeIcon
    },
      { href: '/trainer/3bld/corner', zh: '角块公式训练', en: 'Corner Trainer', img: cornerIcon
    },
      { href: '/trainer/3bld/twist', zh: '翻角公式训练', en: 'Corner Twist Trainer', img: twistIcon
    },
      { href: '/trainer/3bld/flip', zh: '翻棱公式训练', en: 'Edge Flip Trainer', img: flipIcon
    },
    ]
},
  {
    zh: '浮动训练',
    en: 'Floating Buffer',
    modules: [
      { href: '/trainer/3bld/edge-float', zh: '棱块浮动训练', en: 'Edge Float Trainer', img: edgeFloatIcon
    },
      { href: '/trainer/3bld/corner-float', zh: '角块浮动训练', en: 'Corner Float Trainer', img: cornerFloatIcon
    },
    ]
},
  {
    zh: '编组训练',
    en: '2-2 Swap',
    modules: [
      { href: '/trainer/3bld/2c2c', zh: '2C2C 训练', en: '2C2C Trainer', img: twoC2cIcon
    },
      { href: '/trainer/3bld/2e2e', zh: '2E2E 训练', en: '2E2E Trainer', img: twoE2eIcon
    },
    ]
},
  {
    zh: '奇偶训练',
    en: 'Parity',
    modules: [
      { href: '/trainer/3bld/ltct', zh: '奇偶带翻训练', en: 'Parity + Twist (LTCT)', img: ltctIcon
    },
      { href: '/trainer/3bld/parity', zh: '奇偶训练', en: 'Parity Trainer', img: parityIcon
    },
    ]
},
  {
    zh: '记忆与公式库',
    en: 'Memory & Library',
    modules: [
      { href: '/trainer/3bld/memo', zh: '记忆默写训练', en: 'Memory Recall', icon: <Brain size={40} strokeWidth={1.5} />
    },
      { href: '/trainer/3bld/comm', zh: '公式库', en: 'Commutator Library', icon: <Library size={40} strokeWidth={1.5} />
    },
    ]
},
  {
    zh: '参考',
    en: 'Reference',
    modules: [
      { href: '/trainer/3bld/readme', zh: '说明', en: 'Introduction', icon: <FileText size={40} strokeWidth={1.5} />
    },
      { href: '/trainer/3bld/resources', zh: '资源汇总', en: 'Resources', icon: <Compass size={40} strokeWidth={1.5} />
    },
    ]
},
];

function TimerLink({ isZh }: { isZh: boolean }) {
  return (
    <Link href="/trainer/3bld/timer" className="bld-hub-secondary">
      <TimerIcon size={15} />
      {tr({ zh: '计时练习', en: 'Timed practice',
          zhHant: "計時練習"
    })}
    </Link>
  );
}

function HubBody({ isZh, embedded }: { isZh: boolean; embedded: boolean }) {
  return (
    <>
      {!embedded && (
        <div className="bld-topbar">
          <h1><EventIcon event="333bf" /> {tr({ zh: '盲拧训练', en: '3BLD Trainer',
              zhHant: "盲擰訓練"
        })}</h1>
          <span className="bld-spacer" />
          <TimerLink isZh={isZh} />
        </div>
      )}

      <p className="bld-hub-intro">
        {tr({ zh: '三阶盲拧全套训练：读码还原、棱角公式、浮动缓冲、编组、奇偶，以及记忆默写与公式库。', en: 'Full 3BLD training suite: read-code helper, edge/corner drills, floating buffer, 2-2 swaps, parity, plus memory recall and a commutator library.',
            zhHant: "三階盲擰全套訓練：讀碼還原、稜角公式、浮動緩衝、編組、奇偶，以及記憶默寫與公式庫。"
        })}
      </p>

      {embedded && <div className="bld-hub-embed-actions"><TimerLink isZh={isZh} /></div>}

      {GROUPS.map((group) => (
        <section key={group.en} className="bld-hub-group">
          <h2 className="bld-hub-group-title">{(i18n.language.startsWith('zh') ? group.zh : group.en)}</h2>
          <div className="bld-hub-grid">
            {group.modules.map((m) => (
              <Link key={m.href} href={m.href} className="bld-hub-card">
                <div className="bld-hub-card-icon">
                  {m.img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.img.src} alt="" width={72} height={72} />
                  ) : (
                    <span className="bld-hub-card-lucide">{m.icon}</span>
                  )}
                </div>
                <div className="bld-hub-card-title">{(i18n.language.startsWith('zh') ? m.zh : m.en)}</div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

export function Bld3Hub({ embedded = false }: { embedded?: boolean }) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  if (embedded) {
    return <div className="bld-hub-embed">{<HubBody isZh={isZh} embedded />}</div>;
  }
  return (
    <div className="bld-trainer-root">
      <HubBody isZh={isZh} embedded={false} />
    </div>
  );
}
