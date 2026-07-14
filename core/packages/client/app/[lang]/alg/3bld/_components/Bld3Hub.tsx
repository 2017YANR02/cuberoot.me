'use client';

// 3BLD module grid — the standalone hub page at /alg/3bld.

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
      { href: '/alg/3bld/helper', zh: '读码还原助手', en: 'Read-Code Helper', img: helperIcon
    },
    ]
},
  {
    zh: '公式训练',
    en: 'Algorithm Drills',
    modules: [
      { href: '/alg/3bld/edge', zh: '棱块公式训练', en: 'Edge Trainer', img: edgeIcon
    },
      { href: '/alg/3bld/corner', zh: '角块公式训练', en: 'Corner Trainer', img: cornerIcon
    },
      { href: '/alg/3bld/twist', zh: '翻角公式训练', en: 'Corner Twist Trainer', img: twistIcon
    },
      { href: '/alg/3bld/flip', zh: '翻棱公式训练', en: 'Edge Flip Trainer', img: flipIcon
    },
    ]
},
  {
    zh: '浮动训练',
    en: 'Floating Buffer',
    modules: [
      { href: '/alg/3bld/edge-float', zh: '棱块浮动训练', en: 'Edge Float Trainer', img: edgeFloatIcon
    },
      { href: '/alg/3bld/corner-float', zh: '角块浮动训练', en: 'Corner Float Trainer', img: cornerFloatIcon
    },
    ]
},
  {
    zh: '编组训练',
    en: '2-2 Swap',
    modules: [
      { href: '/alg/3bld/2c2c', zh: '2C2C 训练', en: '2C2C Trainer', img: twoC2cIcon
    },
      { href: '/alg/3bld/2e2e', zh: '2E2E 训练', en: '2E2E Trainer', img: twoE2eIcon
    },
    ]
},
  {
    zh: '奇偶训练',
    en: 'Parity',
    modules: [
      { href: '/alg/3bld/ltct', zh: '奇偶带翻训练', en: 'Parity + Twist (LTCT)', img: ltctIcon
    },
      { href: '/alg/3bld/parity', zh: '奇偶训练', en: 'Parity Trainer', img: parityIcon
    },
    ]
},
  {
    zh: '记忆与公式库',
    en: 'Memory & Library',
    modules: [
      { href: '/alg/3bld/memo', zh: '记忆默写训练', en: 'Memory Recall', icon: <Brain size={40} strokeWidth={1.5} />
    },
      { href: '/alg/3bld/comm', zh: '公式库', en: 'Commutator Library', icon: <Library size={40} strokeWidth={1.5} />
    },
    ]
},
  {
    zh: '参考',
    en: 'Reference',
    modules: [
      { href: '/alg/3bld/readme', zh: '说明', en: 'Introduction', icon: <FileText size={40} strokeWidth={1.5} />
    },
      { href: '/alg/3bld/resources', zh: '资源汇总', en: 'Resources', icon: <Compass size={40} strokeWidth={1.5} />
    },
    ]
},
];

function TimerLink({}: { isZh: boolean }) {
  return (
    <Link href="/alg/3bld/timer" className="bld-hub-secondary">
      <TimerIcon size={15} />
      {tr({ zh: '计时练习', en: 'Timed practice'
    })}
    </Link>
  );
}

function HubBody({ isZh }: { isZh: boolean }) {
  return (
    <>
      <div className="bld-topbar">
        <h1><EventIcon event="333bf" /> {tr({ zh: '盲拧训练', en: '3BLD Trainer'
        })}</h1>
        <span className="bld-spacer" />
        <TimerLink isZh={isZh} />
      </div>

      <p className="bld-hub-intro">
        {tr({ zh: '三阶盲拧全套训练：读码还原、棱角公式、浮动缓冲、编组、奇偶，以及记忆默写与公式库。', en: 'Full 3BLD training suite: read-code helper, edge/corner drills, floating buffer, 2-2 swaps, parity, plus memory recall and a commutator library.'
        })}
      </p>

      {GROUPS.map((group) => (
        <section key={group.en} className="bld-hub-group">
          <h2 className="bld-hub-group-title">{tr(group)}</h2>
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
                <div className="bld-hub-card-title">{tr(m)}</div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

export function Bld3Hub() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  return (
    <div className="bld-trainer-root">
      <HubBody isZh={isZh} />
    </div>
  );
}
