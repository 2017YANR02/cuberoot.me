'use client';

// 盲拧公式查询 —— BLDDB(nbwzx/blddb,GPL-3.0)人工整理公式集的本站版。
//
// 覆盖三阶那六套:棱 / 角三循环、奇偶、翻角、翻棱、奇偶带翻。iframe 版 /blddb 原样留着,
// 那边额外有穷举生成的 Nightmare 集和高阶盲拧(翼棱 / 中心块),数据量和编码另成一套。
//
// 与同目录 /alg/3bld/comm 分工:comm 是**固定缓冲**的字母对字典(每对一条,PG 里可编辑,
// 带联想词);这里是**任意缓冲**的只读查询,一个 case 给出全部在用的写法 + 换位子 + 谁在用。
//
// 编码按用户在 3BLD 设置里选的方案(彳亍 / Speffz)输入,内部转成库用的彳亍代表元 ——
// 键怎么编的见 _lib/blddb.ts 头注,正确性锁在 tests/blddb_lookup.test.ts(结构不变量 +
// 六条对着上游页面实测的 fixture)。

import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import { useQueryState, parseAsStringEnum } from 'nuqs';
import { Check, Copy, ExternalLink, Users, Video } from 'lucide-react';
import Link from '@/components/AppLink';
import { SearchInput } from '@/components/SearchInput';
import { Spinner } from '@/components/Spinner/Spinner';
import { VisualCube } from '@/components/VisualCube';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { useCopy } from '@/hooks/useCopy';
import { tr } from '@/i18n/tr';
import {
  BLDDB_TYPES,
  NO_COMMUTATOR,
  TWIST_CORNERS,
  WILDCARD,
  codeFromChichu,
  codeLength,
  codeToChichu,
  findCases,
  fromChichu,
  hasCommutators,
  isVariadic,
  kindLetters,
  kindPositions,
  letterAtPosition,
  loadAlgToUrl,
  loadBlddbSet,
  loadSourceToResult,
  loadSourceToUrl,
  positionsOf,
  sameSticker,
  slotKind,
  sourceLink,
  twistLetterOf,
  twistTargets,
  type AlgToUrl,
  type BlddbEntry,
  type BlddbHit,
  type BlddbType,
  type BlddbSet,
  type SourceToResult,
  type SourceToUrl,
} from '../_lib/blddb';
import { useBldConfigHydrated, useBldConfigStore } from '../_store/bld-config-store';
import type { SchemeId } from '../_lib/scheme-presets';
import '../3bld.css';

const TYPE_LABEL: Record<BlddbType, { zh: string; en: string }> = {
  edge: { zh: '棱块三循环', en: 'Edge 3-cycle' },
  corner: { zh: '角块三循环', en: 'Corner 3-cycle' },
  parity: { zh: '奇偶', en: 'Parity' },
  twists: { zh: '翻角', en: 'Corner twists' },
  flips: { zh: '翻棱', en: 'Edge flips' },
  ltct: { zh: '奇偶带翻', en: 'LTCT' },
};

const PLACEHOLDER: Record<BlddbType, { zh: string; en: string }> = {
  edge: { zh: '缓冲 + 两个目标', en: 'Buffer + 2 targets' },
  corner: { zh: '缓冲 + 两个目标', en: 'Buffer + 2 targets' },
  parity: { zh: '两个棱 + 两个角', en: '2 edges + 2 corners' },
  twists: { zh: '每个翻角一个字母', en: 'One letter per twisted corner' },
  flips: { zh: '两条翻掉的棱', en: 'The two flipped edges' },
  ltct: { zh: '两个角 + 翻掉的角', en: '2 corners + the twisted one' },
};

/** 每个类型的输入分组:一组一个标题 + 若干位。 */
function slotGroups(type: BlddbType): { label: { zh: string; en: string }; indexes: number[] }[] {
  switch (type) {
    case 'parity':
      return [
        { label: { zh: '棱交换', en: 'Edge swap' }, indexes: [0, 1] },
        { label: { zh: '角交换', en: 'Corner swap' }, indexes: [2, 3] },
      ];
    case 'flips':
      return [{ label: { zh: '翻掉的两条棱', en: 'Flipped edges' }, indexes: [0, 1] }];
    case 'ltct':
      return [
        { label: { zh: '交换', en: 'Swap' }, indexes: [0, 1] },
        { label: { zh: '翻角', en: 'Twist' }, indexes: [2] },
      ];
    default:
      return [{ label: { zh: '缓冲 → 目标 → 目标', en: 'Buffer → target → target' }, indexes: [0, 1, 2] }];
  }
}

