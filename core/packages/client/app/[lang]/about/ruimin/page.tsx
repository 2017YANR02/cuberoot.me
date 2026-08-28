'use client';

import AppLink from '@/components/AppLink';
import BackHome from '@/components/BackHome';
import PersonLink from '@/components/PersonLink';
import { tr } from '@/i18n/tr';
import { CREATOR_PROFILE } from '@/lib/creator-profile';
import { AWARD_GROUPS, EDUCATION, type AwardEntry } from './profile-data';
import CreatorGallery from './CreatorGallery';
import './ruimin.css';

function AwardArchiveEntry({ award }: { award: AwardEntry }) {
  const title = tr(award.title);
  return (
    <article className="ruimin-award">
      <p className="ruimin-award-date">{award.date}</p>
      <h3>{title}</h3>
      <p className="ruimin-award-detail">{tr(award.detail)}</p>
      <a
        className="ruimin-award-image-link"
        href={award.image}
        target="_blank"
        rel="noreferrer"
        aria-label={tr({ zh: `查看“${title}”证书大图`, en: `Open the full certificate for “${title}”` })}
      >
        <img
          src={award.image}
          alt={tr({ zh: `${title}证书`, en: `${title} certificate` })}
          width={award.width}
          height={award.height}
          loading="lazy"
          decoding="async"
        />
      </a>
    </article>
  );
}

