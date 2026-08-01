'use client';

// /alg/3bld/lookup 的「显示选项」面板 —— 对齐上游 /settings 那批开关。
// 折叠形态与同目录 BldConfigBar 一致(同一套 .bld-config-* 样式),别再造第二种。

import { useState, type JSX } from 'react';
import { SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import BoolToggle from '@/components/BoolToggle';
import PillToggle from '@/components/PillToggle/PillToggle';
import { tr } from '@/i18n/tr';
import { useBlddbPrefsStore, type BlddbPrefs } from '../_store/blddb-prefs-store';

/** 换位子写法那一组 —— 键名与 commutatorPost 的参数同名,别改。 */
const COMM_SWITCHES: { key: keyof BlddbPrefs; label: { zh: string; en: string } }[] = [
  { key: 'slashNotation', label: { zh: '斜杠写法', en: 'Slash notation' } },
  { key: 'noBrackets', label: { zh: '去掉方括号', en: 'No brackets' } },
  { key: 'spaceAfterColon', label: { zh: '冒号后空格', en: 'Space after colon' } },
  { key: 'spaceAfterComma', label: { zh: '逗号后空格', en: 'Space after comma' } },
  { key: 'outerBrackets', label: { zh: '最外层加括号', en: 'Outer brackets' } },
];

interface Props {
  /** 这个类型有没有换位子列 —— 没有就别显示那一组开关。 */
  showComm: boolean;
  /** 这个类型有没有逆 case。 */
  showInverse: boolean;
  /** 这个类型算不算起手(高阶不算,见 .sync/blddb_postprocess.mjs)。 */
  showThumb: boolean;
  /** 翼棱才有「编码位置」这个约定。 */
  showWingCode: boolean;
  /** 按作者成绩筛时看哪一项。 */
  cutoffEvent: '3bld' | '4bld';
}

export function BlddbOptions({
  showComm,
  showInverse,
  showThumb,
  showWingCode,
  cutoffEvent,
}: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  const prefs = useBlddbPrefsStore((s) => s.prefs);
  const setPrefs = useBlddbPrefsStore((s) => s.setPrefs);

  // 折起时也要一眼看出「我改过什么」,否则镜像开着自己不知道,会以为库里公式错了。
  const on: string[] = [];
  if (prefs.mirror) on.push(tr({ zh: '镜像', en: 'mirrored' }));
  if (prefs.inverse && showInverse) on.push(tr({ zh: '含逆', en: '+inverse' }));
  if (prefs.maxSecs) on.push(tr({ zh: `sub-${prefs.maxSecs}`, en: `sub-${prefs.maxSecs}` }));
  if (!prefs.thumb && showThumb) on.push(tr({ zh: '无起手', en: 'no grip' }));
  if (prefs.wingAlt && showWingCode) on.push(tr({ zh: '非标准翼棱编码', en: 'alt wing code' }));

  return (
    <div className="bld-config-bar">
      <button
        type="button"
        className="bld-config-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <SlidersHorizontal size={15} />
        {tr({ zh: '显示选项', en: 'Display' })}
        {on.length > 0 && <span className="bld-config-summary">{on.join(' / ')}</span>}
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>

      {/* 折叠按钮与 BldConfigBar 共用样式,但面板自己排:那边是「几组下拉」的自适应网格,
          这里是「一行一组开关」的堆叠,套它的 grid 会把每个开关塞进独立格子。 */}
      {open && (
        <div className="bld-db-opt-panel">
          <div className="bld-db-opt-row">
            {showThumb && (
              <BoolToggle
                value={prefs.thumb}
                onChange={(v) => setPrefs({ thumb: v })}
                label={tr({ zh: '显示起手', en: 'Show thumb position' })}
              />
            )}
            <BoolToggle
              value={prefs.mirror}
              onChange={(v) => setPrefs({ mirror: v })}
              label={tr({ zh: '左右镜像', en: 'Mirror left/right' })}
            />
            {showInverse && (
              <BoolToggle
                value={prefs.inverse}
                onChange={(v) => setPrefs({ inverse: v })}
                label={tr({ zh: '带上逆 case', en: 'Include inverse case' })}
              />
            )}
          </div>

          <div className="bld-db-opt-row">
            <label className="bld-db-opt-field">
              <span>{tr({ zh: '多个 case 的排序', en: 'Order of results' })}</span>
              <PillToggle
                value={prefs.order === 'position'}
                onChange={(v) => setPrefs({ order: v ? 'position' : 'letter' })}
                offLabel={tr({ zh: '编码', en: 'Letters' })}
                onLabel={tr({ zh: '位置', en: 'Position' })}
                ariaLabel={tr({ zh: '多个 case 的排序', en: 'Order of results' })}
              />
            </label>

            <label className="bld-db-opt-field">
              <span>
                {tr({
                  zh: `只看${cutoffEvent === '4bld' ? '四' : '三'}盲单次快于`,
                  en: `Only authors with ${cutoffEvent.toUpperCase()} single under`,
                })}
              </span>
              <input
                type="text"
                inputMode="decimal"
                className="bld-db-opt-secs"
                value={prefs.maxSecs}
                placeholder="—"
                autoComplete="off"
                aria-label={tr({
                  zh: `${cutoffEvent === '4bld' ? '四' : '三'}盲单次秒数上限`,
                  en: `${cutoffEvent.toUpperCase()} single cutoff in seconds`,
                })}
                onChange={(e) => {
                  const v = e.target.value;
                  // 允许输入中的 `12.` 这种中间态,但挡住字母和第二个小数点。
                  if (/^\d{0,4}(\.\d{0,2})?$/u.test(v)) setPrefs({ maxSecs: v });
                }}
              />
              <span>{tr({ zh: '秒的人在用的', en: 'seconds' })}</span>
            </label>

            {/* 翼棱两种编码约定下,一条棱的两块翼字母互换 —— 选错查到的是另一块翼的公式,
                不会报错。上游把它放在编码设置页,这里就地给。 */}
            {showWingCode && (
              <label className="bld-db-opt-field">
                <span>{tr({ zh: '翼棱编码位置', en: 'Wing lettering position' })}</span>
                <PillToggle
                  value={prefs.wingAlt}
                  onChange={(v) => setPrefs({ wingAlt: v })}
                  offLabel="UFr"
                  onLabel="FUr"
                  ariaLabel={tr({ zh: '翼棱编码位置', en: 'Wing lettering position' })}
                />
              </label>
            )}
          </div>

          {showComm && (
            <div className="bld-db-opt-row">
              <span className="bld-db-opt-group-label">{tr({ zh: '换位子写法', en: 'Commutator style' })}</span>
              {COMM_SWITCHES.map(({ key, label }) => (
                <BoolToggle
                  key={key}
                  value={Boolean(prefs[key])}
                  onChange={(v) => setPrefs({ [key]: v } as Partial<BlddbPrefs>)}
                  label={tr(label)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
