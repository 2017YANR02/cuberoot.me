'use client';

import BackHome from '@/components/BackHome';
import AppLink from '@/components/AppLink';
import { T, tr } from '@/i18n/tr';
import ContactDetails from './ContactDetails';
import './contact.css';

type Bi = { zh: string; en: string };

interface GroupBlock {
  title: Bi;
  groups: Bi[];
}

interface GroupSection {
  id: string;
  title: Bi;
  description: Bi;
  blocks: GroupBlock[];
}

const group = (zh: string, en: string): Bi => ({ zh, en });

const SECTIONS: GroupSection[] = [
  {
    id: 'official-group',
    title: group('官方群', 'Official group'),
    description: group('魔方根网站交流群。', 'The official CubeRoot community group.'),
    blocks: [
      {
        title: group('网站交流群', 'Website community'),
        groups: [
          group('cuberoot.me群', 'cuberoot.me group'),
        ],
      },
    ],
  },
  {
    id: 'cuberoot-groups',
    title: group('魔方根群', 'CubeRoot groups'),
    description: group('魔方根主群、高级群与兴趣交流子群。', 'CubeRoot main, advanced and interest groups.'),
    blocks: [
      {
        title: group('主群与高级群', 'Main and advanced groups'),
        groups: [
          group('VIP群 (付费)', 'VIP group (paid)'),
          group('换位子群 (高级群)', 'Commutator group (advanced)'),
          group('基本群 (1群)', 'Trivial group (Group 1)'),
          group('自由群 (2群)', 'Free group (Group 2)'),
          group('正规群 (3群)', 'Normal group (Group 3)'),
          group('拓扑群 (4群)', 'Topological group (Group 4)'),
          group('有限单群 (5群)', 'Finite simple group (Group 5)'),
          group('庞加莱群 (6群)', 'Poincaré group (Group 6)'),
          group('李群 (7群)', 'Lie group (Group 7)'),
          group('阿贝尔群 (8群)', 'Abelian group (Group 8)'),
          group('魔群 (9群)', 'Magic group (Group 9)'),
          group('魔群 (10群)', 'Magic group (Group 10)'),
          group('b群 (11群)', 'b group (Group 11)'),
          group('12群 (12群)', 'Group 12'),
          group('13群 (13群)', 'Group 13'),
        ],
      },
      {
        title: group('兴趣与生活', 'Interests and life'),
        groups: [
          group('韭菜', 'Chives'),
          group('编程', 'Programming'),
          group('摄影', 'Photography'),
          group('航空', 'Aviation'),
          group('外语', 'Languages'),
          group('小学初中', 'Primary and middle school'),
          group('高中大学', 'High school and university'),
          group('游戏', 'Gaming'),
          group('双拼', 'Double Pinyin'),
          group('电影音乐棋牌', 'Movies, music and games'),
          group('气象', 'Meteorology'),
        ],
      },
    ],
  },
  {
    id: 'regional-groups',
    title: group('地区群', 'Regional groups'),
    description: group('按大区、城市与海外地区寻找身边的魔友。', 'Find nearby cubers by region, city or overseas area.'),
    blocks: [
      {
        title: group('大区', 'Regions'),
        groups: [
          group('华东', 'East China'),
          group('华南', 'South China'),
          group('华北', 'North China'),
          group('华中', 'Central China'),
          group('东北', 'Northeast China'),
          group('西南', 'Southwest China'),
          group('西北', 'Northwest China'),
        ],
      },
      {
        title: group('城市与地区', 'Cities and areas'),
        groups: [
          group('上海', 'Shanghai'),
          group('杭州', 'Hangzhou'),
          group('宁波', 'Ningbo'),
          group('温州', 'Wenzhou'),
          group('云南', 'Yunnan'),
          group('南京', 'Nanjing'),
          group('新疆', 'Xinjiang'),
          group('湖南', 'Hunan'),
          group('威海', 'Weihai'),
          group('西安', "Xi'an"),
        ],
      },
      {
        title: group('海外', 'Overseas'),
        groups: [
          group('海外大群', 'Overseas main group'),
          group('澳洲', 'Australia'),
          group('欧洲', 'Europe'),
          group('北美', 'North America'),
          group('亚洲', 'Asia'),
        ],
      },
    ],
  },
  {
    id: 'event-groups',
    title: group('项目群', 'Event groups'),
    description: group('按魔方项目、比赛形式与方法交流。', 'Talk by puzzle, competition format or method.'),
    blocks: [
      {
        title: group('项目与方法', 'Events and methods'),
        groups: [
          group('二阶', '2×2'),
          group('五魔', 'Megaminx'),
          group('高阶', 'Big cubes'),
          group('盲拧', 'Blindfolded'),
          group('盲拧萌新', 'Blindfolded beginners'),
          group('盲拧818', 'BLD 818'),
          group('金字塔', 'Pyraminx'),
          group('斜转', 'Skewb'),
          group('SQ1', 'Square-1'),
          group('魔表', 'Clock'),
          group('最少步', 'Fewest Moves'),
          group('异形Mod', 'Shape mods'),
          group('线上比赛', 'Online competitions'),
          group('虚拟', 'Virtual cubing'),
          group('镜面', 'Mirror cubes'),
          group('花式', 'Freestyle'),
        ],
      },
    ],
  },
  {
    id: 'method-groups',
    title: group('方法阶段群', 'Method and stage groups'),
    description: group('围绕解法、阶段训练与成绩目标展开讨论。', 'Discuss methods, training stages and time goals.'),
    blocks: [
      {
        title: group('方法与阶段', 'Methods and stages'),
        groups: [
          group('桥式', 'Roux'),
          group('ZZ,Petrus', 'ZZ and Petrus'),
          group('Mehta', 'Mehta'),
          group('S流', 'S-flow'),
          group('调试', 'Debugging'),
          group('Sub12', 'Sub-12'),
          group('Sub20', 'Sub-20'),
          group('CFOP', 'CFOP'),
          group('Cross+1', 'Cross + 1'),
          group('F2L', 'F2L'),
          group('顶层', 'Last layer'),
          group('记忆', 'Memory'),
        ],
      },
    ],
  },
  {
    id: 'community-groups',
    title: group('其他群', 'Other groups'),
    description: group('交易、内容平台、老师与不同阶段魔友的交流群。', 'Groups for trading, content platforms, teachers and cubers at different stages.'),
    blocks: [
      {
        title: group('社区', 'Community'),
        groups: [
          group('表情包', 'Stickers and memes'),
          group('二手1', 'Secondhand 1'),
          group('二手2', 'Secondhand 2'),
          group('萌新（超过30秒）', 'Beginners (over 30 seconds)'),
          group('老魔友（10年以前入魔）', 'Long-time cubers (started over 10 years ago)'),
          group('全国魔方老师总群', 'National cube teachers'),
          group('抖音', 'Douyin'),
          group('B站', 'Bilibili'),
        ],
      },
    ],
  },
];

