'use client';

import Image from 'next/image';
import AppLink from '@/components/AppLink';
import PageBackLink from '@/components/PageBackLink';
import { tr } from '@/i18n/tr';
import { CREATOR_PROFILE } from '@/lib/creator-profile';
import './about.css';

const FOUNDERS = [
  {
    name: { zh: CREATOR_PROFILE.nameZh, en: CREATOR_PROFILE.nameEn },
    role: { zh: '创始人', en: 'Founder' },
    portrait: { src: '/images/ruimin/gallery/photo-05.webp', width: 3200, height: 2187 },
    portraitCrop: 'close',
    href: CREATOR_PROFILE.href,
    bio: {
      zh: '颜瑞民创办了魔方根，长期开发魔方求解、计时和复盘工具，并设计速拧课程、建设公式库。他拥有乔治华盛顿大学数学硕士学位，自 2017 年起参加 WCA 比赛，著有《超脑思维：魔方游戏技巧从入门到精通》。',
      en: 'Ruimin Yan founded CubeRoot. He builds tools for solving, timing, and reconstructing solves, designs speedcubing courses, and develops algorithm libraries. He holds a master’s degree in mathematics from the George Washington University, has competed in WCA events since 2017, and wrote Superbrain Thinking: Rubik’s Cube Skills from Beginner to Mastery.',
    },
  },
  {
    name: { zh: '温雨涵', en: 'Yuhan Wen' },
    role: { zh: '联合创始人', en: 'Co-founder' },
    portrait: { src: '/images/about/yuhan-wen.webp', width: 640, height: 640 },
    portraitCrop: 'square',
    bio: {
      zh: '温雨涵获上海财经大学硕士学位，曾从事消费投资和内容机构运营，也以「尤拉 Eula」创作个人成长内容。她创办了浦光星奕，参与主办首届 AIGC 内容产业大会，并推出面向 AI 内容制作的数字形象授权平台 Mira 镜界。',
      en: 'Yuhan Wen holds a master’s degree from Shanghai University of Finance and Economics. She has worked in consumer investing and creator management, and creates content on personal development as Eula. She founded Puguang Xingyi, helped organize the inaugural AIGC Content Industry Conference, and launched Mira, a digital likeness licensing platform for AI content production.',
    },
  },
] as const;

const RELATED_LINKS = [
  { href: '/achievements', label: { zh: '原创工作', en: 'Original work' } },
  { href: '/credits', label: { zh: '致谢', en: 'Credits' } },
  { href: '/contact', label: { zh: '联系', en: 'Contact' } },
] as const;

export default function AboutPage() {
  return (
    <div className="about-page">
      <div className="about-shell">
        <div className="about-topbar"><PageBackLink fallback="/" /></div>
        <main>
          <header className="about-intro">
            <h1>{tr({ zh: '关于魔方根', en: 'About CubeRoot' })}</h1>
            <p>{tr({
              zh: '魔方根（CubeRoot）是一个面向魔方玩家和教练的工具站。你可以在这里计时和复盘、练习公式、求解魔方，也可以查阅 WCA 比赛成绩与统计。',
              en: 'CubeRoot is a toolkit for cubers and coaches. Time and reconstruct solves, practice algorithms, find solutions, and explore World Cube Association results and statistics.',
            })}</p>
          </header>

          <section className="about-founders" aria-labelledby="about-founders-heading">
            <h2 id="about-founders-heading">{tr({ zh: '创始人', en: 'Founders' })}</h2>
            <div className="about-founder-grid">
              {FOUNDERS.map((founder) => (
                <article key={founder.name.en} className="about-founder">
                  <div className="about-founder-photo" data-crop={founder.portraitCrop}>
                    <Image
                      {...founder.portrait}
                      alt=""
                      loading="eager"
                      sizes={founder.portraitCrop === 'close' ? '346px' : '216px'}
                    />
                  </div>
                  <h3>
                    {'href' in founder
                      ? <AppLink href={founder.href} prefetch={false}>{tr(founder.name)}</AppLink>
                      : tr(founder.name)}
                  </h3>
                  <p className="about-founder-role">{tr(founder.role)}</p>
                  <p className="about-founder-bio">{tr(founder.bio)}</p>
                </article>
              ))}
            </div>
          </section>

          <nav className="about-related" aria-label={tr({ zh: '相关页面', en: 'Related pages' })}>
            {RELATED_LINKS.map(({ href, label }) => (
              <AppLink key={href} href={href} prefetch={false}>{tr(label)}</AppLink>
            ))}
          </nav>
        </main>
      </div>
    </div>
  );
}
