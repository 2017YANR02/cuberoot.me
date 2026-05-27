'use client';
// See ./page.tsx for the deferred-feature note. This component holds the actual form state.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, LogIn, LogOut } from 'lucide-react';
import type { ReconSolve } from '@cuberoot/shared';
import { addRecon, getRecon, updateRecon } from '@/lib/recon-api';
import { useAuthStore } from '@/lib/auth-store';
import { CompPicker } from '@/components/CompPicker';
import { WcaPersonPicker } from '@/components/WcaPersonPicker';
import { Flag } from '@/components/Flag';
import { ClearButton } from '@/components/ClearButton';
import { displayCuberName } from '@/lib/name-utils';
import { localizeCompName } from '@/lib/comp-localize';
import { parseTimeInput, formatTimeInput, attemptsPerRound } from '@/lib/recon-utils';
import LangToggle from '@/components/LangToggle';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import type { Comp } from '@/lib/comp-search';
import type { WcaPersonLite } from '@/lib/wca-api';
import '../recon.css';

const EVENTS = ['3x3', '2x2', '4x4', '5x5', '6x6', '7x7', '3bld', '4bld', '5bld', 'oh', 'sq1', 'pyra', 'mega', 'clock', 'skewb', 'fmc', 'mbld'];
const METHODS = ['CFOP', 'Roux', 'ZZ', 'Petrus', 'LBL', 'Mehta', 'ZB', 'Other'];
const ROUNDS = ['1', '2', '3', 'f'];

