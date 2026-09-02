export interface ContactText {
  en: string;
  zh: string;
}

export type ContactPlatformLanguage = 'en' | 'zh';

export type ContactPlatformId =
  | 'youtube'
  | 'tiktok'
  | 'instagram'
  | 'bilibili'
  | 'douyin'
  | 'xiaohongshu'
  | 'kuaishou'
  | 'wechat-official';

export type ContactDirectDetailId = 'author' | 'wechat' | 'qq' | 'email' | 'discord';

export interface ContactDirectDetail {
  action: 'none' | 'copy' | 'link';
  href: string | null;
  id: ContactDirectDetailId;
  label: ContactText;
  showQr: boolean;
  value: ContactText | null;
}

export interface ContactPlatform {
  account: string;
  count: ContactText | null;
  href: string | null;
  id: ContactPlatformId;
  label: ContactText;
  language: ContactPlatformLanguage;
}

export interface ContactGroupBlock {
  groups: readonly ContactText[];
  title: ContactText;
}

export interface ContactGroupSection {
  blocks: readonly ContactGroupBlock[];
  description: ContactText;
  id: string;
  title: ContactText;
}

const text = (zh: string, en: string): ContactText => ({ en, zh });

export const CONTACT_WEBSITE = 'cuberoot.me';
export const CONTACT_WECHAT_ID = 'mofanggen';
export const CONTACT_QQ = '164422421';
export const CONTACT_EMAIL = 'ruiminyan@cuberoot.me';
export const CONTACT_DISCORD_URL = 'https://discord.gg/Zp5qmrk';
export const CONTACT_WECHAT_QR_PATH = '/contact/ruimin-wechat-qr.jpg';
export const CONTACT_AUTHOR = text('颜瑞民', 'Ruimin Yan');

export const CONTACT_DIRECT_DETAILS: readonly ContactDirectDetail[] = [
  {
    action: 'none',
    href: null,
    id: 'author',
    label: text('作者', 'Author'),
    showQr: false,
    value: CONTACT_AUTHOR,
  },
  {
    action: 'copy',
    href: null,
    id: 'wechat',
    label: text('微信', 'WeChat'),
    showQr: true,
    value: text(CONTACT_WECHAT_ID, CONTACT_WECHAT_ID),
  },
  {
    action: 'copy',
    href: null,
    id: 'qq',
    label: text('QQ', 'QQ'),
    showQr: false,
    value: text(CONTACT_QQ, CONTACT_QQ),
  },
  {
    action: 'copy',
    href: null,
    id: 'email',
    label: text('邮箱', 'Email'),
    showQr: false,
    value: text(CONTACT_EMAIL, CONTACT_EMAIL),
  },
  {
    action: 'link',
    href: CONTACT_DISCORD_URL,
    id: 'discord',
    label: text('Discord', 'Discord'),
    showQr: false,
    value: null,
  },
];

export const CONTACT_JOIN_INSTRUCTION = text(
  `添加微信 ${CONTACT_WECHAT_ID}，回复你想要进的群。`,
  `Add ${CONTACT_WECHAT_ID} on WeChat and reply with the group you want to join.`,
);

export const CONTACT_SOCIAL_PLATFORMS: readonly ContactPlatform[] = [
  {
    id: 'youtube',
    language: 'en',
    href: 'https://www.youtube.com/@cuberootme',
    label: text('YouTube', 'YouTube'),
    account: 'CubeRoot',
    count: text('13万粉', '130K followers'),
  },
  {
    id: 'tiktok',
    language: 'en',
    href: 'https://www.tiktok.com/@cuberoot_official',
    label: text('TikTok', 'TikTok'),
    account: 'CubeRoot',
    count: text('6600粉', '6.6K followers'),
  },
  {
    id: 'instagram',
    language: 'en',
    href: 'https://www.instagram.com/ruimin_yan/',
    label: text('Instagram', 'Instagram'),
    account: 'ruimin_yan',
    count: null,
  },
  {
    id: 'douyin',
    language: 'zh',
    href: 'https://www.douyin.com/user/MS4wLjABAAAAXMbfAj9bF8q2JYp6qG2J5KjY5yCsBpZ0gFv0P9btJUQ',
    label: text('抖音', 'Douyin'),
    account: '魔方根',
    count: text('11万粉', '110K followers'),
  },
  {
    id: 'bilibili',
    language: 'zh',
    href: 'https://space.bilibili.com/432490072',
    label: text('哔哩哔哩', 'Bilibili'),
    account: '魔方根',
    count: text('10万粉', '100K followers'),
  },
  {
    id: 'wechat-official',
    language: 'zh',
    href: null,
    label: text('公众号/视频号', 'WeChat Official Account / Channels'),
    account: '魔方根',
    count: text('5.5万粉', '55K followers'),
  },
  {
    id: 'kuaishou',
    language: 'zh',
    href: 'https://www.kuaishou.com/profile/3xmtr3va626wq2c',
    label: text('快手', 'Kuaishou'),
    account: '魔方根',
    count: text('2.2万粉', '22K followers'),
  },
  {
    id: 'xiaohongshu',
    language: 'zh',
    href: 'https://www.xiaohongshu.com/user/profile/61075b3d000000002002f6f8',
    label: text('小红书', 'Xiaohongshu'),
    account: '魔方根',
    count: text('1800粉', '1.8K followers'),
  },
];