export default function RuiminProfilePage() {
  return (
    <div className="ruimin-page">
      <div className="ruimin-shell">
        <div className="ruimin-topbar"><BackHome /></div>

        <main>
          <header className="ruimin-hero">
            <div className="ruimin-hero-copy">
              <p className="ruimin-kicker">{tr({ zh: 'CubeRoot 创始人与维护者', en: 'Founder and maintainer of CubeRoot' })}</p>
              <h1>
                <span className="ruimin-name-zh">颜瑞民</span>
                <span className="ruimin-name-en">Ruimin Yan</span>
              </h1>
              <p className="ruimin-hero-lead">
                {tr({
                  zh: '从数学、物理与科学计算出发，长期从事魔方工具开发、速拧课程设计与公式库建设。',
                  en: 'Working across mathematics, physics, and scientific computing, with a long-term focus on cubing tools, speedcubing course design, and algorithm libraries.',
                })}
              </p>
            </div>

            <dl className="ruimin-identity-index">
              <div>
                <dt>{tr({ zh: '出生', en: 'Born' })}</dt>
                <dd><time dateTime="1995-03-02">{tr({ zh: '1995 年 3 月 2 日', en: '2 March 1995' })}</time></dd>
              </div>
              <div>
                <dt>{tr({ zh: '来自', en: 'From' })}</dt>
                <dd>{tr({ zh: '浙江温州', en: 'Wenzhou, Zhejiang' })}</dd>
              </div>
              <div>
                <dt>{tr({ zh: '身份', en: 'Work' })}</dt>
                <dd>{tr({ zh: 'CubeRoot 创始人，中国航空图库首席摄影师', en: 'Founder of CubeRoot and chief photographer of the China Aviation Image Library' })}</dd>
              </div>
              <div>
                <dt>WCA</dt>
                <dd><PersonLink wcaId={CREATOR_PROFILE.wcaId}>2017YANR02</PersonLink></dd>
              </div>
            </dl>
          </header>

          <nav className="ruimin-profile-links" aria-label={tr({ zh: '相关页面', en: 'Related pages' })}>
            <AppLink href="/achievements">{tr({ zh: 'CubeRoot 原创工作', en: 'Original work on CubeRoot' })}<span aria-hidden="true">→</span></AppLink>
            <AppLink href="/teachers">{tr({ zh: '魔方老师名录', en: 'Teacher directory' })}<span aria-hidden="true">→</span></AppLink>
          </nav>

          <section className="ruimin-story" aria-labelledby="ruimin-profile-heading">
            <div className="ruimin-section-label">
              <p>01</p>
              <h2 id="ruimin-profile-heading">{tr({ zh: '个人简介', en: 'Profile' })}</h2>
            </div>
            <div className="ruimin-story-copy">
              <p>
                {tr({
                  zh: '颜瑞民，浙江温州人，“魔方根”创始人。南开大学数学与金融数学学士、物理学学士，乔治华盛顿大学数学硕士。学习期间曾参加北京大学偏微分方程数值方法暑期学校与中国科学院科学计算国际暑期学校。',
                  en: "Ruimin Yan is from Wenzhou, Zhejiang, and founded CubeRoot. He holds bachelor's degrees in Mathematics and Financial Mathematics, and Physics from Nankai University, and a master's degree in Mathematics from the George Washington University. His studies also included Peking University's summer school on numerical methods for partial differential equations and the Chinese Academy of Sciences' international summer school in scientific computing.",
                })}
              </p>
              <p>
                {tr({
                  zh: '他曾两次获全国高中数学联赛一等奖，并获中国数学奥林匹克三等奖（铜牌）。自 2017 年起参加 WCA 比赛，曾在斜转、脚拧和最少步项目综合排名中位列中国第一。公众号、B 站和抖音合计约 30 万关注者，著有《超脑思维：魔方游戏技巧从入门到精通》。',
                  en: 'He won first prize twice in the National High School Mathematics League and a third prize bronze medal at the Chinese Mathematical Olympiad. He has competed in WCA events since 2017 and formerly ranked first in China in a combined ranking across Skewb, 3×3 With Feet, and Fewest Moves. His WeChat Official Account, Bilibili, and Douyin channels have about 300,000 followers, and he wrote Superbrain Thinking: Rubik’s Cube Skills from Beginner to Mastery.',
                })}
              </p>
              <ul className="ruimin-specialties" aria-label={tr({ zh: '关注方向', en: 'Focus areas' })}>
                {[
                  { zh: '数学与群论', en: 'Mathematics and group theory' },
                  { zh: '速拧入门', en: 'Speedcubing foundations' },
                  { zh: '公式训练', en: 'Algorithm training' },
                  { zh: '斜转', en: 'Skewb' },
                  { zh: '最少步', en: 'Fewest Moves' },
                ].map((item) => <li key={item.en}>{tr(item)}</li>)}
              </ul>
            </div>
          </section>

          <section className="ruimin-education" aria-labelledby="ruimin-education-heading">
            <div className="ruimin-section-label">
              <p>02</p>
              <h2 id="ruimin-education-heading">{tr({ zh: '教育经历', en: 'Education' })}</h2>
            </div>
            <ol className="ruimin-education-list">
              {EDUCATION.map((entry) => (
                <li key={entry.period}>
                  <p className="ruimin-education-period">{entry.period}</p>
                  <div>
                    <h3>{tr(entry.institution)}</h3>
                    <p>{tr(entry.program)}</p>
                    {entry.note && <p className="ruimin-education-note">{tr(entry.note)}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="ruimin-awards" aria-labelledby="ruimin-awards-heading">
            <div className="ruimin-awards-intro">
              <div className="ruimin-section-label">
                <p>03</p>
                <h2 id="ruimin-awards-heading">{tr({ zh: '获奖档案', en: 'Award archive' })}</h2>
              </div>
            </div>

            {AWARD_GROUPS.map((group) => (
              <section className="ruimin-award-group" key={group.id} aria-labelledby={`ruimin-${group.id}`}>
                <header>
                  <p>{group.period}</p>
                  <h3 id={`ruimin-${group.id}`}>{tr(group.title)}</h3>
                </header>
                <div className="ruimin-award-grid">
                  {group.awards.map((award) => <AwardArchiveEntry key={award.id} award={award} />)}
                </div>
              </section>
            ))}
          </section>

          <CreatorGallery />

          <blockquote className="ruimin-closing">
            {tr({ zh: '希望以魔方和群论为入口，帮助孩子提升手眼协调、记忆与空间想象能力。', en: 'Use the cube and group theory as an entry point to help children develop hand-eye coordination, memory, and spatial reasoning.' })}
          </blockquote>
        </main>
      </div>
    </div>
  );
}