function toDateInput(val: string | null | undefined): string {
  if (!val) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  if (val.length >= 10 && val[4] === '-') return val.slice(0, 10);
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export default function ReconSubmitForm({ editId }: { editId?: string } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('提交复盘', 'Submit Reconstruction');
  const authUser = useAuthStore(s => s.user);
  const login = useAuthStore(s => s.login);
  const logout = useAuthStore(s => s.logout);

  const isEditing = !!editId;
  const [loadingEdit, setLoadingEdit] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fromId = !isEditing ? searchParams?.get('from') : null;
  const fromSolveNum = !isEditing ? searchParams?.get('solveNum') : null;
  const lockIdentity = isEditing || !!fromId;

  const [form, setForm] = useState<Partial<ReconSolve>>({
    official: true,
    event: '3x3',
    method: 'CFOP',
    person: '',
    personId: '',
    personCountry: '',
    comp: '',
    compWcaId: '',
    country: '',
    round: '',
    rawTime: undefined,
    average: undefined,
    solution: '',
    wcaScramble: '',
    optimalScramble: '',
    note: '',
    videoUrl: '',
    cube: '',
  });
  const [timeInput, setTimeInput] = useState('');
  const [avgInput, setAvgInput] = useState('');

  // Edit mode: load existing recon
  useEffect(() => {
    if (!isEditing || !editId) return;
    setLoadingEdit(true);
    getRecon(Number(editId)).then(solve => {
      setForm({
        ...solve,
        date: toDateInput(solve.date),
        reconDate: toDateInput(solve.reconDate),
      });
      if (solve.rawTime != null) setTimeInput(formatTimeInput(solve.rawTime));
      if (solve.average != null) setAvgInput(formatTimeInput(solve.average));
      setLoadingEdit(false);
    }).catch(e => {
      setErr(e.message);
      setLoadingEdit(false);
    });
  }, [editId, isEditing]);

  // ?from= prefill mode (same-round sibling)
  useEffect(() => {
    if (isEditing || !fromId) return;
    setLoadingEdit(true);
    getRecon(Number(fromId)).then(src => {
      const targetSolveNum = fromSolveNum ? Number(fromSolveNum) : undefined;
      setForm(prev => ({
        ...prev,
        official: src.official,
        event: src.event,
        method: src.method,
        person: src.person,
        personId: src.personId,
        personCountry: src.personCountry,
        comp: src.comp,
        compWcaId: src.compWcaId,
        country: src.country,
        round: src.round,
        date: toDateInput(src.date),
        average: src.average,
        solveNum: targetSolveNum ?? prev.solveNum,
        cube: src.cube,
        videoUrl: src.videoUrl,
      }));
      if (src.average != null) setAvgInput(formatTimeInput(src.average));
      setLoadingEdit(false);
    }).catch(() => setLoadingEdit(false));
  }, [fromId, fromSolveNum, isEditing]);

  // Parse time inputs → form
  useEffect(() => {
    const v = parseTimeInput(timeInput);
    if (!isNaN(v)) setForm(p => ({ ...p, rawTime: v }));
  }, [timeInput]);
  useEffect(() => {
    const v = parseTimeInput(avgInput);
    if (!isNaN(v)) setForm(p => ({ ...p, average: v }));
  }, [avgInput]);

  // Reconer defaults from auth user
  useEffect(() => {
    if (!authUser) return;
    setForm(p => ({
      ...p,
      reconer: p.reconer || authUser.name,
      reconerId: p.reconerId || authUser.wcaId,
    }));
  }, [authUser]);

  if (!authUser) {
    return (
      <div className="recon-page">
        <div className="recon-page-header">
          <div>
            <Link href="/recon" className="recon-back-link">
              <ArrowLeft size={14} /> {isZh ? '返回列表' : 'Back to list'}
            </Link>
            <h1>{isZh ? '提交复盘' : 'Submit Reconstruction'}</h1>
          </div>
          <LangToggle />
        </div>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ marginBottom: 16 }}>
            {isZh ? '提交复盘需要登录 WCA 账号。' : 'Submitting reconstructions requires a WCA account.'}
          </p>
          <button type="button" className="recon-btn" onClick={() => login()}>
            <LogIn size={14} /> {isZh ? '登录 WCA' : 'Sign in with WCA'}
          </button>
        </div>
      </div>
    );
  }

  if (loadingEdit) return <div className="recon-page"><div className="recon-loading">{isZh ? '加载中…' : 'Loading…'}</div></div>;

  const setPerson = (p: WcaPersonLite | null) => {
    if (!p) {
      setForm(prev => ({ ...prev, person: '', personId: '', personCountry: '' }));
    } else {
      setForm(prev => ({ ...prev, person: p.name, personId: p.id, personCountry: p.country_iso2 }));
    }
  };
  const setComp = (c: Comp) => {
    setForm(prev => ({
      ...prev,
      comp: c.name,
      compWcaId: c.id,
      country: (c.country || '').toLowerCase(),
      date: c.start_date,
    }));
  };
  const clearComp = () => setForm(prev => ({ ...prev, comp: '', compWcaId: '', country: '', date: '' }));

  const handleSubmit = async () => {
    if (!form.event || !form.personId) {
      setErr(isZh ? '请填写选手和项目' : 'Please pick a solver and event');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const data: Partial<ReconSolve> = {
        ...form,
        date: toDateInput(form.date),
        reconDate: toDateInput(form.reconDate),
      };
      if (isEditing && editId) {
        await updateRecon(Number(editId), data);
        router.push(`/recon/${editId}`);
      } else {
        const created = await addRecon(data);
        router.push(`/recon/${created.id}`);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const personLite: WcaPersonLite | null = form.personId
    ? { id: form.personId, name: form.person ?? form.personId, country_iso2: form.personCountry ?? '' }
    : null;

  return (
    <div className="recon-page submit-page">
      <div className="submit-header">
        <div className="detail-header">
          <div className="detail-header-nav">
            <Link href="/recon" className="recon-back-link">
              <ArrowLeft size={14} /> {isZh ? '返回列表' : 'Back to list'}
            </Link>
            <LangToggle />
            <button type="button" className="recon-btn recon-btn--ghost" onClick={() => logout()} title={authUser.wcaId}>
              <LogOut size={14} /> {displayCuberName(authUser.name, isZh)}
            </button>
          </div>
          <h1>{isEditing ? (isZh ? '编辑复盘' : 'Edit Reconstruction') : (isZh ? '提交复盘' : 'Submit Reconstruction')}</h1>
        </div>
        {err && <div className="submit-warning" style={{ color: 'crimson' }}>{err}</div>}
      </div>

      <div className="submit-form" style={{ padding: 24, maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FieldRow>
          <Label text={isZh ? '选手 *' : 'Solver *'}>
            {personLite ? (
              <div className="submit-solver-pill" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 32px 6px 8px', position: 'relative', border: '1px solid var(--border)', borderRadius: 8 }}>
                <Flag iso2={personLite.country_iso2} />
                <span>{displayCuberName(personLite.name, isZh)}</span>
                {!lockIdentity && <ClearButton onClick={() => setPerson(null)} isZh={isZh} preserveFocus />}
              </div>
            ) : (
              <WcaPersonPicker value={null} onChange={setPerson} isZh={isZh} placeholder={isZh ? '搜选手名 / WCA ID' : 'Search by name / WCA ID'} />
            )}
          </Label>
          <Label text={isZh ? '项目 *' : 'Event *'}>
            <select value={form.event ?? ''} onChange={e => setForm(p => ({ ...p, event: e.target.value }))} disabled={lockIdentity}>
              {EVENTS.map(ev => <option key={ev} value={ev}>{ev}</option>)}
            </select>
          </Label>
          <Label text={isZh ? '成绩' : 'Time'}>
            <input type="text" value={timeInput} onChange={e => setTimeInput(e.target.value)} placeholder="6.45" />
          </Label>
        </FieldRow>

        <FieldRow>
          <Label text="WCA">
            <select value={form.official ? '1' : '0'} onChange={e => setForm(p => ({ ...p, official: e.target.value === '1' }))} disabled={lockIdentity}>
              <option value="1">WCA</option>
              <option value="0">{isZh ? '非 WCA' : 'Non-WCA'}</option>
            </select>
          </Label>
          <Label text={isZh ? '比赛' : 'Competition'}>
            {form.compWcaId ? (
              <div className="submit-comp-pill" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 32px 6px 8px', position: 'relative', border: '1px solid var(--border)', borderRadius: 8 }}>
                <Flag iso2={form.country ?? ''} />
                <span>{localizeCompName(form.compWcaId, form.comp ?? '', isZh)}</span>
                {!lockIdentity && <ClearButton onClick={clearComp} isZh={isZh} preserveFocus />}
              </div>
            ) : (
              <CompPicker
                value={form.comp ?? ''}
                onChange={v => setForm(p => ({ ...p, comp: v }))}
                onPick={setComp}
                onUrlPaste={id => setForm(p => ({ ...p, comp: id, compWcaId: id }))}
                isZh={isZh}
                disableSuggestions={!form.official}
                placeholder={isZh ? '搜比赛 / 粘贴链接' : 'Search comp / paste link'}
              />
            )}
          </Label>
        </FieldRow>

        <FieldRow>
          <Label text={isZh ? '轮次' : 'Round'}>
            <select value={form.round ?? ''} onChange={e => setForm(p => ({ ...p, round: e.target.value }))}>
              <option value="">—</option>
              {ROUNDS.map(r => <option key={r} value={r}>{r === 'f' ? 'F' : `R${r}`}</option>)}
            </select>
          </Label>
          <Label text="#">
            <select value={form.solveNum ?? ''} onChange={e => setForm(p => ({ ...p, solveNum: e.target.value ? Number(e.target.value) : undefined }))}>
              <option value="">—</option>
              {Array.from({ length: form.event ? attemptsPerRound(form.event) : 5 }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </Label>
          <Label text={isZh ? '平均' : 'Average'}>
            <input type="text" value={avgInput} onChange={e => setAvgInput(e.target.value)} placeholder="6.78" />
          </Label>
          <Label text={isZh ? '方法' : 'Method'}>
            <select value={form.method ?? ''} onChange={e => setForm(p => ({ ...p, method: e.target.value }))}>
              {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </Label>
        </FieldRow>

        <Label text={isZh ? '日期' : 'Date'}>
          <input type="date" value={form.date ?? ''} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
        </Label>

        <Label text={isZh ? '打乱（WCA scramble）' : 'Scramble (WCA)'}>
          <textarea
            rows={3}
            value={form.wcaScramble ?? ''}
            onChange={e => setForm(p => ({ ...p, wcaScramble: e.target.value }))}
            style={{ fontFamily: 'monospace' }}
          />
        </Label>

        <Label text={isZh ? '最优打乱（可选）' : 'Optimal scramble (optional)'}>
          <textarea
            rows={2}
            value={form.optimalScramble ?? ''}
            onChange={e => setForm(p => ({ ...p, optimalScramble: e.target.value }))}
            style={{ fontFamily: 'monospace' }}
          />
        </Label>

        <Label text={isZh ? '解法' : 'Solution'}>
          <textarea
            rows={8}
            value={form.solution ?? ''}
            onChange={e => setForm(p => ({ ...p, solution: e.target.value }))}
            style={{ fontFamily: 'monospace' }}
            placeholder={isZh ? 'cross / F2L / OLL / PLL 每段一行,// 后面写注释' : 'cross / F2L / OLL / PLL one stage per line; // for comments'}
          />
        </Label>

        <Label text={isZh ? '视频 URL' : 'Video URL'}>
          <input type="url" value={form.videoUrl ?? ''} onChange={e => setForm(p => ({ ...p, videoUrl: e.target.value }))} placeholder="https://..." />
        </Label>

        <Label text={isZh ? '魔方' : 'Cube'}>
          <input type="text" value={form.cube ?? ''} onChange={e => setForm(p => ({ ...p, cube: e.target.value }))} placeholder="GAN 14 / WRM 2025 / ..." />
        </Label>

        <Label text={isZh ? '备注' : 'Note'}>
          <textarea
            rows={2}
            value={form.note ?? ''}
            onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
          />
        </Label>

        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <button type="button" className="recon-btn" disabled={saving} onClick={handleSubmit}>
            {saving ? (isZh ? '保存中…' : 'Saving…') : (isEditing ? (isZh ? '保存' : 'Save') : (isZh ? '提交' : 'Submit'))}
          </button>
          <Link href="/recon" className="recon-btn recon-btn--ghost">
            {isZh ? '取消' : 'Cancel'}
          </Link>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 8 }}>
          {isZh
            ? '注:自动补全、WCA 同轮成绩抓取、TwistyPlayer 实时预览、虚拟键盘尚未在 Next.js 版本实现,继续走 Vite 版本可用全功能。'
            : 'Note: smart autofill, WCA same-round attempt prefetch, TwistyPlayer live preview, and the on-screen keyboard are not yet ported. Use the Vite version for the full feature set.'}
        </p>
      </div>
    </div>
  );
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 140 }}>
      <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{text}</span>
      {children}
    </label>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{children}</div>;
}
