/**
 * /alg/commutator — port of nbwzx/commutator (https://github.com/nbwzx/commutator)
 *
 * Engine: ./engine.ts (untouched algorithm — IIFE wrapper stripped, behavior identical to upstream)
 * UI: 5 sub-tabs (Decompose / Excel / Introduction / Source / About) inside one React page,
 *     mirroring upstream's 5 HTML pages but consolidated. Settings panel appears on Decompose
 *     and Excel tabs. Persistence via localStorage replaces upstream's cookie.js.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, HelpCircle, Copy, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import LangToggle from '../../../components/LangToggle';
import ThemeToggle from '../../../components/ThemeToggle';
import { search as cmtSearch, expand as cmtExpand } from './engine';
import './commutator.css';

type Tab = 'home' | 'decompose' | 'excel' | 'intro' | 'about';

interface Settings {
    order: string;            // empty → 4
    outerBracket: boolean;    // default false
    initialReplace: boolean;  // default true
    finalReplace: boolean;    // default true
    commute: boolean;         // default true
    maxDepth: string;         // empty → 0
    abMaxScore: string;       // empty → 2.5
    abMinScore: string;       // empty → 5
    addScore: string;         // empty → 1
    fast: boolean;            // default false
}

const DEFAULTS: Settings = {
    order: '',
    outerBracket: false,
    initialReplace: true,
    finalReplace: true,
    commute: true,
    maxDepth: '',
    abMaxScore: '',
    abMinScore: '',
    addScore: '',
    fast: false,
};

const LS_KEY = 'cmt-settings-v1';

function loadSettings(): Settings {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return { ...DEFAULTS };
        return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
        return { ...DEFAULTS };
    }
}

function saveSettings(s: Settings) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* swallow */ }
}

/** Build the engine input object from a Settings + algorithm string. */
function buildSearchOpts(s: Settings, algorithm: string) {
    return {
        algorithm,
        order: s.order !== '' ? Number(s.order) : 4,
        outerBracket: s.outerBracket,
        initialReplace: s.initialReplace ? undefined : {},
        finalReplace: s.finalReplace ? undefined : {},
        abMaxScore: s.abMaxScore !== '' ? Number(s.abMaxScore) : 2.5,
        abMinScore: s.abMinScore !== '' ? Number(s.abMinScore) : 5,
        addScore: s.addScore !== '' ? Number(s.addScore) : 1,
        commute: s.commute ? undefined : {},
        maxDepth: s.maxDepth !== '' ? Number(s.maxDepth) : 0,
        fast: s.fast,
    };
}

function buildExpandOpts(s: Settings, algorithm: string) {
    return {
        algorithm,
        order: s.order !== '' ? Number(s.order) : 4,
        initialReplace: s.initialReplace ? undefined : {},
        finalReplace: s.finalReplace ? undefined : {},
        commute: s.commute ? undefined : {},
    };
}

