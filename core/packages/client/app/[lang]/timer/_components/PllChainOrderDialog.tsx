'use client';

import { useMemo, useState } from 'react';
import type { AlgCase } from '@cuberoot/shared/alg';
import { AlgCaseOrderGrid } from '@/components/AlgCaseOrderGrid';
import SettingsDialog from '@/components/SettingsDialog';
import { caseMap } from '@/lib/alg-time-attack-order';
import { tr } from '@/i18n/tr';
import './pll-chain-progress.css';

export default function PllChainOrderDialog({ order, cases, defaults, onSave, onClose }: {
  order: string[]; cases: AlgCase[]; defaults: string[]; onSave(keys: string[]): void; onClose(): void;
}) {
  const [draft, setDraft] = useState(order);
  const byKey = useMemo(() => caseMap(cases), [cases]);
  return <SettingsDialog heading label={tr({ zh: '调整顺序', en: 'Edit order' })} panelClassName="pll-chain-dialog" onClose={onClose}>
    {close => <>
      <AlgCaseOrderGrid compact cases={draft.flatMap(key => byKey.get(key) ?? [])} order={draft}
        puzzle="3x3" setSlug="pll" onChange={setDraft} />
      <footer>
        <button type="button" className="pll-chain-action" onClick={() => setDraft(defaults)}>{tr({ zh: '恢复默认', en: 'Reset order' })}</button>
        <button type="button" className="pll-chain-action" onClick={close}>{tr({ zh: '取消', en: 'Cancel' })}</button>
        <button type="button" className="pll-chain-action pll-chain-primary" onClick={() => { onSave(draft); close(); }}>{tr({ zh: '保存', en: 'Save' })}</button>
      </footer>
    </>}
  </SettingsDialog>;
}


