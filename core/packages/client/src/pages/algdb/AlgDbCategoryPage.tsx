/**
 * /algdb/:cat — list every case for one category (f2l / adv-f2l / oll / pll).
 *
 * Each case row: mini cube + name/subgroup + algs list (multiple per case).
 * F2L cases have 4 orientation tabs (Front Right / Front Left / Back Left / Back Right).
 * Click an alg to copy it to clipboard.
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Copy, Check } from 'lucide-react';
import { loadAlgdb, type AlgdbFile, type AlgdbCategory } from '@cuberoot/shared';
import { MiniCube } from './MiniCube';
import { cubeFromAlg, invertAlg } from '../../utils/cube3_sim';
import './algdb.css';

const CATEGORY_LABELS: Record<string, { en: string; zh: string; api: AlgdbCategory; view: 'll' | 'f2l' }> = {
  'f2l':     { en: 'F2L',          zh: 'F2L (基础)',  api: 'f2l',     view: 'f2l' },
  'adv-f2l': { en: 'Advanced F2L', zh: 'F2L (进阶)',  api: 'adv_f2l', view: 'f2l' },
  'oll':     { en: 'OLL',          zh: 'OLL',         api: 'oll',     view: 'll' },
  'pll':     { en: 'PLL',          zh: 'PLL',         api: 'pll',     view: 'll' },
};

function CopyableAlg({ alg }: { alg: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="algdb-alg-row"
      onClick={() => {
        navigator.clipboard.writeText(alg).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        });
      }}
      title="copy"
    >
      <span className="algdb-alg-text">{alg}</span>
      {copied ? <Check size={14} /> : <Copy size={14} className="algdb-alg-copy-icon" />}
    </button>
  );
}

export default function AlgDbCategoryPage() {
  const { cat = '' } = useParams<{ cat: string }>();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const meta = CATEGORY_LABELS[cat];
  const [data, setData] = useState<AlgdbFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeOri, setActiveOri] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!meta) { setError('unknown category'); return; }
    loadAlgdb(meta.api).then(setData).catch(e => setError(String(e)));
  }, [cat, meta]);

  // Group cases by subgroup for sectioning
  const grouped = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, typeof data.cases>();
    for (const c of data.cases) {
      const arr = map.get(c.subgroup) ?? [];
      arr.push(c);
      map.set(c.subgroup, arr);
    }
    return Array.from(map.entries());
  }, [data]);

  if (!meta) {
    return <div className="algdb-root"><div className="algdb-empty">Unknown category: {cat}</div></div>;
  }

  return (
    <div className="algdb-root">
      <div className="algdb-cat-header">
        <Link to="/algdb" className="algdb-back">
          <ArrowLeft size={14} /> {isZh ? '返回' : 'Back'}
        </Link>
        <h1 className="algdb-cat-title">{isZh ? meta.zh : meta.en}</h1>
        {data && <span className="algdb-cat-count">{data.cases.length} {isZh ? '个' : 'cases'}</span>}
      </div>

      {error && <div className="algdb-empty">{error}</div>}
      {!data && !error && <div className="algdb-empty">{isZh ? '加载中…' : 'Loading…'}</div>}

      {data && grouped.map(([subgroup, cases]) => (
        <section key={subgroup} className="algdb-subgroup">
          {subgroup && <h2 className="algdb-subgroup-title">{subgroup}</h2>}
          <div className="algdb-case-list">
            {cases.map(c => {
              const oriIdx = activeOri[c.name] ?? 0;
              const algsForOri = c.algs[oriIdx] ?? c.algs[0] ?? [];
              const firstAlg = algsForOri[0]?.alg ?? c.standard ?? '';
              // Render the case state by applying alg^-1 from solved (if alg exists)
              // Otherwise apply setup (best-effort fallback).
              const state = firstAlg
                ? cubeFromAlg(invertAlg(firstAlg))
                : (c.setup ? cubeFromAlg(c.setup) : cubeFromAlg(''));
              return (
                <article key={c.name} className="algdb-case">
                  <div className="algdb-case-head">
                    <div className="algdb-case-cube">
                      <MiniCube state={state} view={meta.view} size={88} />
                    </div>
                    <div className="algdb-case-info">
                      <div className="algdb-case-name">{c.name}</div>
                      {c.subgroup && <div className="algdb-case-subgroup">{c.subgroup}</div>}
                      {c.standard && (
                        <div className="algdb-case-standard">
                          <span className="algdb-pill">{isZh ? '标准' : 'Std'}</span>
                          <code>{c.standard}</code>
                        </div>
                      )}
                    </div>
                  </div>
                  {c.oriNames && c.oriNames.length > 1 && (
                    <div className="algdb-ori-tabs">
                      {c.oriNames.map((name, i) => (
                        <button
                          key={i}
                          type="button"
                          className={`algdb-ori-tab${oriIdx === i ? ' is-active' : ''}`}
                          onClick={() => setActiveOri(prev => ({ ...prev, [c.name]: i }))}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="algdb-case-algs">
                    {algsForOri.map((entry, i) => (
                      <CopyableAlg key={`${entry.altId ?? i}`} alg={entry.alg} />
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
