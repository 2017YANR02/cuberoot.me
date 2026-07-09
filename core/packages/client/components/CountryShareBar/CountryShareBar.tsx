'use client';

// 「各国占比」条:复用通用 StackedBar,段宽 ∝ 该国打乱数,点某国段 → 选中/取消(供上层按国筛选)。
// 数据 = 全量国家计数(非采样),故百分比准;尾部(top N 之外)折叠为「其他」,分母优先用直方图 bin 总数补差。
// 段身份 = WCA country_id(= comp_countries.json 的值 = wca_competitions.country_id);上层据此做
// 服务端(c.country_id=?)/ 客户端(compCountryId(id)===)精确筛选,展示走 countryToIso2 出国旗 + 译名。
// 复用处:/scramble/stats 难度页(非 3x3 puzzle + 3x3 族)每步数的国家分解。
import { Flag } from '@/components/Flag';
import StackedBar, { type StackedSeg } from '@/components/StackedBar/StackedBar';
import { countryToIso2 } from '@/lib/country-flags';
import { countryName } from '@/lib/country-name';
import { tr } from '@/i18n/tr';
import './CountryShareBar.css';

const MAX_SEGMENTS = 12;

function fmtPct(p: number): string {
  return p >= 9.95 ? `${Math.round(p)}%` : `${p.toFixed(1)}%`;
}

export default function CountryShareBar({
  counts, total, selected, onSelect, isZh,
}: {
  counts: Record<string, number>; // country_id -> 该步数打乱数
  total?: number;                 // 直方图 bin 总数(含未进 top 的尾);缺则退回已存计数之和
  selected: string | null;        // 选中的 country_id(null = 未筛)
  onSelect: (countryId: string | null) => void;
  isZh: boolean;
}) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const shown = entries.slice(0, MAX_SEGMENTS);
  const shownSum = shown.reduce((s, [, n]) => s + n, 0);
  const storedSum = entries.reduce((s, [, n]) => s + n, 0);
  const denom = total && total > 0 ? total : storedSum;
  const n = shown.length;
  const segs: StackedSeg[] = shown.map(([cid, cnt], i) => {
    const iso2 = countryToIso2(cid);
    const f = n > 1 ? i / (n - 1) : 0; // 暖(占比大)→冷渐变,同 /wca/results 国家条
    const pct = denom > 0 ? (cnt / denom) * 100 : 0;
    const display = iso2 ? countryName(iso2, isZh) : cid;
    return {
      key: cid,
      weight: cnt,
      color: `color-mix(in srgb, var(--accent) ${Math.round((1 - f) * 100)}%, var(--signal-success))`,
      title: `${display} · ${fmtPct(pct)} (${cnt.toLocaleString()})`,
      selected: selected === cid,
      dim: !!selected && selected !== cid,
      onClick: () => onSelect(selected === cid ? null : cid),
      label: (
        <>
          {iso2
            ? <Flag iso2={iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />
            : <span className="csbar-name">{cid}</span>}
          {pct >= 10 && <span className="csbar-pct">{fmtPct(pct)}</span>}
        </>
      ),
    };
  });
  const others = Math.max(0, denom - shownSum);
  if (others > 0) {
    const op = denom > 0 ? (others / denom) * 100 : 0;
    segs.push({
      key: '__other__',
      weight: others,
      dim: !!selected,
      color: 'color-mix(in srgb, var(--muted-foreground) 38%, transparent)',
      title: `${tr({ zh: '其他', en: 'Others' })} · ${fmtPct(op)}`,
      label: <span className="csbar-name">{tr({ zh: '其他', en: 'Others' })}</span>,
    });
  }
  return (
    <StackedBar
      segments={segs}
      total={denom}
      minLabelFrac={0.05}
      className="csbar"
      ariaLabel={tr({ zh: '各国占比', en: 'Country breakdown' })}
    />
  );
}
