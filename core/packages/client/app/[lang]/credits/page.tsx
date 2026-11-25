'use client';

import MoreToggle from '@/components/MoreToggle';
import PageBackLink from '@/components/PageBackLink';
import { tr } from '@/i18n/tr';
import CREDITS from './credits_data.json';
import './credits.css';

type Text = { zh: string; en: string };
type Credit = Text & { name: string; url: string; section?: string; space?: boolean };
type CreditSection = { id: string; title: Text; summary?: Text };

const GENERAL_SECTIONS: CreditSection[] = [
  {
    id: 'solvers',
    title: { zh: '求解与打乱', en: 'Solvers and scrambles' },
    summary: { zh: '搜索算法、最优解与打乱生成', en: 'Search algorithms, optimal solutions, and scramble generation' },
  },
  {
    id: 'practice',
    title: { zh: '计时、训练与复盘', en: 'Timing, training, and reconstruction' },
    summary: { zh: '智能魔方协议、练习工具与视频识别', en: 'Smart-cube protocols, practice tools, and video recognition' },
  },
  {
    id: 'competition',
    title: { zh: '比赛数据与规则', en: 'Competition data and regulations' },
    summary: { zh: '比赛统计、排名、纪录和规则资料', en: 'Competition statistics, rankings, records, and regulations' },
  },
  {
    id: 'visualization',
    title: { zh: '模拟与魔方图示', en: 'Simulation and cube diagrams' },
    summary: { zh: '魔方显示、图案和动画参考', en: 'Cube rendering, patterns, and animation references' },
  },
  {
    id: 'platform',
    title: { zh: '站点与应用', en: 'Website and apps' },
    summary: { zh: '界面、搜索、媒体处理和平台工具', en: 'Interface, search, media processing, and platform tools' },
  },
];

const SPACE_SECTIONS: CreditSection[] = [
  { id: 'space-tools', title: { zh: '渲染、地图与场景素材', en: 'Rendering, maps, and scene assets' } },
  { id: 'space-campus', title: { zh: '园区、桥梁与住宅', en: 'Campuses, bridges, and residences' } },
  { id: 'space-lujiazui', title: { zh: '陆家嘴建筑', en: 'Lujiazui architecture' } },
  { id: 'space-bund', title: { zh: '外滩建筑', en: 'Bund architecture' } },
  { id: 'space-lighting', title: { zh: '照明与夜景', en: 'Lighting and night views' } },
];

const credits: readonly Credit[] = CREDITS;
const creditsBySection = new Map([...GENERAL_SECTIONS, ...SPACE_SECTIONS].map(({ id }) => [id, [] as Credit[]]));
for (const credit of credits) {
  const fallback = credit.space ? 'space-tools' : 'platform';
  const section = creditsBySection.get(credit.section ?? fallback) ?? creditsBySection.get(fallback);
  section?.push(credit);
}

function CreditGroup({ id, title, summary }: CreditSection) {
  return (
    <details className="credits-group">
      <MoreToggle as="summary" className="credits-group-toggle">
        <span>
          <span className="credits-group-title">{tr(title)}</span>
          {summary && <span className="credits-group-summary">{tr(summary)}</span>}
        </span>
      </MoreToggle>
      <ul className="credits-list">
        {creditsBySection.get(id)?.map((credit) => (
          <li key={`${credit.url}#${credit.name}`}>
            <a href={credit.url} target="_blank" rel="noopener noreferrer">{credit.name}</a>
            <p>{tr(credit)}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function CreditsPage() {
  return (
    <div className="credits-page">
      <div className="credits-shell">
        <div className="credits-topbar"><PageBackLink fallback="/about" /></div>
        <main>
          <header className="credits-intro">
            <h1>{tr({ zh: '致谢', en: 'Credits' })}</h1>
            <p>{tr({
              zh: '感谢为魔方根提供帮助和启发的开源项目、公开资料与素材作者。',
              en: 'Thanks to the open-source projects, public references, and asset creators that helped shape CubeRoot.',
            })}</p>
          </header>

          <div className="credits-directory">
            {GENERAL_SECTIONS.map((section) => <CreditGroup key={section.id} {...section} />)}
            <details className="credits-group">
              <MoreToggle as="summary" className="credits-group-toggle">
                <span>
                  <span className="credits-group-title">{tr({ zh: '魔方空间与 3D 地景', en: 'Cube Space and 3D scenery' })}</span>
                  <span className="credits-group-summary">{tr({
                    zh: '渲染、地图、建筑建模与光照参考',
                    en: 'Rendering, maps, architectural modeling, and lighting references',
                  })}</span>
                </span>
              </MoreToggle>
              <div className="credits-subgroups">
                {SPACE_SECTIONS.map((section) => <CreditGroup key={section.id} {...section} />)}
              </div>
            </details>
          </div>

          <p className="credits-source">
            <a href="https://github.com/RuiminYan/cuberoot.me" target="_blank" rel="noopener noreferrer">
              {tr({ zh: '在 GitHub 查看本站源码', en: 'View the site source on GitHub' })}
            </a>
          </p>
        </main>
      </div>
    </div>
  );
}