export default function CommutatorPage() {
    const { i18n } = useTranslation();
    const isZh = i18n.language.startsWith('zh');
    const t = (zh: string, en: string) => (isZh ? zh : en);

    const [tab, setTab] = useState<Tab>(() => {
        const h = window.location.hash.replace('#', '') as Tab;
        return (['home', 'decompose', 'excel', 'intro', 'about'] as Tab[]).includes(h) ? h : 'decompose';
    });

    useEffect(() => {
        const newHash = `#${tab}`;
        if (window.location.hash !== newHash) {
            window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${newHash}`);
        }
    }, [tab]);

    const [settings, setSettings] = useState<Settings>(loadSettings);
    useEffect(() => { saveSettings(settings); }, [settings]);

    const updateSetting = <K extends keyof Settings>(k: K, v: Settings[K]) => {
        setSettings(prev => ({ ...prev, [k]: v }));
    };

    return (
        <div className="cmt-page">
            <header className="cmt-header">
                <div className="cmt-title">
                    <Link to="/alg" className="cmt-gh-link cmt-bracket-icon" title={t('返回公式库', 'Back to Algorithm DB')}>
                        [,]
                    </Link>
                    <h1>{t('换位子', 'Commutator')}</h1>
                    <span className="cmt-title-sub">{t('换位子分解', 'Decompose into commutator notation')}</span>
                </div>
                <a
                    className="cmt-gh-link"
                    href="https://github.com/nbwzx/commutator"
                    target="_blank"
                    rel="noopener noreferrer"
                    title={t('上游仓库', 'Upstream repository')}
                    aria-label="Github repository"
                >
                    <ExternalLink size={16} />
                </a>
                <ThemeToggle />
                <LangToggle variant="inline" />
            </header>

            <nav className="cmt-tabs" role="tablist">
                <TabBtn active={tab === 'home'} onClick={() => setTab('home')}>{t('首页', 'Home')}</TabBtn>
                <TabBtn active={tab === 'decompose'} onClick={() => setTab('decompose')}>{t('魔方公式', "Rubik's cube")}</TabBtn>
                <TabBtn active={tab === 'excel'} onClick={() => setTab('excel')}>Excel</TabBtn>
                <TabBtn active={tab === 'intro'} onClick={() => setTab('intro')}>{t('理论', 'Introduction')}</TabBtn>
                <TabBtn active={tab === 'about'} onClick={() => setTab('about')}>{t('关于', 'About')}</TabBtn>
            </nav>

            <main className="cmt-main">
                {tab === 'home' && <HomeTab onTry={() => setTab('decompose')} t={t} />}
                {tab === 'decompose' && <DecomposeTab settings={settings} updateSetting={updateSetting} t={t} />}
                {tab === 'excel' && <ExcelTab settings={settings} updateSetting={updateSetting} t={t} />}
                {tab === 'intro' && <IntroTab t={t} />}
                {tab === 'about' && <AboutTab t={t} />}
            </main>
        </div>
    );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            role="tab"
            aria-selected={active}
            className={`cmt-tab${active ? ' is-active' : ''}`}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

// ── Settings panel (shared by Decompose / Excel) ──────────────────────

function SettingsPanel({
    settings, updateSetting, t,
}: {
    settings: Settings;
    updateSetting: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
    t: (zh: string, en: string) => string;
}) {
    return (
        <section className="cmt-pane">
            <h3 className="cmt-section-title">{t('设置', 'Settings')}</h3>
            <div className="cmt-settings">
                <div className="cmt-setting-row">
                    <span>{t('阶数', 'Order')}:</span>
                    <input
                        type="text"
                        inputMode="numeric"
                        className="cmt-num-input"
                        placeholder="4"
                        value={settings.order}
                        onChange={(e) => updateSetting('order', e.target.value)}
                    />
                    <Help title={t('order=4 (魔方)\norder=5 (五魔方)\norder=3 (金字塔)\norder=0 表示自由群', 'order = 4 (e.g. cube)\norder = 5 (e.g. Megaminx)\norder = 3 (e.g. Pyraminx)\norder = 0 means free group')} />
                </div>

                <CheckRow
                    label={t('所有换位子加外括号', 'Outer bracket for all commutators')}
                    checked={settings.outerBracket}
                    onChange={(v) => updateSetting('outerBracket', v)}
                    help={t('勾选: [a:[b,c][d,e]]\n不勾: a:[[b,c]+[d,e]]', 'Checked: [a:[b,c][d,e]]\nUnchecked: a:[[b,c]+[d,e]]')}
                />

                <CheckRow
                    label={t('Initial Replace (输入端: r → R M\')', 'Initial Replace')}
                    checked={settings.initialReplace}
                    onChange={(v) => updateSetting('initialReplace', v)}
                    help={t('替换双层转动 (e.g. r → R M\')', 'Replace double layer turns (e.g. r → R M\')')}
                />

                <CheckRow
                    label={t('Final Replace (输出端: R M\' → r)', 'Final Replace')}
                    checked={settings.finalReplace}
                    onChange={(v) => updateSetting('finalReplace', v)}
                    help={t('输出回拼双层 (e.g. R M\' → r)', 'Replace double layer turns (e.g. R M\' → r)')}
                />

                <CheckRow
                    label={t('Commute (处理可交换转动)', 'Commute')}
                    checked={settings.commute}
                    onChange={(v) => updateSetting('commute', v)}
                    help={t('R 和 L 等可交换的转动', 'Handle commute moves (e.g. R and L)')}
                />

                <div className="cmt-setting-row">
                    <span>{t('最大深度', 'Max Depth')}:</span>
                    <input
                        type="text"
                        inputMode="numeric"
                        className="cmt-num-input"
                        placeholder="0"
                        value={settings.maxDepth}
                        onChange={(e) => updateSetting('maxDepth', e.target.value)}
                    />
                    <Help title={t('搜索深度上限\n0 表示首个可解深度', 'Upper bound of search depth\n0 means first solvable depth')} />
                </div>

                <div className="cmt-setting-row" style={{ marginTop: 4 }}>
                    <span style={{ width: '100%', color: 'var(--cmt-text-sub)', fontSize: '0.85rem' }}>{t('排序规则', 'Sorting rules')}:</span>
                </div>
                <div className="cmt-setting-row">
                    <span>{t('C:[A,B] 评分 = ', 'Score of C:[A,B] = ')}</span>
                    <input
                        type="text"
                        inputMode="decimal"
                        className="cmt-num-input"
                        placeholder="2.5"
                        value={settings.abMaxScore}
                        onChange={(e) => updateSetting('abMaxScore', e.target.value)}
                    />
                    <span>· stm(A) +</span>
                    <input
                        type="text"
                        inputMode="decimal"
                        className="cmt-num-input"
                        placeholder="5"
                        value={settings.abMinScore}
                        onChange={(e) => updateSetting('abMinScore', e.target.value)}
                    />
                    <span>· stm(B) + stm(C)</span>
                    <Help title={t('假设 stm(A) ≥ stm(B), stm = slice turn metric\n按评分从低到高排序', 'Assumes stm(A) ≥ stm(B). stm = slice turn metric.\nResults sorted by score, ascending.')} />
                </div>

                <div className="cmt-setting-row">
                    <span>{t('加项惩罚', 'Addition penalty')}:</span>
                    <input
                        type="text"
                        inputMode="decimal"
                        className="cmt-num-input"
                        placeholder="1"
                        value={settings.addScore}
                        onChange={(e) => updateSetting('addScore', e.target.value)}
                    />
                    <Help title={t('换位子组合的额外评分', 'Score for commutator combo')} />
                </div>

                <CheckRow
                    label={t('快速模式 (只输出第一个解)', 'Fast (single result)')}
                    checked={settings.fast}
                    onChange={(v) => updateSetting('fast', v)}
                    help={t('只显示一个结果, 速度更快', 'Show one result only')}
                />
            </div>
        </section>
    );
}

function CheckRow({ label, checked, onChange, help }: {
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
    help?: string;
}) {
    return (
        <div className="cmt-setting-row">
            <label className="cmt-check-label">
                <input
                    type="checkbox"
                    className="cmt-checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                />
                {label}
            </label>
            {help && <Help title={help} />}
        </div>
    );
}

function Help({ title }: { title: string }) {
    return (
        <span className="cmt-help" title={title} aria-label="help">
            <HelpCircle size={14} />
        </span>
    );
}

// ── Home tab ───────────────────────────────────────────────────────────

function HomeTab({ onTry, t }: { onTry: () => void; t: (zh: string, en: string) => string }) {
    return (
        <section className="cmt-pane cmt-home-pane">
            <div>
                <h2>Commutator</h2>
                <h4>{t('描述', 'Description')}</h4>
                <ul>
                    <li>{t('分解三阶魔方公式', "Decompose a Rubik's cube algorithm.")}</li>
                    <li>{t('展开三阶魔方换位子记号', "Expand a Rubik's cube commutator notation.")}</li>
                    <li>{t('分解自由群算法', 'Decompose a free group algorithm.')}</li>
                    <li>{t('批量分解 Excel 文件中的公式', 'Decompose for algorithms in an excel file.')}</li>
                    <li>……</li>
                </ul>
                <button type="button" className="cmt-btn cmt-btn-secondary" onClick={onTry}>
                    {t('开始使用', 'Try It Out')}
                </button>
            </div>
        </section>
    );
}

// ── Decompose tab ───────────────────────────────────────────────────────

const PRESETS = [
    "R U R' U'",
    "D F' R U' R' D' R D U R' F R D' R'",
    "R' F' R D' R D R2 F2 R2 D' R' D R' F' R",
    "U' R U R2 D' R2 U' R' U R2 D R2",
];

function DecomposeTab({
    settings, updateSetting, t,
}: {
    settings: Settings;
    updateSetting: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
    t: (zh: string, en: string) => string;
}) {
    const [alg, setAlg] = useState('');
    const [output, setOutput] = useState('');
    const [working, setWorking] = useState(false);
    const [copied, setCopied] = useState(false);

    const onDecompose = useCallback(() => {
        if (alg.trim() === '') { setOutput(''); return; }
        setWorking(true);
        // Defer to next tick so the UI can update.
        setTimeout(() => {
            try {
                const res = cmtSearch(buildSearchOpts(settings, alg));
                setOutput(res.join('\n'));
            } catch (e) {
                setOutput(`Error: ${(e as Error).message}`);
            }
            setWorking(false);
        }, 0);
    }, [alg, settings]);

    const onExpand = useCallback(() => {
        if (alg.trim() === '') { setOutput(''); return; }
        try {
            const res = cmtExpand(buildExpandOpts(settings, alg));
            setOutput(res);
        } catch (e) {
            setOutput(`Error: ${(e as Error).message}`);
        }
    }, [alg, settings]);

    const copy = async () => {
        if (!output) return;
        try {
            await navigator.clipboard.writeText(output);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        } catch { /* swallow */ }
    };

    const outRows = useMemo(() => Math.max(1, output.split('\n').length), [output]);

    return (
        <>
            <SettingsPanel settings={settings} updateSetting={updateSetting} t={t} />

            <section className="cmt-pane">
                <label className="cmt-input-label" htmlFor="cmt-alg">{t('输入', 'Input')}</label>
                <input
                    id="cmt-alg"
                    type="text"
                    className="cmt-alg-input"
                    placeholder={t('输入公式 (e.g. R U R\' U\')', 'Enter an algorithm')}
                    value={alg}
                    onChange={(e) => setAlg(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') onDecompose(); }}
                    spellCheck={false}
                    autoComplete="off"
                />
                <div className="cmt-actions">
                    <button type="button" className="cmt-btn" onClick={onDecompose} disabled={working}>
                        {working ? t('计算中…', 'Working…') : t('分解', 'Decompose Me')}
                    </button>
                    <button type="button" className="cmt-btn cmt-btn-secondary" onClick={onExpand} disabled={working}>
                        {t('展开', 'Expand Me')}
                    </button>
                </div>

                <div style={{ marginTop: 16 }}>
                    <label className="cmt-output-label" htmlFor="cmt-out">{t('输出', 'Output')}</label>
                    <textarea
                        id="cmt-out"
                        className="cmt-output-area"
                        readOnly
                        value={output}
                        rows={outRows}
                        spellCheck={false}
                    />
                    <div className="cmt-output-actions">
                        <button type="button" className="cmt-copy-btn" onClick={copy} disabled={!output}>
                            {copied ? <Check size={12} /> : <Copy size={12} />}
                            {copied ? t('已复制', 'Copied') : t('复制', 'Copy')}
                        </button>
                    </div>
                </div>

                <div style={{ marginTop: 14, fontSize: '0.82rem', color: 'var(--cmt-text-mute)' }}>
                    {t('试试: ', 'Try: ')}
                    {PRESETS.map((p, i) => (
                        <span key={p}>
                            {i > 0 && <span style={{ margin: '0 6px' }}>·</span>}
                            <button
                                type="button"
                                style={{ background: 'transparent', border: 'none', color: 'var(--cmt-accent)', cursor: 'pointer', fontFamily: 'var(--cmt-mono)', padding: 0, fontSize: 'inherit' }}
                                onClick={() => setAlg(p)}
                            >
                                {p}
                            </button>
                        </span>
                    ))}
                </div>
            </section>
        </>
    );
}

// ── Excel tab ──────────────────────────────────────────────────────────

function ExcelTab({
    settings, updateSetting, t,
}: {
    settings: Settings;
    updateSetting: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
    t: (zh: string, en: string) => string;
}) {
    const [status, setStatus] = useState<{ msg: string; isError?: boolean } | null>(null);
    const [tableHtml, setTableHtml] = useState('');
    const fileDecRef = useRef<HTMLInputElement>(null);
    const fileExpRef = useRef<HTMLInputElement>(null);

    const handleFile = useCallback(async (file: File, mode: 'decompose' | 'expand') => {
        setStatus({ msg: t('读取文件中…', 'Reading file…') });
        setTableHtml('');
        try {
            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type: 'array' });
            const sheet = wb.Sheets[wb.SheetNames[0]];

            // Mirror upstream's sheet_to_formulae path: build a {col+row: value} map, find max row,
            // collect distinct column letters, iterate per row.
            const formulae: string[] = XLSX.utils.sheet_to_formulae(sheet);
            const obj: Record<string, string> = {};
            const titleSet = new Set<string>();
            let maxRow = 0;
            for (const entry of formulae) {
                const eqIdx = entry.indexOf('=');
                if (eqIdx < 0) continue;
                const cellRef = entry.slice(0, eqIdx);
                const cellVal = entry.slice(eqIdx + 1);
                obj[cellRef] = cellVal;
                titleSet.add(cellRef.charAt(0));
                const rowN = parseInt(cellRef.slice(1), 10);
                if (!isNaN(rowN) && rowN > maxRow) maxRow = rowN;
            }
            const titles = [...titleSet];

            setStatus({ msg: t(`处理 ${maxRow} 行…`, `Processing ${maxRow} rows…`) });

            const arrOut: string[][] = [];
            const escapeHtml = (s: string) => s.replace(/[&<>"']/g, ch => (
                { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string
            ));
            let html = '<table class="cmt-excel-table">';
            for (let i = 1; i <= maxRow; i++) {
                html += '<tr>';
                arrOut.push([]);
                for (let j = 0; j < titles.length; j++) {
                    const key = titles[j] + i;
                    if (Object.prototype.hasOwnProperty.call(obj, key)) {
                        const algRaw = obj[key].replace(/'/g, '');
                        html += `<td>${escapeHtml(algRaw)}</td>`;
                        arrOut[i - 1].push(algRaw);
                        if (algRaw.length >= 4) {
                            let result = '';
                            try {
                                if (mode === 'decompose') {
                                    const r = cmtSearch(buildSearchOpts(settings, algRaw));
                                    result = r[0] ?? '';
                                } else {
                                    result = cmtExpand(buildExpandOpts(settings, algRaw));
                                }
                            } catch (e) {
                                result = `Error: ${(e as Error).message}`;
                            }
                            html += `<td>${escapeHtml(result)}</td>`;
                            arrOut[i - 1].push(result);
                        }
                    } else {
                        html += '<td></td>';
                    }
                }
                html += '</tr>';
            }
            html += '</table>';
            setTableHtml(html);

            const newWb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(newWb, XLSX.utils.aoa_to_sheet(arrOut), 'Sheet1');
            const monthArr = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
            const suffix = ['st', 'nd', 'rd', 'th'];
            const d = new Date();
            const dd = d.getDate();
            const dStr = dd + (dd % 10 < 1 || dd % 10 > 3 || (dd >= 11 && dd <= 13) ? suffix[3] : suffix[(dd % 10) - 1]);
            XLSX.utils.book_append_sheet(newWb, XLSX.utils.aoa_to_sheet([
                ['Generated by https://www.cuberoot.me/alg/commutator (port of nbwzx/commutator).'],
                [`Latest update on ${dStr} ${monthArr[d.getMonth()]} ${d.getFullYear()}`],
            ]), 'Readme');
            XLSX.writeFile(newWb, 'output.xlsx');

            setStatus({ msg: t(`完成! 已下载 output.xlsx (共 ${maxRow} 行)`, `Done. output.xlsx downloaded (${maxRow} rows)`) });
        } catch (e) {
            setStatus({ msg: `${t('错误', 'Error')}: ${(e as Error).message}`, isError: true });
        } finally {
            if (fileDecRef.current) fileDecRef.current.value = '';
            if (fileExpRef.current) fileExpRef.current.value = '';
        }
    }, [settings, t]);

    return (
        <>
            <SettingsPanel settings={settings} updateSetting={updateSetting} t={t} />

            <section className="cmt-pane">
                <p className="cmt-excel-blurb">
                    {t(
                        '导入 Excel 文件 (.xlsx / .xls / .csv), 批量分解或展开其中所有公式, 自动下载 output.xlsx。',
                        'Import an excel file (*.xlsx, *.xls, *.csv) to decompose or expand every algorithm inside. Output downloads as output.xlsx.'
                    )}
                </p>
                <p className="cmt-excel-blurb">
                    {t('可先下载示例文件: ', 'You can download the example file: ')}
                    <a href="https://github.com/nbwzx/commutator/raw/main/assets/files/test.xlsx" target="_blank" rel="noopener noreferrer">test.xlsx</a>
                </p>

                <div className="cmt-file-row">
                    <strong>{t('分解 (Decompose):', 'Decompose:')}</strong>
                    <input
                        ref={fileDecRef}
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f, 'decompose'); }}
                    />
                </div>

                <div className="cmt-file-row">
                    <strong>{t('展开 (Expand):', 'Expand:')}</strong>
                    <input
                        ref={fileExpRef}
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f, 'expand'); }}
                    />
                </div>

                {status && (
                    <div className={`cmt-excel-status${status.isError ? ' is-error' : ''}`}>{status.msg}</div>
                )}

                {tableHtml && (
                    <div className="cmt-excel-table-wrap" dangerouslySetInnerHTML={{ __html: tableHtml }} />
                )}
            </section>
        </>
    );
}

// ── Intro tab ──────────────────────────────────────────────────────────

function IntroTab({ t }: { t: (zh: string, en: string) => string }) {
    return (
        <section className="cmt-pane cmt-intro-pane">
            <h2>{t('换位子理论', 'Introduction')}</h2>
            <p>{t('用换位子记号分解公式。', 'Decompose algorithms in commutator notation.')}</p>

            <p>
                {t('设 ', 'Let ')}<span className="cmt-math">G</span>
                {t(' 为任意群。若 ', ' be any group. If ')}<span className="cmt-math">a, b ∈ G</span>
                {t(',则 ', ', then the commutator of ')}<span className="cmt-math">a</span>
                {t(' 与 ', ' and ')}<span className="cmt-math">b</span>
                {t(' 的换位子为 ', ' is the element ')}<span className="cmt-math">[a, b] = a b a⁻¹ b⁻¹</span>。
                {t('表达式 ', ' The expression ')}<span className="cmt-math">x : a</span>
                {t(' 表示 ', ' denotes the conjugate of ')}<span className="cmt-math">a</span>
                {t(' 被 ', ' by ')}<span className="cmt-math">x</span>
                {t(' 共轭后的结果, 即 ', ', defined as ')}<span className="cmt-math">x a x⁻¹</span>。
                {t('因此 ', ' Therefore, ')}<span className="cmt-math">c : [a, b]</span>
                {t(' 表示 ', ' means ')}<span className="cmt-math">c a b a⁻¹ b⁻¹ c⁻¹</span>。
            </p>

            <p>
                {t('本工具中假定 ', 'In this repository, we assume that ')}<span className="cmt-math">G</span>
                {t(' 是自由群。', ' is a free group.')}
            </p>

            <p>
                {t('在数学中, 自由群 ', 'In mathematics, the free group ')}<span className="cmt-math">F_S</span>
                {t(' 在给定集合 ', ' over a given set ')}<span className="cmt-math">S</span>
                {t(' 上的元素由 S 的成员所构成的字 (word) 组成 — 仅当群公理决定两字相等时才视为同一元素 (例: ', ' consists of all words built from members of S — two words are equal only if the group axioms force them to be (e.g. ')}
                <span className="cmt-math">s t = s u u⁻¹ t</span>{t(',但 ', ' but ')}<span className="cmt-math">s ≠ t⁻¹</span>
                {t(')。', ').')}
            </p>

            <p>
                {t('许多三阶魔方的 3-cycle / 5-cycle 公式都可以分解为换位子。', "Many 3-cycle and 5-cycle algorithms in a Rubik's cube can be decomposed into commutators.")}
            </p>

            <h3>{t('示例 1', 'Example 1')}</h3>
            <pre>{`Input:  s = "R U R' U'"
Output: "[R,U]"`}</pre>

            <h3>{t('示例 2', 'Example 2')}</h3>
            <pre>{`Input:  s = "a b c a' b' c'"
Output: "[a b,c a']"
Note:   "[a b,c b]" is also valid.`}</pre>

            <h3>{t('示例 3', 'Example 3')}</h3>
            <pre>{`Input:  s = "D F' R U' R' D' R D U R' F R D' R'"
Output: "D:[F' R U' R',D' R D R']"`}</pre>

            <h3>{t('示例 4', 'Example 4')}</h3>
            <pre>{`Input:  s = "R' F' R D' R D R2 F2 R2 D' R' D R' F' R"
Output: "R' F':[R D' R D R2,F2]"`}</pre>

            <h3>{t('示例 5 (无解)', 'Example 5 (no solution)')}</h3>
            <pre>{`Input:  s = "R U R'"
Output: "Not found."`}</pre>

            <h3>{t('约束', 'Constraints')}</h3>
            <ul>
                <li>{t('输入仅由英文字母 (动作记号) 组成。', 's consists of only English letters.')}</li>
            </ul>
        </section>
    );
}

// ── About tab ──────────────────────────────────────────────────────────

function AboutTab({ t }: { t: (zh: string, en: string) => string }) {
    return (
        <section className="cmt-pane cmt-about-pane">
            <h3>{t('原作者', 'Original Author')}</h3>
            <p>
                {t('换位子算法与原版 Web 工具由 ', 'The commutator algorithm and original web tool are by ')}
                <a href="https://zixingwang.com" target="_blank" rel="noopener noreferrer">Zixing Wang</a>
                {t(' (', ' (')}<a href="https://github.com/nbwzx/commutator" target="_blank" rel="noopener noreferrer">nbwzx/commutator</a>{')'}{t('。', '.')}
            </p>

            <h3>{t('本页', 'This Port')}</h3>
            <p>
                {t('本页将原 Bootstrap 多页站点重构为单页 React 工具, 嵌入到 cuberoot.me 公式库下。原 TypeScript 引擎 ',
                  'This page rewraps the original multi-page Bootstrap site as a single React tool inside cuberoot.me Algorithm DB. The original TypeScript engine ')}
                <code>commutator.ts</code>
                {t(' 仅做最小修改 (去掉 IIFE 包装, 改为 ES module 导出), 算法行为完全一致。',
                  ' is unchanged apart from stripping the IIFE wrapper for ES module export — algorithm behavior is identical.')}
            </p>

            <h3>{t('许可', 'License')}</h3>
            <p>
                {t('原项目以 ', 'The upstream project is licensed under ')}
                <a href="https://mit-license.org" target="_blank" rel="noopener noreferrer">MIT</a>
                {t(' 协议发布; 本端口同样遵守该许可。', '; this port inherits the same license.')}
            </p>

            <h3>{t('致谢', 'Support / Credits')}</h3>
            <ul>
                <li>{t('Excel 解析: ', 'Excel parsing: ')}<a href="https://sheetjs.com" target="_blank" rel="noopener noreferrer">SheetJS</a></li>
                <li>
                    {t('原页面图: ', 'Original homepage image: ')}
                    <a href="https://commons.wikimedia.org/wiki/File:Cayley_graph_of_F2.svg" target="_blank" rel="noopener noreferrer">Dbenbenn — Cayley graph of F₂</a>
                </li>
                <li>
                    {t('原作者感谢 ', 'Original author thanks ')}
                    <a href="https://github.com/abunickabhi" target="_blank" rel="noopener noreferrer">Abhijeet Ghodgaonkar</a>,{' '}
                    <a href="https://github.com/lgarron" target="_blank" rel="noopener noreferrer">Lucas Garron</a>,{' '}
                    <a href="https://github.com/jarlly678" target="_blank" rel="noopener noreferrer">Songtao Mao</a>
                    {t(' 对原项目的建议。', ' for their valuable suggestions on the upstream project.')}
                </li>
            </ul>
        </section>
    );
}
