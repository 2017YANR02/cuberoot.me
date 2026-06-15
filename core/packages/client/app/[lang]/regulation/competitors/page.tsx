'use client';

// /regulation/competitors — Article 2 (Competitors).
// Illustrated guide to who may compete and what is expected of them: the
// eligibility gate, the registration → on-site → first attempt flow (with the
// one-time WCA ID), a "your responsibilities" checklist, and the fair-play /
// follow-the-Delegate principle. Shared shell + primitives do the chrome.

import { useTranslation } from 'react-i18next';
import {
  ClipboardList, BadgeCheck, Timer,
  Handshake, Gavel, Volume2, Shirt, CalendarCheck, ShieldCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from '@/components/AppLink';
import { useT } from '../../../../hooks/useT';
import RegArticleLayout from '../_components/RegArticleLayout';
import FullClauses from '../_components/FullClauses';
import clauses from '../_data/reg-clauses/2.json';
import { RegSection, Callout, RegList } from '../_components/primitives';
import './competitors.css';

interface Step {
  Icon: LucideIcon;
  reg: string;
  zhTitle: string;
  enTitle: string;
  zhDesc: string;
  enDesc: string;
}

// Registration → on-site → first attempt. The WCA ID is issued once, on a
// person's very first competition.
const FLOW: Step[] = [
  {
    Icon: ClipboardList, reg: '2c',
    zhTitle: '报名', enTitle: 'Register',
    zhDesc: '提交姓名、所属国家/地区、出生日期、联系方式和想参加的项目。',
    enDesc: 'Submit your name, country/region, date of birth, contact details and the events you want to enter.',
  },
  {
    Icon: ShieldCheck, reg: '2a',
    zhTitle: '符合条件', enTitle: 'Meet the conditions',
    zhDesc: '你需满足几条基本条件:愿意遵守 WCA 规则、达到报名要求、未被禁赛,并遵守安全规定。',
    enDesc: 'You need to meet a few basic conditions: agree to follow the WCA Regulations, meet the entry requirements, not be suspended, and respect the safety measures.',
  },
  {
    Icon: BadgeCheck, reg: '2c+',
    zhTitle: '首次:用真名报名', enTitle: 'First time: register under your name',
    zhDesc: '第一次参赛要用真实姓名(或你惯用的名字)报名,并会获得一个终身唯一的 WCA ID —— 从此所有成绩都记在它名下。',
    enDesc: 'First-time competitors register under their legal name (or the name they go by), and are issued a lifelong, unique WCA ID — every result you ever set is recorded under it.',
  },
  {
    Icon: Timer, reg: '2u',
    zhTitle: '上场', enTitle: 'Compete',
    zhDesc: '被叫到时到场就位,准备开始;按 WCA 代表与裁判的安排完成每一轮。',
    enDesc: 'Show up when called and be ready to start, completing each round as arranged by the WCA Delegate and judges.',
  },
];

interface Duty {
  Icon: LucideIcon;
  reg: string;
  zh: string;
  en: string;
}

const DUTIES: Duty[] = [
  {
    Icon: Gavel, reg: '2n3',
    zh: '接受 WCA 代表的最终判决 —— 否则会被取消比赛资格。',
    en: 'Accept the WCA Delegate’s final rulings — refusing means disqualification from the competition.',
  },
  {
    Icon: Handshake, reg: '2k',
    zh: '不作弊、不欺骗工作人员、不干扰他人 —— 违者可被取消资格。',
    en: 'Don’t cheat, don’t defraud officials, don’t interfere with others — any of these can mean disqualification.',
  },
  {
    Icon: CalendarCheck, reg: '2u',
    zh: '被叫到时在场且随时准备开始;无故缺席会被取消该项目资格。',
    en: 'Be present and ready when called; missing your turn without reason means disqualification from that event.',
  },
  {
    Icon: Volume2, reg: '2g',
    zh: '在比赛区域保持安静;可以低声交谈,但要控制音量、远离正在比赛的选手。',
    en: 'Keep quiet in the competition area; talking is allowed, but keep it low and away from competitors who are actively solving.',
  },
  {
    Icon: Shirt, reg: '2h',
    zh: '穿着得体,举止顾及他人,遵守场地规定。',
    en: 'Dress appropriately, behave considerately, and respect the venue’s rules.',
  },
  {
    Icon: BadgeCheck, reg: '',
    zh: '一人只有一个 WCA 账号 —— 所有成绩都归在同一个 WCA ID 下(WCA 成绩系统约定)。',
    en: 'One WCA account per person — all your results live under a single WCA ID (a WCA results-system convention).',
  },
];

export default function CompetitorsChapter() {
  useTranslation();
  const t = useT();

  return (
    <RegArticleLayout slug="competitors">
      {/* ── 1. Who may compete ──────────────────────────────────── */}
      <RegSection
        eyebrow={t('门槛很低', 'The bar is low')}
        title={t('谁可以参赛', 'Who may compete')}
        lede={t(
          'WCA 比赛对所有人开放,没有年龄、国籍或水平门槛 —— 只要满足几条基本条件即可。',
          'WCA competitions are open to everyone, with no limit on age, nationality or skill — as long as a few basic conditions are met.'
        )}
      >
        <RegList
          items={[
            <span key="rules">
              <strong>{t('同意遵守规则。', 'Agree to the Regulations.')}</strong>{' '}
              {t(
                '愿意按 WCA 规则参赛(规则 2a1)。',
                'You agree to compete under the WCA Regulations (Regulation 2a1).'
              )}
            </span>,
            <span key="reqs">
              <strong>{t('满足参赛要求。', 'Meet the entry requirements.')}</strong>{' '}
              {t(
                '符合该场比赛设定的报名要求(规则 2a2)。',
                'You satisfy the requirements set for that competition (Regulation 2a2).'
              )}
            </span>,
            <span key="susp">
              <strong>{t('未被禁赛。', 'Not suspended.')}</strong>{' '}
              {t(
                '没有正处于 WCA 的禁赛状态(规则 2a3)。',
                'You are not currently under a WCA suspension (Regulation 2a3).'
              )}
            </span>,
            <span key="safe">
              <strong>{t('遵守安全规定。', 'Respect the safety measures.')}</strong>{' '}
              {t(
                '遵守比赛现场的安全与防护规定(规则 2a4)。18 岁以下选手报名参赛须经家长/监护人同意(规则 2b)。',
                'You comply with the venue’s safety measures (Regulation 2a4). Competitors under 18 must have a parent/guardian’s consent to register and compete (Regulation 2b).'
              )}
            </span>,
          ]}
        />
      </RegSection>

      {/* ── 2. Registration → the stage ─────────────────────────── */}
      <RegSection
        eyebrow={t('从报名到上场', 'From registration to the stage')}
        title={t('参赛的四步', 'Four steps to the mat')}
        lede={t(
          '从在网上点下报名,到坐到桌前完成第一次还原,中间经过这几步。WCA ID 只在你第一次参赛时发一次,之后伴随终身。',
          'From clicking “register” online to sitting down for your first solve, this is the path. The WCA ID is issued just once — at your very first competition — and stays with you for life.'
        )}
      >
        <ol className="comp-flow">
          {FLOW.map((s, i) => {
            const Icon = s.Icon;
            return (
              <li className="comp-flow-step" key={s.reg}>
                <span className="comp-flow-n" aria-hidden>{i + 1}</span>
                <span className="comp-flow-icon"><Icon size={22} /></span>
                <div className="comp-flow-body">
                  <div className="comp-flow-title">
                    {t(s.zhTitle, s.enTitle)}
                    <span className="comp-reg-tag">{s.reg}</span>
                  </div>
                  <p className="comp-flow-desc">{t(s.zhDesc, s.enDesc)}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <Callout tone="info" label={t('WCA ID 长这样', 'What a WCA ID looks like')} icon={<BadgeCheck size={17} />}>
          {t(
            'WCA ID 形如 2008ABCD01:前四位是你首次参赛的年份,中间是名字字母,末两位区分同名。它终身唯一,一人只有一个账号 —— 别注册第二个。',
            'A WCA ID looks like 2008ABCD01: the first four digits are the year of your first competition, the letters come from your name, and the last two distinguish people who would otherwise collide. It is unique for life, and one person has only one account — never register a second.'
          )}
        </Callout>
      </RegSection>

      {/* ── 3. Your responsibilities ────────────────────────────── */}
      <RegSection
        eyebrow={t('你的责任', 'Your responsibilities')}
        title={t('身为选手该做到的', 'What is expected of you')}
        lede={t(
          '参赛不只是坐下来拧魔方。下面这些是每个选手都要做到的基本义务。',
          'Competing is more than sitting down and turning a cube. These are the basic duties every competitor is expected to keep.'
        )}
      >
        <div className="comp-duties">
          {DUTIES.map((d) => {
            const Icon = d.Icon;
            return (
              <div className="comp-duty" key={d.reg + d.en}>
                <span className="comp-duty-icon"><Icon size={20} /></span>
                <p className="comp-duty-text">
                  {t(d.zh, d.en)}
                  {d.reg && <span className="comp-reg-tag">{d.reg}</span>}
                </p>
              </div>
            );
          })}
        </div>

        <Callout tone="success" label={t('两条压舱石:公平 + 听代表', 'Two anchors: fair play + follow the Delegate')}>
          {t(
            '整章规则归根结底是两件事:本着公平竞赛的精神参赛,以及听从 WCA 代表的指示。遇到规则没写明的情况,代表怎么裁定就怎么办 —— 这正是上一章「工作人员」里代表那份特殊权力的另一面。',
            'The whole article boils down to two things: compete in the spirit of fair play, and follow the WCA Delegate’s instructions. When a situation isn’t spelled out, whatever the Delegate rules is what goes — the flip side of the Delegate’s special authority from the previous chapter, Officials.'
          )}
        </Callout>

        <p className="reg-foot-note">
          {t(
            '别忘了:选手也可能被叫去当裁判或打乱员 —— 详见',
            'Remember: a competitor may also be asked to judge or scramble — see '
          )}
          <Link href="/regulation/officials">{t('第 1 章「工作人员」', 'Article 1, Officials')}</Link>
          {t('。具体的还原流程、检查与罚时,见', '. For the solve procedure itself — inspection and penalties — see ')}
          <Link href="/regulation/speed-solving">{t('附则 A「速拧」', 'Article A, Speed Solving')}</Link>
          {t('。', '.')}
        </p>
      </RegSection>
      <FullClauses data={clauses} />
    </RegArticleLayout>
  );
}