function GroupName({ name }: { name: Bi }) {
  return (
    <li>
      <T
        zh={name.zh}
        en={<><span>{name.en}</span><small>{name.zh}</small></>}
      />
    </li>
  );
}

export default function ContactPage() {
  return (
    <main className="contact-page">
      <header className="contact-header">
        <BackHome />
        <p className="contact-eyebrow">{tr({ zh: '联系与社群', en: 'CONTACT & COMMUNITY' })}</p>
        <h1>{tr({ zh: '联系方式', en: 'Contact' })}</h1>
        <p className="contact-intro">{tr({
          zh: '添加我的微信，或从地区、项目和方法训练等分类中找到适合你的群。',
          en: 'Add me on WeChat, or find a group for your region, puzzle, training method or other interests.',
        })}</p>
      </header>

      <section className="contact-profile" aria-labelledby="contact-profile-title">
        <div className="contact-profile-copy">
          <h2 id="contact-profile-title">{tr({ zh: '联系我', en: 'Contact me' })}</h2>
          <p>{tr({
            zh: '微信扫码添加我，也可以通过 CubeRoot 网站找到我。',
            en: 'Scan the QR code to add me on WeChat, or find me through the CubeRoot website.',
          })}</p>
          <span className="contact-site-label">{tr({ zh: '网站', en: 'Website' })}</span>
          <AppLink href="/" className="contact-site">cuberoot.me</AppLink>
          <ContactDetails />
        </div>
        <img
          className="contact-qr"
          src="/contact/ruimin-wechat-qr.jpg"
          alt={tr({ zh: '魔方根微信二维码', en: 'WeChat QR code for Ruimin Yan' })}
          loading="lazy"
          decoding="async"
        />
      </section>

      <section className="contact-join" aria-labelledby="contact-join-title">
        <h2 id="contact-join-title">{tr({ zh: '进群方法', en: 'How to join' })}</h2>
        <p>
          <T
            zh={<>添加微信 <strong>mofanggen</strong>，回复你想要进的群。</>}
            en={<>Add <strong>mofanggen</strong> on WeChat and reply with the group you want to join.</>}
          />
        </p>
      </section>

      <div className="contact-directory">
        {SECTIONS.map((section, sectionIndex) => (
          <section className="contact-section" aria-labelledby={section.id} key={section.id}>
            <div className="contact-section-heading">
              <span aria-hidden>{String(sectionIndex + 1).padStart(2, '0')}</span>
              <div>
                <h2 id={section.id}>{tr(section.title)}</h2>
                <p>{tr(section.description)}</p>
              </div>
            </div>

            <div className="contact-blocks">
              {section.blocks.map((block) => (
                <div className="contact-block" key={block.title.zh}>
                  <h3>{tr(block.title)}</h3>
                  <ul className="contact-list">
                    {block.groups.map((name) => <GroupName name={name} key={name.zh} />)}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
