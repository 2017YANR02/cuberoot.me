'use client';

import PageBackLink from '@/components/PageBackLink';
import Link from '@/components/AppLink';
import MoreToggle from '@/components/MoreToggle';
import { useT } from '@/hooks/useT';
import { tr } from '@/i18n/tr';
import ReferenceCatalog from '../_shared/ReferenceCatalog';
import { CATALOG, CATEGORIES, EXTRA_DEMOS } from './_catalog';
import './components_gallery.css';

export default function CodeComponentsPage() {
  const t = useT();
  return <main className="cg dev-reference-page">
    <header className="dev-reference-page-heading">
      <PageBackLink fallback="/dev" />
      <h1>{t('组件库', 'Component library')}</h1>
    </header>
    <ReferenceCatalog directoryLabel={t('组件目录', 'Component directory')} entries={CATALOG} categories={CATEGORIES}
      searchText={entry => `${entry.import} ${entry.usage ?? ''} ${entry.note?.zh ?? ''} ${entry.note?.en ?? ''}`}>
      {entry => {
        const Demo = entry.Demo ?? EXTRA_DEMOS[entry.name];
        return <>
          <h3>{t('导入', 'Import')}</h3><pre><code>{entry.import}</code></pre>
          {entry.usage && <><h3>{t('用法', 'Usage')}</h3><pre><code>{entry.usage}</code></pre></>}
          {entry.note && <><h3>{t('使用约定', 'Usage notes')}</h3><p>{tr(entry.note)}</p></>}
          {Demo && <><h3>{t('交互示例', 'Interactive example')}</h3><div className="dev-reference-demo"><Demo /></div></>}
        </>;
      }}
    </ReferenceCatalog>
    <footer className="dev-reference-page-footer"><Link href="/dev/utils">{t('Hooks 与工具函数', 'Hooks & utilities')}</Link>
    <details className="dev-reference-maintenance">
      <MoreToggle as="summary">{t('维护组件目录', 'Maintaining the catalog')}</MoreToggle>
      <p>{t('组件登记在 _catalog.tsx。保留双语用途、导入路径和必要限制；能独立运行的组件可补充示例，需要业务数据或权限的组件保留接入说明。', 'Register components in _catalog.tsx with bilingual purposes, imports and constraints. Add demos for standalone components and integration notes for those requiring business data or permissions.')}</p>
    </details>
    </footer>
  </main>;
}
