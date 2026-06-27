'use client';

/**
 * 弹窗新增/编辑一位赞助者。顶部「搜索选手」直接按名字 / WCA ID 搜 WCA 选手
 * (WcaPersonPicker,本地全量索引秒搜),选中自动带出名字 + WCA ID + 头像(拉一次存下)。
 * 无独立名字输入框:名字来自选手搜索框 —— 选中选手用其 name,搜不到(没参赛的人)
 * 则把输入的文字当名字(onQueryChange),WCA ID 留空。
 * 保存走 sponsors-api,成功后 onSaved(saved) 由父组件刷新本地列表。
 */
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { tr, useLang } from '@/i18n/tr';
import { WcaPersonPicker } from '@/components/WcaPersonPicker';
import { fetchPersonCard, type WcaPersonLite } from '@/lib/wca-api';
import { createSponsor, updateSponsor, type Sponsor, type SponsorInput } from '@/lib/sponsors-api';

interface Props {
  initial: Sponsor | null;
  onClose: () => void;
  onSaved: (s: Sponsor) => void;
}

function toDraft(s: Sponsor | null) {
  return {
    name: s?.name ?? '',
    wcaId: s?.wcaId ?? '',
    avatarUrl: s?.avatarUrl ?? '',
    amount: s ? String(s.amount) : '',
    currency: s?.currency ?? 'CNY',
    message: s?.message ?? '',
  };
}

export default function SponsorEditor({ initial, onClose, onSaved }: Props) {
  const lang = useLang();
  const isZh = lang !== 'en';
  const [draft, setDraft] = useState(() => toDraft(initial));
  const [picked, setPicked] = useState<WcaPersonLite | null>(
    initial?.wcaId ? { id: initial.wcaId, name: initial.name, country_iso2: '' } : null,
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setDraft(toDraft(initial));
    setPicked(initial?.wcaId ? { id: initial.wcaId, name: initial.name, country_iso2: '' } : null);
  }, [initial]);

  // 编辑已有(带 WCA ID)时补国旗 + 缺失头像,让 chip 显示完整。
  useEffect(() => {
    if (!initial?.wcaId) return;
    let cancel = false;
    fetchPersonCard(initial.wcaId).then(card => {
      if (cancel || !card) return;
      setPicked(p => (p && p.id === card.id ? { ...p, country_iso2: card.country_iso2 } : p));
      if (card.avatar) setDraft(d => (d.avatarUrl ? d : { ...d, avatarUrl: card.avatar }));
    });
    return () => { cancel = true; };
  }, [initial?.wcaId]);

  function set<K extends keyof ReturnType<typeof toDraft>>(k: K, v: string) {
    setDraft(d => ({ ...d, [k]: v }));
  }

  async function handlePick(c: WcaPersonLite | null) {
    setPicked(c);
    if (!c) {
      // 清除选手:名字/WCA ID/头像一起清,让 admin 重新输入。
      setDraft(d => ({ ...d, name: '', wcaId: '', avatarUrl: '' }));
      return;
    }
    setDraft(d => ({ ...d, wcaId: c.id, name: c.name }));
    const card = await fetchPersonCard(c.id);
    if (card?.avatar) setDraft(d => ({ ...d, avatarUrl: card.avatar }));
  }

  async function handleSave() {
    setErr(null);
    const amount = Number(draft.amount);
    if (!draft.name.trim()) { setErr(tr({ zh: '请填写名字', en: 'Name is required'
    })); return; }
    if (!Number.isFinite(amount) || amount < 0) { setErr(tr({ zh: '金额无效', en: 'Invalid amount'
    })); return; }
    const body: SponsorInput = {
      name: draft.name.trim(),
      wcaId: draft.wcaId.trim().toUpperCase() || null,
      avatarUrl: draft.avatarUrl.trim() || null,
      amount,
      currency: draft.currency,
      message: draft.message.trim() || null,
    };
    setSaving(true);
    try {
      const saved = initial ? await updateSponsor(initial.id, body) : await createSponsor(body);
      onSaved(saved);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sponsor-editor-backdrop" onClick={onClose}>
      <div className="sponsor-editor" onClick={e => e.stopPropagation()}>
        <div className="sponsor-editor-head">
          <h2>{initial ? tr({ zh: '编辑赞助者', en: 'Edit supporter'
        }) : tr({ zh: '新增赞助者', en: 'Add supporter'
        })}</h2>
          <button className="sponsor-editor-close" onClick={onClose} aria-label="close"><X size={18} /></button>
        </div>

        <div className="sponsor-editor-body">
          <label className="sponsor-editor-row">
            <span>{tr({ zh: '搜索选手', en: 'Search cuber'
            })}</span>
            <WcaPersonPicker
              value={picked}
              onChange={c => void handlePick(c)}
              onQueryChange={q => { if (!picked) setDraft(d => ({ ...d, name: q })); }}
              isZh={isZh}
              className="sponsor-editor-picker"
              placeholder={tr({ zh: '输入名字或 WCA ID', en: 'Name or WCA ID'
            })}
            />
            <span className="sponsor-editor-hint">{tr({
              zh: '搜不到(没参加过比赛的人)也没关系,按输入的名字记录',
              en: "Not in WCA? No problem — the typed name is used as-is"
            })}</span>
          </label>

          {draft.avatarUrl && (
            <div className="sponsor-editor-preview">
              <img src={draft.avatarUrl} alt="" />
            </div>
          )}

          <label className="sponsor-editor-row">
            <span>{tr({ zh: '头像链接', en: 'Avatar URL'
            })}</span>
            <input className="sponsor-editor-input" value={draft.avatarUrl} onChange={e => set('avatarUrl', e.target.value)} placeholder="https://…" />
          </label>

          <div className="sponsor-editor-row-2">
            <label>
              <span>{tr({ zh: '金额', en: 'Amount'
            })} *</span>
              <input className="sponsor-editor-input" type="number" min="0" step="0.01" value={draft.amount} onChange={e => set('amount', e.target.value)} />
            </label>
            <label>
              <span>{tr({ zh: '货币', en: 'Currency'
            })}</span>
              <select className="sponsor-editor-select" value={draft.currency} onChange={e => set('currency', e.target.value)}>
                <option value="CNY">CNY ¥</option>
                <option value="USD">USD $</option>
                <option value="EUR">EUR €</option>
              </select>
            </label>
          </div>

          <label className="sponsor-editor-row">
            <span>{tr({ zh: '留言', en: 'Message' })}</span>
            <textarea className="sponsor-editor-textarea" rows={2} value={draft.message} onChange={e => set('message', e.target.value)} />
          </label>

          {err && <div className="sponsor-editor-err">{err}</div>}
        </div>

        <div className="sponsor-editor-foot">
          <button className="sponsor-editor-cancel" onClick={onClose} disabled={saving}>{tr({ zh: '取消', en: 'Cancel' })}</button>
          <button className="sponsor-editor-save" onClick={() => void handleSave()} disabled={saving}>
            {saving ? '…' : tr({ zh: '保存', en: 'Save'
            })}
          </button>
        </div>
      </div>
    </div>
  );
}