/** 百分秒 → 读得出来的成绩(库里 3bld / 4bld 存的是百分秒)。 */
function formatCentis(v: number): string {
  const total = Math.round(v) / 100;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return m > 0 ? `${m}:${s.toFixed(2).padStart(5, '0')}` : s.toFixed(2);
}

/** 一条公式:文本 + 复制 + 讲解视频。 */
function AlgLine({ alg, primary, videos }: { alg: string; primary?: boolean; videos?: AlgToUrl }): JSX.Element {
  const { copied, copy } = useCopy();
  const video = videos?.[alg]?.[0];
  return (
    <div className={`bld-db-alg${primary ? ' is-primary' : ''}`}>
      <span className="bld-db-alg-text">{alg}</span>
      <button
        type="button"
        className="alg-alg-copy-btn"
        onClick={() => copy(alg)}
        title={tr({ zh: '复制公式', en: 'Copy alg' })}
      >
        {copied ? <Check size={14} /> : <Copy size={14} className="alg-alg-copy-icon" />}
      </button>
      {video && (
        <a
          className="bld-db-alg-video"
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          title={tr({ zh: '讲解视频', en: 'Video' })}
        >
          <Video size={14} />
        </a>
      )}
    </div>
  );
}

/** 用者名单。默认收起 —— 热门 case 有 30+ 人,摊开会把表撑烂。 */
function UserList({
  users,
  type,
  sourceUrl,
  sourceResult,
}: {
  users: string[];
  type: BlddbType;
  sourceUrl: SourceToUrl | null;
  sourceResult: SourceToResult | null;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div className="bld-db-users">
      <button
        type="button"
        className="bld-db-users-btn"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title={tr({ zh: '谁在用这条', en: 'Who uses this' })}
      >
        <Users size={13} />
        {users.length}
      </button>
      {open && (
        <ul className="bld-db-users-list">
          {users.map((name) => {
            const href = sourceLink(sourceUrl, name, type);
            const best = sourceResult?.[name]?.['3bld'];
            return (
              <li key={name}>
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {name}
                    <ExternalLink size={11} />
                  </a>
                ) : (
                  <span>{name}</span>
                )}
                {best ? <em>{formatCentis(best)}</em> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** 一个 case:缩略图 + 编码 / 位置,再是每种写法一行。 */
function CaseBlock({
  hit,
  type,
  scheme,
  sourceUrl,
  sourceResult,
  videos,
}: {
  hit: BlddbHit;
  type: BlddbType;
  scheme: SchemeId;
  sourceUrl: SourceToUrl | null;
  sourceResult: SourceToResult | null;
  videos: AlgToUrl | null;
}): JSX.Element {
  // 用者最多的写法排最前 —— 与上游同序,也就是"大家默认用哪条"。
  const entries = useMemo(
    () => [...hit.entries].sort((a, b) => b[1].length - a[1].length),
    [hit.entries],
  );
  const firstAlg = entries[0]?.[0]?.[0] ?? '';
  const showComm = hasCommutators(type);

  return (
    <section className="bld-db-case">
      <header className="bld-db-case-head">
        {firstAlg && (
          <VisualCube algorithm={firstAlg} view="iso" size={76} loading="lazy" alt="" />
        )}
        <div>
          <div className="bld-db-case-code">{describeCode(hit.writing, type, scheme)}</div>
          <div className="bld-db-case-sub">{describePositions(hit.writing, type)}</div>
        </div>
      </header>

      {/* 没有换位子那一列的类型(奇偶 / 奇偶带翻)少排一列,别留个空档。 */}
      <div className={`bld-db-rows${showComm ? '' : ' is-nocomm'}`}>
        {entries.map(([algs, users, comms]: BlddbEntry, index) => (
          <div className="bld-db-row" key={`${hit.key}-${index}`}>
            <div className="bld-db-algs">
              {algs.map((alg, i) => (
                <AlgLine key={alg} alg={alg} primary={i === 0} videos={videos ?? undefined} />
              ))}
            </div>
            {showComm && (
              <div className="bld-db-comm">
                {(comms ?? [])
                  .filter((c) => c && c !== NO_COMMUTATOR)
                  .map((c) => <span key={c}>{c}</span>)}
              </div>
            )}
            <UserList users={users} type={type} sourceUrl={sourceUrl} sourceResult={sourceResult} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** 编码显示:按用户选的方案翻回去,再按类型分段。 */
function describeCode(chichu: string, type: BlddbType, scheme: SchemeId): string {
  const s = codeFromChichu(chichu, type, scheme);
  if (type === 'parity') return `${s.slice(0, 2)} ${s.slice(2)}`;
  if (type === 'ltct') return `${s.slice(0, 2)}[${s.slice(2)}]`;
  return s;
}

function describePositions(chichu: string, type: BlddbType): string {
  if (type === 'twists') {
    return twistTargets(chichu)
      .map(({ corner, dir }) => `${corner} ${dir === 'cw' ? '↻' : '↺'}`)
      .join('   ');
  }
  const p = positionsOf(chichu, type);
  if (type === 'parity') return `${p[0]}-${p[1]}   ${p[2]}-${p[3]}`;
  if (type === 'flips') return `${p[0]}   ${p[1]}`;
  if (type === 'ltct') return `${p[0]}-${p[1]} [${p[2]}]`;
  return p.join('-');
}

export default function BlddbLookupPage(): JSX.Element {
  const hydrated = useBldConfigHydrated();
  const scheme = useBldConfigStore((s) => s.config.scheme);
  const setConfig = useBldConfigStore((s) => s.setConfig);

  const [type, setType] = useQueryState(
    'type',
    parseAsStringEnum<BlddbType>(BLDDB_TYPES).withDefault('edge'),
  );
  const [code, setCode] = useQueryState('code', { defaultValue: '' });

  const [set, setSet] = useState<BlddbSet | null>(null);
  const [sourceUrl, setSourceUrl] = useState<SourceToUrl | null>(null);
  const [sourceResult, setSourceResult] = useState<SourceToResult | null>(null);
  const [videos, setVideos] = useState<AlgToUrl | null>(null);
  const [loadError, setLoadError] = useState(false);

  // 换类型就换一份表(棱 3.5MB / 角 2.4MB,其余都小)。模块级缓存兜住来回切。
  useEffect(() => {
    let alive = true;
    setSet(null);
    setLoadError(false);
    loadBlddbSet(type)
      .then((d) => { if (alive) setSet(d); })
      .catch(() => { if (alive) setLoadError(true); });
    return () => { alive = false; };
  }, [type]);

  // 归属信息和视频是次要的:拉失败只是少显示点东西,不该拖垮整页。
  useEffect(() => {
    loadSourceToUrl().then(setSourceUrl).catch(() => {});
    loadSourceToResult().then(setSourceResult).catch(() => {});
    loadAlgToUrl().then(setVideos).catch(() => {});
  }, []);

  const maxLen = codeLength(type);
  const variadic = isVariadic(type);

  const onCodeChange = useCallback((raw: string) => {
    void setCode(raw.toUpperCase().replace(/[^A-Z*]/gu, '').slice(0, maxLen));
  }, [setCode, maxLen]);

  const onTypeChange = useCallback((next: BlddbType) => {
    // 字母在不同类型里含义不同,换类型必须清空,否则会拿旧码去查新表。
    void setType(next);
    void setCode('');
  }, [setType, setCode]);

  // 没填满的位当"任意"补齐 —— 输到一半就能看到那一组,填完自动收敛到一条。
  const pattern = variadic ? code : code.padEnd(maxLen, WILDCARD);

  // 边界:字母表、通配符个数、以及"两个目标落在同一块上"。
  const problem = useMemo((): string | null => {
    if (code.length === 0) return null;
    const stars = [...pattern].filter((c) => c === WILDCARD).length;
    if (stars > 0 && type === 'twists') {
      return tr({ zh: '翻角不支持通配符', en: 'Wildcards are not supported for twists' });
    }
    if (stars > 1) {
      // 两位以上还空着就不查了 —— 那一组能有几百个 case,列出来没意义。
      return tr({
        zh: `再填 ${stars - 1} 位(留一位空着就列出整组)`,
        en: `Fill in ${stars - 1} more (leave one blank to list a whole group)`,
      });
    }
    for (let i = 0; i < code.length; i++) {
      if (code[i] === WILDCARD) continue;
      if (!kindLetters(slotKind(type, i), scheme).includes(code[i])) {
        return tr({
          zh: `第 ${i + 1} 位的 ${code[i]} 不是这里能用的编码`,
          en: `${code[i]} is not a valid letter in position ${i + 1}`,
        });
      }
    }
    const chichu = codeToChichu(pattern, type, scheme);
    // 同一段里的两个字母不能落在同一块上(那就不是交换 / 三循环了)。
    const segments: number[][] = type === 'parity' ? [[0, 1], [2, 3]]
      : type === 'ltct' ? [[0, 1]]
      : [[...pattern].map((_, i) => i)];
    for (const seg of segments) {
      for (let a = 0; a < seg.length; a++) {
        for (let b = a + 1; b < seg.length; b++) {
          const [x, y] = [chichu[seg[a]], chichu[seg[b]]];
          if (x === WILDCARD || y === WILDCARD) continue;
          const piece = slotKind(type, seg[a]).startsWith('corner') ? 'corner' : 'edge';
          if (sameSticker(x, y, piece)) {
            return type === 'twists'
              ? tr({ zh: '同一个角只能翻一个方向', en: 'A corner can only be twisted one way' })
              : tr({ zh: '两个目标不能落在同一块上', en: 'Two targets cannot sit on the same piece' });
          }
        }
      }
    }
    return null;
  }, [code, pattern, type, scheme]);

  const hits = useMemo((): BlddbHit[] => {
    if (!set || problem || code.length === 0) return [];
    const found = findCases(set, codeToChichu(pattern, type, scheme), type);
    return found.sort((a, b) => a.writing.localeCompare(b.writing));
  }, [set, problem, pattern, code.length, type, scheme]);

  const ready = code.length > 0 && !problem;

  return (
    <div className="bld-trainer-root">
      <div className="bld-topbar">
        <h1>
          <EventIcon event="333bf" /> {tr({ zh: '盲拧公式查询', en: 'BLD Algorithm Lookup' })}
        </h1>
        <span className="bld-spacer" />
        <Link href="/blddb" className="bld-hub-secondary" prefetch={false}>
          {tr({ zh: 'BLDDB 完整库', en: 'Full BLDDB' })}
        </Link>
      </div>

      <p className="bld-input-summary">
        {tr({
          zh: '按位置或字母查一个 case,把大家在用的写法一并列出,带换位子和使用者。数据来自 BLDDB 的人工整理集;某一位填 * 可以列出一整组。穷举生成的 Nightmare 集和高阶盲拧在完整库里。',
          en: 'Look up a case by position or letters — every writing people actually use, with its commutator and who uses it. Data is BLDDB’s hand-curated set; put * in one slot to list a whole group. The exhaustive Nightmare sets and big BLD live in the full library.',
        })}
      </p>

      <div className="bld-comm-toolbar">
        <label className="bld-db-type">
          <span>{tr({ zh: '类型', en: 'Type' })}</span>
          <select
            className="bld-db-slot-select"
            value={type}
            onChange={(e) => onTypeChange(e.target.value as BlddbType)}
            aria-label={tr({ zh: 'case 类型', en: 'Case type' })}
          >
            {BLDDB_TYPES.map((t) => (
              <option key={t} value={t}>{tr(TYPE_LABEL[t])}</option>
            ))}
          </select>
        </label>

        <SearchInput
          value={code}
          onChange={onCodeChange}
          className="bld-comm-search-wrap"
          inputClassName="bld-comm-search bld-db-input"
          placeholder={tr(PLACEHOLDER[type])}
          ariaLabel={tr({ zh: '编码', en: 'Letters' })}
          spellCheck={false}
          autoComplete="off"
        />

        {/* 编码方案就地切换 —— 与全站 3BLD 共用 bld-config-store,改这里别处跟着变。
            这页用不到缓冲设置(缓冲就是编码的第一个字母),所以不上整条 BldConfigBar。 */}
        {hydrated && (
          <div className="bld-seg" role="tablist" aria-label={tr({ zh: '编码方案', en: 'Lettering scheme' })}>
            <button
              type="button"
              role="tab"
              aria-selected={scheme === 'chichu'}
              className={`bld-seg-btn${scheme === 'chichu' ? ' is-on' : ''}`}
              onClick={() => setConfig({ scheme: 'chichu' })}
            >
              {tr({ zh: '彳亍', en: 'Chichu' })}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={scheme === 'speffz'}
              className={`bld-seg-btn${scheme === 'speffz' ? ' is-on' : ''}`}
              onClick={() => setConfig({ scheme: 'speffz' })}
            >
              Speffz
            </button>
          </div>
        )}
      </div>

      <PositionPicker type={type} code={code} scheme={scheme} onChange={onCodeChange} />

      {loadError && (
        <p className="bld-db-empty">
          {tr({ zh: '公式库没拉下来,刷新再试。', en: 'Could not load the library — try reloading.' })}
        </p>
      )}

      {problem && <p className="bld-db-empty">{problem}</p>}

      {ready && !set && !loadError && (
        <div className="bld-db-empty">
          <Spinner size={18} label={tr({ zh: '加载公式库', en: 'Loading library' })} />
        </div>
      )}

      {ready && set && hits.length === 0 && (
        <p className="bld-db-empty">
          {tr({
            zh: '这一条没有人工整理的公式。完整库的 Nightmare 集是穷举生成的,那边多半查得到。',
            en: 'No hand-made algorithm for this case. The full library’s exhaustive Nightmare set most likely has one.',
          })}
        </p>
      )}

      {hits.length > 1 && (
        <p className="bld-db-count">
          {tr({ zh: `命中 ${hits.length} 个 case`, en: `${hits.length} cases` })}
        </p>
      )}

      {hits.map((hit) => (
        <CaseBlock
          key={hit.key}
          hit={hit}
          type={type}
          scheme={scheme}
          sourceUrl={sourceUrl}
          sourceResult={sourceResult}
          videos={videos}
        />
      ))}
    </div>
  );
}

/**
 * 位置选择器 —— 不背字母也能查。选中的位置写回编码,两边始终同一份状态(编码是唯一源)。
 * 翻角是一角一挡(不翻 / 顺 / 逆),其余是一位一个下拉。
 */
function PositionPicker({
  type,
  code,
  scheme,
  onChange,
}: {
  type: BlddbType;
  code: string;
  scheme: SchemeId;
  onChange: (next: string) => void;
}): JSX.Element {
  const chichu = codeToChichu(code, type, scheme);

  if (type === 'twists') {
    const chosen = new Map(twistTargets(chichu).map(({ corner, dir }) => [corner, dir]));
    const setCorner = (corner: string, dir: '' | 'cw' | 'ccw') => {
      const next = new Map(chosen);
      if (dir === '') next.delete(corner);
      else next.set(corner, dir);
      const letters = TWIST_CORNERS.flatMap((c) => {
        const d = next.get(c);
        return d ? [fromChichu(twistLetterOf(c, d), 'corner', scheme)] : [];
      });
      onChange(letters.join(''));
    };
    return (
      <div className="bld-db-picker">
        {TWIST_CORNERS.map((corner) => (
          <label key={corner} className="bld-db-slot">
            <span>{corner}</span>
            <select
              className="bld-db-slot-select"
              value={chosen.get(corner) ?? ''}
              onChange={(e) => setCorner(corner, e.target.value as '' | 'cw' | 'ccw')}
            >
              <option value="">—</option>
              <option value="cw">{tr({ zh: '顺 ↻', en: 'cw ↻' })}</option>
              <option value="ccw">{tr({ zh: '逆 ↺', en: 'ccw ↺' })}</option>
            </select>
          </label>
        ))}
      </div>
    );
  }

  const len = codeLength(type);
  const positions = positionsOf(chichu, type);
  const setSlot = (i: number, pos: string) => {
    // 没选的位一律记成通配 —— 与文本框"没填满就当任意"是同一套表示。
    const next = [...code.padEnd(len, WILDCARD)];
    next[i] = pos === '' || pos === WILDCARD ? WILDCARD : letterAtPosition(pos, scheme);
    onChange(next.join(''));
  };

  return (
    <div className="bld-db-picker">
      {slotGroups(type).map((group) => (
        <div key={group.label.en} className="bld-db-group">
          <span className="bld-db-group-label">{tr(group.label)}</span>
          {group.indexes.map((i) => (
            <select
              key={i}
              className="bld-db-slot-select"
              // 没选 = 通配 = 同一件事,只留一个"任意"选项,别让空白和 * 各表一套。
              value={code[i] === WILDCARD || !positions[i] ? '' : positions[i]}
              aria-label={`${tr(group.label)} ${i + 1}`}
              onChange={(e) => setSlot(i, e.target.value)}
            >
              <option value="">{tr({ zh: '任意', en: 'any' })}</option>
              {kindPositions(slotKind(type, i)).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          ))}
        </div>
      ))}
    </div>
  );
}
