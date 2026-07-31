'use client';

// 三循环公式查询 —— BLDDB(nbwzx/blddb,GPL-3.0)那套人工整理公式集的本站版。
//
// 与同目录的 /alg/3bld/comm 分工:comm 是**固定缓冲**的字母对字典(每对一条,PG 里可编辑,
// 带联想词);这里是**任意缓冲**的三循环查询,一个 case 给出全部在用的写法 + 换位子 +
// 谁在用。数据是 fork 同步下来的静态 JSON,只读。
//
// 编码按用户在 3BLD 设置里选的方案(彳亍 / Speffz)输入,内部转成库用的彳亍代表元 —— 键怎么
// 编的见 _lib/blddb.ts 头注,正确性锁在 tests/blddb_lookup.test.ts。
//
// 穷举生成的 Nightmare 集、高阶盲拧(翼棱 / 中心块)、翻色扭角那几套留在 iframe 版 /blddb。

import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import { useQueryState, parseAsStringEnum } from 'nuqs';
import { Boxes, Square, Check, Copy, ExternalLink, Users } from 'lucide-react';
import Link from '@/components/AppLink';
import { SearchInput } from '@/components/SearchInput';
import { Spinner } from '@/components/Spinner/Spinner';
import CubingPreview from '@/components/CubingPreview';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { useCopy } from '@/hooks/useCopy';
import { invertAlg } from '@/lib/cube3';
import { tr } from '@/i18n/tr';
import {
  NO_COMMUTATOR,
  loadBlddbSet,
  loadSourceToResult,
  loadSourceToUrl,
  lookupCase,
  sameSticker,
  schemeLetters,
  toChichu,
  type BlddbEntry,
  type BlddbPiece,
  type BlddbSet,
  type SourceToResult,
  type SourceToUrl,
} from '../_lib/blddb';
import { useBldConfigHydrated, useBldConfigStore } from '../_store/bld-config-store';
import '../3bld.css';

const CODE_LEN = 3;

/** 百分秒 → 读得出来的成绩(库里 3bld / 4bld 存的是百分秒)。 */
function formatCentis(v: number): string {
  const total = Math.round(v) / 100;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return m > 0 ? `${m}:${s.toFixed(2).padStart(5, '0')}` : s.toFixed(2);
}

function pieceLabel(piece: BlddbPiece): string {
  return piece === 'corner'
    ? tr({ zh: '角块', en: 'Corner' })
    : tr({ zh: '棱块', en: 'Edge' });
}

/** 一条公式:文本 + 复制。 */
function AlgLine({ alg, primary }: { alg: string; primary?: boolean }): JSX.Element {
  const { copied, copy } = useCopy();
  return (
    <div className={`bld-3s-alg${primary ? ' is-primary' : ''}`}>
      <span className="bld-3s-alg-text">{alg}</span>
      <button
        type="button"
        className="alg-alg-copy-btn"
        onClick={() => copy(alg)}
        title={tr({ zh: '复制公式', en: 'Copy alg' })}
      >
        {copied ? <Check size={14} /> : <Copy size={14} className="alg-alg-copy-icon" />}
      </button>
    </div>
  );
}

