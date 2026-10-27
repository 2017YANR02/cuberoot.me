'use client';

import { CareersBrowser } from '@app-foundation/careers-ui';
import { CONTACT_WECHAT_ID } from '@cuberoot/shared/contact';
import { ChevronRight } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import BackHome from '@/components/BackHome';
import { ClearButton } from '@/components/ClearButton';
import { tr } from '@/i18n/tr';
import { careerPositions } from './positions';

export default function CareersPage() {
  const positions = careerPositions.map(position => ({
    id: position.id, title: tr(position.title), category: tr(position.category),
    searchText: [position.title, position.category, position.summary, ...position.responsibilities, ...position.requirements, ...position.advantages].flatMap(text => [text.zh, text.en]).join(' '),
  }));
  return <main className="careers-page">
    <header className="careers-header"><BackHome /><h1>{tr({ zh: '加入我们', en: 'Careers' })}</h1></header>
    <img className="careers-hero" src="/images/careers/shanghai-cuberoot.jpg" width={1672} height={941} alt={tr({ zh: '夕阳下的上海天际线与魔方根标志', en: 'The CubeRoot symbol against the Shanghai skyline at sunset' })} />
    <section className="careers-intro" aria-labelledby="careers-intro-heading">
      <h2 id="careers-intro-heading">{tr({ zh: 'AI Coding × 魔方 × 内容运营', en: 'AI Coding × Cubing × Content' })}</h2>
      <p>{tr({ zh: '仅限上海，办公地点在上海阿里巴巴徐汇滨江园区。', en: 'Shanghai only. Our office is at Alibaba Xuhui Riverside Campus, Shanghai.' })}</p>
      <p>{tr({ zh: '想找一位热爱魔方、喜欢折腾 AI，也对市场营销、直播和互联网感兴趣的小伙伴，一起把想法做成产品，让更多人了解和喜欢魔方。', en: 'We are looking for someone who loves cubing and exploring AI, and is interested in marketing, live streaming and the internet. Together, we can turn ideas into products and introduce more people to cubing.' })}</p>
      <div className="careers-intro-grid">
        <section><h3>{tr({ zh: '希望你', en: 'What we hope you bring' })}</h3><ul>
          <li>{tr({ zh: '热爱魔方，或有魔方还原基础，不要求竞速成绩。', en: 'A love of cubing or the ability to solve a cube; no speedcubing results are required.' })}</li>
          <li>{tr({ zh: '具备 AI Coding 能力，能用 AI 辅助开发网页、小工具或自动化流程，完成基本的调试和验证。', en: 'AI Coding skills to build web pages, small tools or automated workflows, including basic debugging and verification.' })}</li>
          <li>{tr({ zh: '对市场营销、直播和互联网有一定了解，理解内容传播、用户需求和平台运营，有实操经验更好。', en: 'Some understanding of marketing, live streaming and the internet, including content distribution, user needs and platform practices; hands-on experience is a plus.' })}</li>
          <li>{tr({ zh: '主动靠谱，愿意学习，能把想法推进到落地。', en: 'Initiative, reliability and a willingness to learn and turn ideas into results.' })}</li>
        </ul></section>
        <section><h3>{tr({ zh: '你会参与', en: 'What you will work on' })}</h3><ul>
          <li>{tr({ zh: '用 AI 开发和完善魔方相关产品、工具。', en: 'Use AI to develop and improve cubing products and tools.' })}</li>
          <li>{tr({ zh: '策划魔方内容，参与社交平台运营与推广。', en: 'Plan cubing content and help operate and promote social channels.' })}</li>
          <li>{tr({ zh: '参与直播策划、执行和互动。', en: 'Help plan and run live streams and engage with viewers.' })}</li>
          <li>{tr({ zh: '根据用户反馈，改进产品和运营方式。', en: 'Use feedback to improve products and operations.' })}</li>
        </ul></section>
      </div>
      <p>{tr({ zh: '不要求样样精通，更看重你的兴趣、学习能力和实际行动。有个人作品、运营账号、直播经历，或做过有意思的 AI 项目，都欢迎带来聊聊。', en: 'You do not need to be an expert in everything. We value curiosity, the ability to learn and practical initiative. Personal projects, accounts you have managed, live-streaming experience and interesting AI projects are all welcome.' })}</p>
      <p>{tr({ zh: '感兴趣请私信微信', en: 'Interested? Message us on WeChat' })} <strong>{CONTACT_WECHAT_ID}</strong>{tr({ zh: '，简单介绍自己，附上作品或相关经历。', en: ' with a short introduction and examples of your work or relevant experience.' })}</p>
    </section>
    <CareersBrowser positions={positions}
      labels={{ filters: tr({ zh: '职位筛选', en: 'Position filters' }), search: tr({ zh: '职位搜索', en: 'Search positions' }), placeholder: tr({ zh: '搜索职位关键词', en: 'Search by keyword' }), categories: tr({ zh: '职位类别', en: 'Category' }), results: tr({ zh: '职位列表', en: 'Open positions' }), empty: tr({ zh: '没有匹配的职位。', en: 'No matching positions.' }), clearFilters: tr({ zh: '清除筛选', en: 'Clear filters' }) }}
      classes={{ browser: 'careers-browser', filters: 'careers-filters', searchWrap: 'careers-search', search: 'careers-search-input', filterRow: 'careers-filter', results: 'careers-positions', empty: 'careers-empty' }}
      renderClear={clear => <ClearButton className="careers-search-clear" onClick={clear} />}
      renderPosition={position => <AppLink className="careers-position" href={`/careers/${position.id}`} prefetch={false}><div><h3>{position.title}</h3><p>{position.category}</p></div><ChevronRight size={20} aria-hidden="true" /></AppLink>}
    />
  </main>;
}
