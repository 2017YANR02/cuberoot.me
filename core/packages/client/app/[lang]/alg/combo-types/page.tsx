'use client';

import Link from '@/components/AppLink';
import { tr } from '@/i18n/tr';
import { ALG_COMBO_TYPES, algComboTypeAnchor, algComboTypeHref } from '@/lib/alg_combo_types';
import '../alg.css';

const BASE_ABBREVIATIONS = [
  { code: 'OLL', name: { zh: '顶层朝向（Orientation of the Last Layer）', en: 'Orientation of the Last Layer' } },
  { code: 'PLL', name: { zh: '顶层排列（Permutation of the Last Layer）', en: 'Permutation of the Last Layer' } },
  { code: 'F2L', name: { zh: '前两层（First Two Layers）', en: 'First Two Layers' } },
  { code: 'WV', name: { zh: '冬日变奏曲（Winter Variation）', en: 'Winter Variation' } },
  { code: 'ZBLS', name: { zh: 'Zborowski-Bruchem 末槽（Zborowski-Bruchem Last Slot）', en: 'Zborowski-Bruchem Last Slot' } },
] as const;

export default function AlgComboTypesPage() {
  const sourceTypes = ALG_COMBO_TYPES.filter(type => type.documentedBySource);
  const supplementaryTypes = ALG_COMBO_TYPES.filter(type => !type.documentedBySource);

  return (
    <main className="alg-combo-types-page">
      <h1>{tr({ zh: '公式叠加类型', en: 'Algorithm Combo Types' })}</h1>
      <p className="alg-combo-types-lead">
        {tr({
          zh: '叠加类型描述一条公式由哪些公式片段或手法组合而成。它描述的是公式写法，不是 case 本身的固定分类；同一个 case 换一条公式后，叠加类型也可能改变。',
          en: 'A combo type describes the algorithm fragments or techniques used to build an algorithm. It describes the algorithm, not an intrinsic category of the case, so a different algorithm for the same case may have a different combo type.',
        })}
      </p>

      <section aria-labelledby="combo-base-abbreviations">
        <h2 id="combo-base-abbreviations">{tr({ zh: '基础缩写', en: 'Base abbreviations' })}</h2>
        <dl className="alg-combo-abbr-list">
          {BASE_ABBREVIATIONS.map(item => (
            <div key={item.code}>
              <dt><code>{item.code}</code></dt>
              <dd>{tr(item.name)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <TypeSection
        id="source-combo-types"
        title={tr({ zh: '原表定义的 13 种类型', en: '13 types defined by the source sheet' })}
        types={sourceTypes}
      />
      <p className="alg-combo-source-note">
        {tr({ zh: '这些全称来自', en: 'These expansions come from the ' })}
        <a
          href="https://docs.google.com/spreadsheets/d/1I2McWXVQZxGRVmrVEJDub9r_NPTNdPs6C7jriodyG1E"
          target="_blank"
          rel="noopener noreferrer"
        >
          {tr({ zh: '原始 1LLL 表的 Combo alg type 图例', en: 'Combo alg type legend in the original 1LLL sheet' })}
        </a>
        {tr({ zh: '。', en: '.' })}
      </p>

      <section aria-labelledby="supplementary-combo-types">
        <h2 id="supplementary-combo-types">
          {tr({ zh: '补充说明的 5 种标记', en: '5 supplementary labels' })}
        </h2>
        <div className="alg-combo-types-grid">
          {supplementaryTypes.map(type => <TypeEntry key={type.code} type={type} />)}
        </div>
        <p className="alg-combo-source-note">
          {tr({
            zh: 'MU、S、SM、SO 和 ? 出现在当前数据中，但未列入原表图例。这里的全称是根据相应公式的转动结构补充的描述，不冒充原作者定义。',
            en: 'MU, S, SM, SO, and ? occur in the current data but are absent from the source legend. Their names here describe the move structure of the corresponding algorithms and are not presented as author-defined expansions.',
          })}
        </p>
      </section>
    </main>
  );
}

function TypeSection({ id, title, types }: {
  id: string;
  title: string;
  types: readonly (typeof ALG_COMBO_TYPES)[number][];
}) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <div className="alg-combo-types-grid">
        {types.map(type => <TypeEntry key={type.code} type={type} />)}
      </div>
    </section>
  );
}

function TypeEntry({ type }: { type: (typeof ALG_COMBO_TYPES)[number] }) {
  const anchor = algComboTypeAnchor(type.code);
  return (
    <article className="alg-combo-type" id={anchor}>
      <h3>
        <Link href={algComboTypeHref(type.code)} prefetch={false}>
          <code>{type.code}</code> {tr(type.fullName)}
        </Link>
      </h3>
      <p>{comboMeaning(type.code)}</p>
    </article>
  );
}

function comboMeaning(code: string): string {
  const meanings: Record<string, { zh: string; en: string }> = {
    CC: { zh: '用共轭手法包裹一个换位子。', en: 'A commutator wrapped in a conjugating setup and undo.' },
    OO: { zh: '由两个 OLL 片段组合而成。', en: 'Combines two OLL segments.' },
    OP: { zh: '先使用 OLL 片段，再使用 PLL 片段。', en: 'Uses an OLL segment followed by a PLL segment.' },
    PO: { zh: '先使用 PLL 片段，再使用 OLL 片段。', en: 'Uses a PLL segment followed by an OLL segment.' },
    WW: { zh: '由两个 WV 片段组合而成。', en: 'Combines two WV segments.' },
    FW: { zh: '由 F2L 片段与 WV 片段组合而成。', en: 'Combines an F2L segment with a WV segment.' },
    FZ: { zh: '由 F2L 片段与 ZBLS 片段组合而成。', en: 'Combines an F2L segment with a ZBLS segment.' },
    ZZ: { zh: '由两个 ZBLS 片段组合而成。', en: 'Combines two ZBLS segments.' },
    OI: { zh: '在 OLL 手法中加入插入步骤。', en: 'Adds an insertion to an OLL technique.' },
    PI: { zh: '在 PLL 手法中加入插入步骤。', en: 'Adds an insertion to a PLL technique.' },
    OS: { zh: '先转化成 OLL 情况，再完成公式。', en: 'Sets up to an OLL case before finishing the algorithm.' },
    PS: { zh: '先转化成 PLL 情况，再完成公式。', en: 'Sets up to a PLL case before finishing the algorithm.' },
    TR: { zh: '由常见短手法（trigger）组合而成。', en: 'Combines familiar short move triggers.' },
    MU: { zh: '公式主要使用 M 中层与 U 层转动。', en: 'Primarily uses M-slice and U-layer moves.' },
    S: { zh: '公式主要使用 S 中层转动。', en: 'Primarily uses S-slice moves.' },
    SM: { zh: '组合 S 中层转动与 M/U 转动。', en: 'Combines S-slice moves with M/U moves.' },
    SO: { zh: '组合 S 中层转动与 OLL 片段。', en: 'Combines S-slice moves with an OLL segment.' },
    '?': { zh: '原数据暂未归类。', en: 'Not yet classified in the source data.' },
  };
  return tr(meanings[code] ?? { zh: '暂无说明。', en: 'No description available.' });
}
