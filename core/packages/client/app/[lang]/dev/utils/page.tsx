'use client';

import PageBackLink from '@/components/PageBackLink';
import Link from '@/components/AppLink';
import MoreToggle from '@/components/MoreToggle';
import { useT } from '@/hooks/useT';
import ReferenceCatalog from '../_shared/ReferenceCatalog';
import { CATALOG, UCATS } from './_catalog';

export default function CodeUtilsPage() {
  const t = useT();
  return <main className="dev-reference-page">
    <header className="dev-reference-page-heading">
      <PageBackLink fallback="/dev" />
      <h1>{t('Hooks 与工具函数', 'Hooks & utilities')}</h1>
    </header>
    <ReferenceCatalog directoryLabel={t('工具目录', 'Utility directory')} entries={CATALOG} categories={UCATS} searchText={entry => `${entry.sig} ${entry.imp} ${entry.usage ?? ''}`}>
      {entry => <>
        <h3>{t('类型签名', 'Type signature')}</h3><pre><code>{entry.sig}</code></pre>
        <h3>{t('导入', 'Import')}</h3><pre><code>{entry.imp}</code></pre>
        {entry.usage && <><h3>{t('调用示例', 'Example')}</h3><pre><code>{entry.usage}</code></pre></>}
      </>}
    </ReferenceCatalog>
    <footer className="dev-reference-page-footer"><Link href="/dev/components">{t('组件库', 'Component library')}</Link>
    <details className="dev-reference-maintenance">
      <MoreToggle as="summary">{t('维护工具目录', 'Maintaining the catalog')}</MoreToggle>
      <p>{t('目录由 _catalog.tsx 提供。新增或修改公共工具时，同步用途、真实类型签名与导入路径；参数约束和调用示例随条目保留。', 'The catalog comes from _catalog.tsx. Keep purposes, actual type signatures and imports in sync when public utilities change, including constraints and examples.')}</p>
    </details>
    </footer>
  </main>;
}
