'use client';

import { CareersBrowser } from '@app-foundation/careers-ui';
import { ChevronRight } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import BackHome from '@/components/BackHome';
import { ClearButton } from '@/components/ClearButton';
import { tr } from '@/i18n/tr';
import { careerPositions, careerLocation, careerWorkDescription } from './positions';

export default function CareersPage() {
  const positions = careerPositions.map(position => ({
    id: position.id, title: tr(position.title), category: tr(position.category),
    searchText: [position.title, position.category, position.summary, careerLocation, ...position.responsibilities, ...position.requirements, ...position.advantages].flatMap(text => [text.zh, text.en]).join(' '),
  }));
  return <main className="careers-page">
    <header className="careers-header"><BackHome /><h1>{tr({ zh: '加入我们', en: 'Careers' })}</h1></header>
    <img className="careers-hero" src="/images/careers/shanghai-cuberoot.jpg" width={1672} height={941} alt={tr({ zh: '夕阳下的上海天际线与魔方根标志', en: 'The CubeRoot symbol against the Shanghai skyline at sunset' })} />
    <section className="careers-intro" aria-labelledby="careers-intro-heading">
      <h2 id="careers-intro-heading">{tr({ zh: 'AI Coding × 魔方 × 内容运营', en: 'AI Coding × Cubing × Content' })}</h2>
      <p>{tr(careerWorkDescription)}</p>
      <p>{tr({ zh: '热爱魔方，愿意学习 AI 工具，主动沟通、认真做事。不必样样精通，有开发、运营或剪辑作品更好。', en: 'Love cubing, be willing to learn AI tools, communicate proactively and take care in your work. You do not need to know everything; development, content or video projects are a plus.' })}</p>
    </section>
    <CareersBrowser positions={positions}
      labels={{ filters: tr({ zh: '职位筛选', en: 'Position filters' }), search: tr({ zh: '职位搜索', en: 'Search positions' }), placeholder: tr({ zh: '搜索职位关键词', en: 'Search by keyword' }), categories: tr({ zh: '职位类别', en: 'Category' }), results: tr({ zh: '职位列表', en: 'Open positions' }), empty: tr({ zh: '没有匹配的职位。', en: 'No matching positions.' }), clearFilters: tr({ zh: '清除筛选', en: 'Clear filters' }) }}
      classes={{ browser: 'careers-browser', filters: 'careers-filters', searchWrap: 'careers-search', search: 'careers-search-input', filterRow: 'careers-filter', results: 'careers-positions', empty: 'careers-empty' }}
      renderClear={clear => <ClearButton className="careers-search-clear" onClick={clear} />}
      renderPosition={position => <AppLink className="careers-position" href={`/careers/${position.id}`} prefetch={false}><div><h3>{position.title}</h3><p>{position.category} · {tr(careerLocation)}</p></div><ChevronRight size={20} aria-hidden="true" /></AppLink>}
    />
  </main>;
}