/** 用者名单。默认收起 —— 热门 case 有 30+ 人,摊开会把表撑烂。 */
function UserList({
  users,
  piece,
  sourceUrl,
  sourceResult,
}: {
  users: string[];
  piece: BlddbPiece;
  sourceUrl: SourceToUrl | null;
  sourceResult: SourceToResult | null;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div className="bld-3s-users">
      <button
        type="button"
        className="bld-3s-users-btn"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title={tr({ zh: '谁在用这条', en: 'Who uses this' })}
      >
        <Users size={13} />
        {users.length}
      </button>
      {open && (
        <ul className="bld-3s-users-list">
          {users.map((name) => {
            const href = sourceUrl?.[name]?.[piece];
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

export default function ThreeStylePage(): JSX.Element {
  const hydrated = useBldConfigHydrated();
  const scheme = useBldConfigStore((s) => s.config.scheme);
  const setConfig = useBldConfigStore((s) => s.setConfig);

  const [piece, setPiece] = useQueryState(
    'piece',
    parseAsStringEnum<BlddbPiece>(['corner', 'edge']).withDefault('edge'),
  );
  const [code, setCode] = useQueryState('code', { defaultValue: '' });

  const [set, setSet] = useState<BlddbSet | null>(null);
  const [sourceUrl, setSourceUrl] = useState<SourceToUrl | null>(null);
  const [sourceResult, setSourceResult] = useState<SourceToResult | null>(null);
  const [loadError, setLoadError] = useState(false);

  // 换块型就换一份表(角 2.4MB / 棱 3.5MB)。模块级缓存兜住来回切,不会重复拉。
  useEffect(() => {
    let alive = true;
    setSet(null);
    setLoadError(false);
    loadBlddbSet(piece)
      .then((d) => { if (alive) setSet(d); })
      .catch(() => { if (alive) setLoadError(true); });
    return () => { alive = false; };
  }, [piece]);

  // 归属信息是次要的:拉失败只是不显示名字,不该拖垮整页。
  useEffect(() => {
    loadSourceToUrl().then(setSourceUrl).catch(() => {});
    loadSourceToResult().then(setSourceResult).catch(() => {});
  }, []);

  const alphabet = useMemo(() => schemeLetters(piece, scheme), [piece, scheme]);

  const onCodeChange = useCallback((raw: string) => {
    void setCode(raw.toUpperCase().replace(/[^A-Z]/gu, '').slice(0, CODE_LEN));
  }, [setCode]);

  // 边界:长度不足 / 字母不在该方案的字母表里 / 缓冲与目标撞同一块。
  const problem = useMemo((): string | null => {
    if (code.length === 0) return null;
    if (code.length < CODE_LEN) {
      return tr({
        zh: `再输 ${CODE_LEN - code.length} 个字母`,
        en: `${CODE_LEN - code.length} more letter(s)`,
      });
    }
    const bad = [...code].filter((c) => !alphabet.includes(c));
    if (bad.length > 0) {
      return tr({
        zh: `${bad.join(' ')} 不是这套方案里的${pieceLabel(piece)}编码`,
        en: `${bad.join(' ')} is not a ${piece} letter in this scheme`,
      });
    }
    const chichu = toChichu(code, piece, scheme);
    for (let i = 0; i < chichu.length; i++) {
      for (let j = i + 1; j < chichu.length; j++) {
        if (sameSticker(chichu[i], chichu[j], piece)) {
          return tr({
            zh: '三个贴纸得在三个不同的块上',
            en: 'The three stickers must sit on three different pieces',
          });
        }
      }
    }
    return null;
  }, [code, alphabet, piece, scheme]);

  const result = useMemo(() => {
    if (!set || problem || code.length !== CODE_LEN) return null;
    return lookupCase(set, toChichu(code, piece, scheme), piece);
  }, [set, problem, code, piece, scheme]);

  // case 态 = 任一条公式取逆。缩略图只用来确认「查的是不是这一个」。
  const setup = useMemo(() => {
    const first = result?.entries[0]?.[0]?.[0];
    return first ? invertAlg(first.replace(/[()]/gu, '')) : '';
  }, [result]);

  const entries: BlddbEntry[] = result?.entries ?? [];

  return (
    <div className="bld-trainer-root">
      <div className="bld-topbar">
        <h1>
          <EventIcon event="333bf" /> {tr({ zh: '三循环公式查询', en: '3-Style Lookup' })}
        </h1>
        <span className="bld-spacer" />
        <Link href="/blddb" className="bld-hub-secondary" prefetch={false}>
          {tr({ zh: 'BLDDB 完整库', en: 'Full BLDDB' })}
        </Link>
      </div>

      <p className="bld-input-summary">
        {tr({
          zh: '按缓冲和两个目标查三循环:同一个 case 把大家在用的写法一并列出,带换位子和使用者。数据来自 BLDDB 的人工整理集;穷举生成的 Nightmare 集、高阶盲拧与翻色扭角在完整库里。',
          en: 'Look up a 3-cycle by buffer and two targets — every writing people actually use for that case, with its commutator and who uses it. Data is BLDDB’s hand-curated set; the exhaustive Nightmare sets, big BLD and twists/flips live in the full library.',
        })}
      </p>

      <div className="bld-comm-toolbar">
        <div className="bld-seg" role="tablist" aria-label={tr({ zh: '块类型', en: 'Piece type' })}>
          <button
            type="button"
            role="tab"
            aria-selected={piece === 'edge'}
            className={`bld-seg-btn${piece === 'edge' ? ' is-on' : ''}`}
            onClick={() => void setPiece('edge')}
          >
            <Square size={15} />
            {pieceLabel('edge')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={piece === 'corner'}
            className={`bld-seg-btn${piece === 'corner' ? ' is-on' : ''}`}
            onClick={() => void setPiece('corner')}
          >
            <Boxes size={15} />
            {pieceLabel('corner')}
          </button>
        </div>

        <SearchInput
          value={code}
          onChange={onCodeChange}
          className="bld-comm-search-wrap"
          inputClassName="bld-comm-search bld-3s-input"
          placeholder={tr({ zh: '缓冲 + 两个目标,如 AEH', en: 'Buffer + 2 targets, e.g. AEH' })}
          ariaLabel={tr({ zh: '三循环编码', en: '3-cycle letters' })}
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

      {loadError && (
        <p className="bld-3s-empty">
          {tr({ zh: '公式库没拉下来,刷新再试。', en: 'Could not load the library — try reloading.' })}
        </p>
      )}

      {problem && <p className="bld-3s-empty">{problem}</p>}

      {!problem && code.length === CODE_LEN && !set && !loadError && (
        <div className="bld-3s-empty">
          <Spinner size={18} label={tr({ zh: '加载公式库', en: 'Loading library' })} />
        </div>
      )}

      {!problem && code.length === CODE_LEN && set && !result && (
        <p className="bld-3s-empty">
          {tr({
            zh: '这一条没有人工整理的公式。完整库的 Nightmare 集是穷举生成的,那边多半查得到。',
            en: 'No hand-made algorithm for this case. The full library’s exhaustive Nightmare set most likely has one.',
          })}
        </p>
      )}

      {result && (
        <>
          <div className="bld-3s-case">
            {setup && (
              <CubingPreview event="333" scramble={setup} height={132} className="bld-3s-case-cube" />
            )}
            <div className="bld-3s-case-meta">
              <div className="bld-3s-case-code">{code}</div>
              <div className="bld-3s-case-sub">
                {tr({
                  zh: `${pieceLabel(piece)} · ${entries.length} 种写法`,
                  en: `${pieceLabel(piece)} · ${entries.length} variant(s)`,
                })}
              </div>
            </div>
          </div>

          <div className="bld-3s-rows">
            {entries.map(([algs, users, comms], index) => (
              <div className="bld-3s-row" key={`${result.key}-${index}`}>
                <div className="bld-3s-algs">
                  {algs.map((alg, i) => (
                    <AlgLine key={alg} alg={alg} primary={i === 0} />
                  ))}
                </div>
                <div className="bld-3s-comm">
                  {comms
                    .filter((c) => c && c !== NO_COMMUTATOR)
                    .map((c) => <span key={c}>{c}</span>)}
                </div>
                <UserList
                  users={users}
                  piece={piece}
                  sourceUrl={sourceUrl}
                  sourceResult={sourceResult}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
