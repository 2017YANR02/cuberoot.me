'use client';

/**
 * /recon-about — 复盘库说明页
 */
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './recon_about.css';

interface StepProps { step: number; title: string; body: string; highlight?: boolean; }
function Step({ step, title, body, highlight }: StepProps) {
  return (
    <div className={`rca-step${highlight ? ' is-highlight' : ''}`}>
      <span className="rca-step-num">{step}</span>
      <div>
        <div className="rca-step-title">{title}</div>
        <div className="rca-step-body">{body}</div>
      </div>
    </div>
  );
}
function Arrow() { return <span className="rca-arrow" aria-hidden="true">↓</span>; }

export default function ReconAboutPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);
  useDocumentTitle('复盘库说明', 'Recon Library Guide');

  return (
    <div className="rca-page">
      <div className="rca-header">
        <Link href="/recon" className="rca-back">
          <ArrowLeft size={16} />
          <span>{t('返回复盘库', 'Back to Recon')}</span>
        </Link>
      </div>

      <main className="rca-main">
        <h1 className="rca-title">{t('复盘库是干啥的', 'What the Recon library is')}</h1>
        <p className="rca-intro">
          {t(
            '/recon 把一次具体的 solve 完整拆给所有人看 — 打乱、还原步骤、关键节点的分析、谁解的、在哪场比赛。可以上传自己的成绩、补充别人比赛的还原、对照同轮其它选手的思路。',
            '/recon shows a full breakdown of a specific solve — the scramble, the move sequence, key inflection points, who solved it, at which competition. You can upload your own solves, fill in reconstructions for other cubers, and compare different attempts in the same round.',
          )}
        </p>

        <h2 className="rca-section-title">{t('能用来做什么', 'What you can do here')}</h2>
        <p className="rca-section-intro">
          {t(
            '主要四类:看顶尖选手的 PR / WR 怎么解的、查自己上传过的复盘、对照同轮其它选手的 alt(替代解)、给现有复盘加备注或修正。',
            'Four main flows: see how top cubers got their PR / WR solves, review your own uploaded recons, compare alts (alternative solutions) from the same round, and add notes / corrections to existing entries.',
          )}
        </p>

        <h2 className="rca-section-title">{t('使用流程', 'How to use')}</h2>
        <div className="rca-flow">
          <Step
            step={1}
            title={t('过滤 / 搜索', 'Filter or search')}
            body={t(
              '顶部表头每列可点开 popover 过滤:项目、选手、纪录标志(WR/CR/NR)、比赛。"WCA only" toggle 只看正式比赛复盘。',
              'Each column header opens a popover filter: event, person, record tag (WR/CR/NR), competition. The "WCA only" toggle restricts to official-competition solves.',
            )}
          />
          <Arrow />
          <Step
            step={2}
            title={t('点条目看详情', 'Open an entry for details')}
            body={t(
              '点任一行进入 /recon/:id,显示完整 alg 步骤、player 动画、节点切片(cross / F2L 各对 / OLL / PLL)、用时 / TPS。',
              'Click any row to open /recon/:id, which shows the full move sequence, animated player, stage breakdown (cross / F2L pairs / OLL / PLL), with timing and TPS per stage.',
            )}
          />
          <Arrow />
          <Step
            step={3}
            title={t('提交自己的复盘', 'Submit your own')}
            body={t(
              '右上「+」打开 /recon/submit,粘贴 scramble + alg + 可选 setup,自动校验是否真还原,通过即写库;不通过会高亮报错位置。',
              'The "+" button opens /recon/submit. Paste scramble + alg + optional setup; the tool auto-validates that the solution actually solves the cube, then writes to the library. Invalid attempts get highlighted error positions.',
            )}
          />
          <Arrow />
          <Step
            step={4}
            title={t('补 alt / 同轮联动', 'Add alts / round-mate linking')}
            body={t(
              '同一选手同一轮的多手 solve 自动关联,点 alt 按钮一键添加。从其它选手相同打乱的复盘进入时,标题旁会提示「同轮其它复盘 N 条」。',
              'Multiple solves by the same cuber in the same round auto-link; click the "alt" button to add another. When viewing a recon whose scramble appears in another cuber\'s solve, the title shows "N round-mates" for quick comparison.',
            )}
            highlight
          />
        </div>

        <h2 className="rca-section-title">{t('数据来源', 'Data sources')}</h2>
        <p className="rca-section-intro">
          {t(
            '用户上传 + 部分官方比赛 same-round 自动联动(成绩走 cubing.com 实时 + WCA dump 周更)。所有 scramble 经 cubing.js 校验,公开后任何登录用户可贴 alt;原作者 / admin 可改。',
            'User uploads, plus same-round auto-link from official competitions (live results via cubing.com + WCA dump weekly). All scrambles are validated through cubing.js; once public, any signed-in user can append alts, while the original poster or an admin can edit.',
          )}
        </p>

        <h2 className="rca-section-title">{t('相关页面', 'See also')}</h2>
        <ul className="rca-refs">
          <li>
            <Link href="/wca/comp">{t('比赛成绩查看', 'Competition Results')}</Link>
            {t(' — 找到比赛具体某轮的成绩单,再回头补复盘。', ' — find an exact round\'s scoresheet, then come back to add the recon.')}
          </li>
          <li>
            <Link href="/analyze">{t('CFOP 分析器', 'CFOP Analyzer')}</Link>
            {t(' — 给一个 scramble + solution,自动切 cross / F2L / OLL / PLL 节点。', ' — given a scramble and solution, auto-segments cross / F2L / OLL / PLL stages.')}
          </li>
          <li>
            <a href="https://reco.nz/" target="_blank" rel="noopener noreferrer">{t('reco.nz', 'reco.nz')}</a>
            {t(' — 类似定位的另一个复盘平台,可对照。', ' — another recon platform with similar scope; useful for cross-checking.')}
          </li>
        </ul>
      </main>
    </div>
  );
}