export const CONTACT_GROUP_SECTIONS: readonly ContactGroupSection[] = [
  {
    id: 'cuberoot-groups',
    title: text('魔方根群', 'CubeRoot groups'),
    description: text('魔方根主群、高级群与兴趣交流子群。', 'CubeRoot main, advanced and interest groups.'),
    blocks: [
      {
        title: text('主群与高级群', 'Main and advanced groups'),
        groups: [
          text('CUBEROOT开发者群', 'CUBEROOT developer group'),
          text('VIP群 (付费)', 'VIP group (paid)'),
          text('换位子群 (高级群)', 'Commutator group (advanced)'),
          text('基本群 (1群)', 'Trivial group (Group 1)'),
          text('自由群 (2群)', 'Free group (Group 2)'),
          text('正规群 (3群)', 'Normal group (Group 3)'),
          text('拓扑群 (4群)', 'Topological group (Group 4)'),
          text('有限单群 (5群)', 'Finite simple group (Group 5)'),
          text('庞加莱群 (6群)', 'Poincaré group (Group 6)'),
          text('李群 (7群)', 'Lie group (Group 7)'),
          text('阿贝尔群 (8群)', 'Abelian group (Group 8)'),
          text('魔群 (9群)', 'Magic group (Group 9)'),
          text('魔群 (10群)', 'Magic group (Group 10)'),
          text('b群 (11群)', 'b group (Group 11)'),
          text('12群 (12群)', 'Group 12'),
          text('13群 (13群)', 'Group 13'),
        ],
      },
      {
        title: text('兴趣与生活', 'Interests and life'),
        groups: [
          text('韭菜', 'Chives'),
          text('编程', 'Programming'),
          text('摄影', 'Photography'),
          text('航空', 'Aviation'),
          text('外语', 'Languages'),
          text('小学初中', 'Primary and middle school'),
          text('高中大学', 'High school and university'),
          text('游戏', 'Gaming'),
          text('双拼', 'Double Pinyin'),
          text('电影音乐棋牌', 'Movies, music and games'),
          text('气象', 'Meteorology'),
        ],
      },
    ],
  },
  {
    id: 'regional-groups',
    title: text('地区群', 'Regional groups'),
    description: text('按大区、城市与海外地区寻找身边的魔友。', 'Find nearby cubers by region, city or overseas area.'),
    blocks: [
      {
        title: text('大区', 'Regions'),
        groups: [
          text('华东', 'East China'),
          text('华南', 'South China'),
          text('华北', 'North China'),
          text('华中', 'Central China'),
          text('东北', 'Northeast China'),
          text('西南', 'Southwest China'),
          text('西北', 'Northwest China'),
        ],
      },
      {
        title: text('城市与地区', 'Cities and areas'),
        groups: [
          text('上海', 'Shanghai'),
          text('温州', 'Wenzhou'),
          text('云南', 'Yunnan'),
        ],
      },
      {
        title: text('海外', 'Overseas'),
        groups: [
          text('海外大群', 'Overseas main group'),
          text('澳洲', 'Australia'),
          text('欧洲', 'Europe'),
          text('北美', 'North America'),
          text('亚洲', 'Asia'),
        ],
      },
    ],
  },
  {
    id: 'event-groups',
    title: text('项目群', 'Event groups'),
    description: text('按魔方项目、比赛形式与方法交流。', 'Talk by puzzle, competition format or method.'),
    blocks: [
      {
        title: text('项目与方法', 'Events and methods'),
        groups: [
          text('二阶', '2×2'),
          text('五魔', 'Megaminx'),
          text('高阶', 'Big cubes'),
          text('盲拧', 'Blindfolded'),
          text('盲拧萌新', 'Blindfolded beginners'),
          text('盲拧818', 'BLD 818'),
          text('金字塔', 'Pyraminx'),
          text('斜转', 'Skewb'),
          text('SQ1', 'Square-1'),
          text('魔表', 'Clock'),
          text('最少步', 'Fewest Moves'),
          text('异形Mod', 'Shape mods'),
          text('线上比赛', 'Online competitions'),
          text('虚拟', 'Virtual cubing'),
          text('镜面', 'Mirror cubes'),
          text('花式', 'Freestyle'),
          text('萌新（超过30秒）', 'Beginners (over 30 seconds)'),
        ],
      },
    ],
  },
  {
    id: 'method-groups',
    title: text('方法阶段群', 'Method and stage groups'),
    description: text('围绕解法、阶段训练与成绩目标展开讨论。', 'Discuss methods, training stages and time goals.'),
    blocks: [
      {
        title: text('方法与阶段', 'Methods and stages'),
        groups: [
          text('桥式', 'Roux'),
          text('ZZ,Petrus', 'ZZ and Petrus'),
          text('Mehta', 'Mehta'),
          text('S流', 'S-flow'),
          text('调试', 'Debugging'),
          text('Sub12', 'Sub-12'),
          text('Sub20', 'Sub-20'),
          text('CFOP', 'CFOP'),
          text('Cross+1', 'Cross + 1'),
          text('F2L', 'F2L'),
          text('顶层', 'Last layer'),
          text('记忆', 'Memory'),
        ],
      },
    ],
  },
  {
    id: 'community-groups',
    title: text('其他群', 'Other groups'),
    description: text('交易、内容平台、老师与不同阶段魔友的交流群。', 'Groups for trading, content platforms, teachers and cubers at different stages.'),
    blocks: [
      {
        title: text('社区', 'Community'),
        groups: [
          text('表情包', 'Stickers and memes'),
          text('二手1', 'Secondhand 1'),
          text('二手2', 'Secondhand 2'),
          text('老魔友（10年以前入魔）', 'Long-time cubers (started over 10 years ago)'),
          text('全国魔方老师总群', 'National cube teachers'),
          text('抖音', 'Douyin'),
          text('B站', 'Bilibili'),
        ],
      },
    ],
  },
];

export const CONTACT_GROUP_COUNT = CONTACT_GROUP_SECTIONS.reduce(
  (total, section) => total + section.blocks.reduce(
    (sectionTotal, block) => sectionTotal + block.groups.length,
    0,
  ),
  0,
);
