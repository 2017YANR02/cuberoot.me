'use client';

// /regulation/officials — Article 1 (Officials).
// Illustrated guide to who runs a WCA competition: the roles (Delegate,
// organisation team, judge, scrambler, score taker, announcer), the
// Delegate's special authority, and the facts that one person may hold
// several roles and that officials may also compete. Shared shell +
// primitives do the chrome.

import { useTranslation } from 'react-i18next';
import {
  Gavel, Building2, ClipboardCheck, Shuffle,
  Calculator, Megaphone, Layers, Trophy,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from '@/components/AppLink';
import { useT } from '../../../../hooks/useT';
import RegArticleLayout from '../_components/RegArticleLayout';
import { RegSection, Callout, RegList } from '../_components/primitives';
import './officials.css';

interface Role {
  Icon: LucideIcon;
  reg: string;
  zhTitle: string;
  enTitle: string;
  zhDesc: string;
  enDesc: string;
}

// The Delegate is rendered separately (it gets a Callout for its authority),
// so this grid holds the operational roles that actually run the event.
const ROLES: Role[] = [
  {
    Icon: Building2, reg: '1b',
    zhTitle: '主办团队', enTitle: 'Organisation team',
    zhDesc: '负责赛前、赛中、赛后的全部组织工作:场地、器材、赛程、报名与现场流程。',
    enDesc: 'Handles the logistics of the competition before, during and after: venue, equipment, schedule, registration and on-site flow.',
  },
  {
    Icon: ClipboardCheck, reg: '1e',
    zhTitle: '裁判', enTitle: 'Judge',
    zhDesc: '陪同选手完成一次还原的全过程:计时、监督检查与还原、判定罚时,并在成绩单上签名。一名裁判可同时看多名选手。',
    enDesc: 'Sees a competitor through one solve: running the timer, overseeing inspection and the solve, applying penalties and signing the scorecard. One judge may handle several competitors at once.',
  },
  {
    Icon: Shuffle, reg: '1f',
    zhTitle: '打乱员', enTitle: 'Scrambler',
    zhDesc: '按官方打乱公式把已还原的魔方拧到指定状态,并核对打乱是否正确。',
    enDesc: 'Applies the official scramble sequence to a solved puzzle and verifies that it was scrambled correctly.',
  },
  {
    Icon: Calculator, reg: '1g',
    zhTitle: '录入员', enTitle: 'Score taker',
    zhDesc: '汇总并录入成绩;成绩一经录入,只有经 WCA 代表许可才能更改。',
    enDesc: 'Compiles and enters results; once entered, scores may only be changed at the WCA Delegate’s discretion.',
  },
  {
    Icon: Megaphone, reg: '1l',
    zhTitle: '发令员', enTitle: 'Announcer',
    zhDesc: '在“一对一”(Head to Head)轮次中负责现场宣告与发令 —— 每个一对一轮次都必须有发令员。',
    enDesc: 'Announces and calls Head to Head rounds — every Head to Head round must have an announcer.',
  },
];

export default function OfficialsChapter() {
  useTranslation();
  const t = useT();

  return (
    <RegArticleLayout slug="officials">
      {/* ── 1. The Delegate sits above everyone ─────────────────── */}
      <RegSection
        eyebrow={t('谁在主持', 'Who is in charge')}
        title={t('代表说了算', 'The Delegate has the final say')}
        lede={t(
          '每场 WCA 比赛都由一位 WCA 代表负责。代表的职责是确保比赛符合 WCA 规则:从赛前审核到现场判定,凡规则交由其裁量的地方,以代表的判断为准。',
          'Every WCA competition is overseen by a WCA Delegate. The Delegate’s job is to ensure the competition follows the WCA Regulations: from pre-competition checks to on-the-spot rulings, wherever the Regulations leave room for judgment, the Delegate’s call is what stands.'
        )}
      >
        <div className="off-delegate">
          <div className="off-delegate-badge" aria-hidden>
            <Gavel size={30} />
          </div>
          <div className="off-delegate-body">
            <div className="off-delegate-name">
              {t('WCA 代表', 'WCA Delegate')}
              <span className="off-reg-tag">1c</span>
            </div>
            <p className="off-delegate-text">
              {t(
                '代表确保整场比赛严格依照 WCA 规则进行,并对其被授权负责的事项负最终责任。代表可以指派他人执行具体职责,但责任仍在代表身上。',
                'The Delegate ensures the competition is run strictly according to the WCA Regulations and is ultimately accountable for the responsibilities assigned to them. The Delegate may appoint others to carry out specific duties, but the responsibility remains theirs.'
              )}
            </p>
          </div>
        </div>

        <Callout tone="info" label={t('代表的特殊权力', 'The Delegate’s special authority')} icon={<Gavel size={17} />}>
          {t(
            '当某种情况规则没有明文规定,或需要现场酌情处理时,WCA 代表有权作出裁量判断;代表也可以推翻其他工作人员的判定。规则中大量“由 WCA 代表决定”的措辞都指向这一点 —— 现场遇到争议,最终都回到代表手里。',
            'Where a situation is not spelled out in the Regulations, or calls for on-site discretion, the WCA Delegate may make a judgment call — and the Delegate may override the decisions of other officials. The many “at the discretion of the WCA Delegate” phrases throughout the Regulations all point here: any on-site dispute ultimately comes back to the Delegate.'
          )}
        </Callout>
      </RegSection>

      {/* ── 2. The roles that run the event ─────────────────────── */}
      <RegSection
        eyebrow={t('各管一摊', 'Each has a job')}
        title={t('谁在跑这场比赛', 'Who keeps a competition running')}
        lede={t(
          '一场比赛由若干角色协作完成。每个角色各司其职,但都在 WCA 代表的统筹之下。',
          'A competition is run by a handful of roles working together. Each has its own job, all coordinated under the WCA Delegate.'
        )}
      >
        <div className="reg-cards off-cards">
          {ROLES.map((r) => {
            const Icon = r.Icon;
            return (
              <div className="reg-card" key={r.reg}>
                <div className="reg-card-head">
                  <span className="reg-card-icon"><Icon size={30} /></span>
                  <div>
                    <div className="reg-card-title">{t(r.zhTitle, r.enTitle)}</div>
                    <div className="reg-card-sub">{r.reg}</div>
                  </div>
                </div>
                <p>{t(r.zhDesc, r.enDesc)}</p>
              </div>
            );
          })}
        </div>
      </RegSection>

      {/* ── 3. One person, many hats — and they may compete too ──── */}
      <RegSection
        eyebrow={t('身份可以重叠', 'Roles can overlap')}
        title={t('一个人可以身兼数职', 'One person can wear several hats')}
        lede={t(
          '工作人员的角色不是互斥的。尤其在小型比赛里,同一个人常常同时担任多种角色,而且工作人员自己也能参赛。',
          'The official roles are not mutually exclusive. Especially at smaller competitions, one person often holds several roles at once — and officials may compete themselves.'
        )}
      >
        <div className="off-facts">
          <div className="off-fact">
            <span className="off-fact-icon"><Layers size={22} /></span>
            <div>
              <div className="off-fact-title">
                {t('一人多职', 'Several roles at once')}
                <span className="off-reg-tag">1k</span>
              </div>
              <p>
                {t(
                  '同一个人可以同时担任多种工作人员角色 —— 比如一边打乱一边录入,或既是主办又是裁判。',
                  'One person may take on several official roles simultaneously — scrambling and entering scores at once, say, or being both an organiser and a judge.'
                )}
              </p>
            </div>
          </div>
          <div className="off-fact">
            <span className="off-fact-icon"><Trophy size={22} /></span>
            <div>
              <div className="off-fact-title">
                {t('工作人员也能参赛', 'Officials may compete too')}
                <span className="off-reg-tag">1j</span>
              </div>
              <p>
                {t(
                  '工作人员(包括 WCA 代表)同样可以作为选手参加比赛 —— 自己负责的项目自然要由别人来给自己打乱和判定。',
                  'Officials — the WCA Delegate included — may also compete. Naturally, someone else scrambles and judges their own attempts.'
                )}
              </p>
            </div>
          </div>
        </div>

        <Callout tone="warn" label={t('选手也可能被叫去当工作人员', 'Competitors may be asked to help run it')}>
          {t(
            '反过来也成立:选手可能被叫去当裁判或打乱员。除非有正当理由(由 WCA 代表认定),否则不得推辞。换句话说,“帮忙跑比赛”本身也是选手的一份义务。',
            'It works the other way too: a competitor may be called on to judge or scramble, and can be excused only for a legitimate reason — as judged by the WCA Delegate. In other words, helping run the competition is itself part of being a competitor.'
          )}
        </Callout>

        <RegList
          items={[
            <span key="judge">
              <strong>{t('被叫去判定。', 'Called to judge.')}</strong>{' '}
              {t(
                '选手须在被要求时担任裁判,无正当理由不得拒绝(规则 1e2)。',
                'A competitor must judge when asked, and may refuse only with a legitimate reason (Regulation 1e2).'
              )}
            </span>,
            <span key="scramble">
              <strong>{t('被叫去打乱。', 'Called to scramble.')}</strong>{' '}
              {t(
                '同样,选手须在被要求时担任打乱员(规则 1f2)。',
                'Likewise, a competitor must scramble when asked (Regulation 1f2).'
              )}
            </span>,
            <span key="more">
              {t(
                '想了解打乱本身怎么做、怎样保密与核对,见',
                'For how scrambling itself is done — secrecy, verification and all — see '
              )}
              <Link href="/regulation/scrambling">{t('第 4 章「打乱」', 'Article 4, Scrambling')}</Link>
              {t('。', '.')}
            </span>,
          ]}
        />
      </RegSection>
    </RegArticleLayout>
  );
}
