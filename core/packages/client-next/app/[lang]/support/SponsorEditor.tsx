'use client';

/**
 * 弹窗新增/编辑一位赞助者。输入 WCA ID 点查询可自动带出名字 + 头像(从 WCA 拉一次存下)。
 * 保存走 sponsors-api,成功后 onSaved(saved) 由父组件刷新本地列表。
 */
import { useEffect, useState } from 'react';
import { X, Search } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { fetchPersonCard } from '@/lib/wca-api';
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
  const [draft, setDraft] = useState(() => toDraft(initial));
  const [saving, setSaving] = useState(false);
  const [looking, setLooking] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => setDraft(toDraft(initial)), [initial]);

  function set<K extends keyof ReturnType<typeof toDraft>>(k: K, v: string) {
    setDraft(d => ({ ...d, [k]: v }));
  }

  async function lookup() {
    const id = draft.wcaId.trim().toUpperCase();
    if (!id) return;
    setLooking(true);
    setErr(null);
    try {
      const card = await fetchPersonCard(id);
      if (!card) { setErr(tr({ zh: '未找到该 WCA ID', en: 'WCA ID not found',
          zhHant: "未找到該 WCA ID"
    })); return; }
      setDraft(d => ({
        ...d,
        wcaId: card.id,
        name: d.name.trim() || card.name,
        avatarUrl: card.avatar || d.avatarUrl,
      }));
    } finally {
      setLooking(false);
    }
  }

  async function handleSave() {
    setErr(null);
    const amount = Number(draft.amount);
    if (!draft.name.trim()) { setErr(tr({ zh: '请填写名字', en: 'Name is required',
        zhHant: "請填寫名字"
    })); return; }
    if (!Number.isFinite(amount) || amount < 0) { setErr(tr({ zh: '金额无效', en: 'Invalid amount',
        zhHant: "金額無效"
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
          <h2>{initial ? tr({ zh: '编辑赞助者', en: 'Edit supporter',
              zhHant: "編輯贊助者"
        }) : tr({ zh: '新增赞助者', en: 'Add supporter',
            zhHant: "新增贊助者"
        })}</h2>
          <button className="sponsor-editor-close" onClick={onClose} aria-label="close"><X size={18} /></button>
        </div>

        <div className="sponsor-editor-body">
          <label className="sponsor-editor-row">
            <span>WCA ID</span>
            <div className="sponsor-editor-wca">
              <input
                value={draft.wcaId}
                onChange={e => set('wcaId', e.target.value)}
                placeholder="2017YANR02"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void lookup(); } }}
              />
              <button type="button" onClick={() => void lookup()} disabled={looking} title={tr({ zh: '查询', en: 'Look up',
                  zhHant: "查詢"
            })}>
                <Search size={14} />
              </button>
            </div>
          </label>

          {draft.avatarUrl && (
            <div className="sponsor-editor-preview">
              <img src={draft.avatarUrl} alt="" />
            </div>
          )}

          <label className="sponsor-editor-row">
            <span>{tr({ zh: '名字', en: 'Name' })} *</span>
            <input value={draft.name} onChange={e => set('name', e.target.value)} />
          </label>

          <label className="sponsor-editor-row">
            <span>{tr({ zh: '头像链接', en: 'Avatar URL',
                zhHant: "頭像連結"
            })}</span>
            <input value={draft.avatarUrl} onChange={e => set('avatarUrl', e.target.value)} placeholder="https://…" />
          </label>

          <div className="sponsor-editor-row-2">
            <label>
              <span>{tr({ zh: '金额', en: 'Amount',
                  zhHant: "金額"
            })} *</span>
              <input type="number" min="0" step="0.01" value={draft.amount} onChange={e => set('amount', e.target.value)} />
            </label>
            <label>
              <span>{tr({ zh: '货币', en: 'Currency',
                  zhHant: "貨幣"
            })}</span>
              <select value={draft.currency} onChange={e => set('currency', e.target.value)}>
                <option value="CNY">CNY ¥</option>
                <option value="USD">USD $</option>
                <option value="EUR">EUR €</option>
              </select>
            </label>
          </div>

          <label className="sponsor-editor-row">
            <span>{tr({ zh: '留言', en: 'Message' })}</span>
            <textarea rows={2} value={draft.message} onChange={e => set('message', e.target.value)} />
          </label>

          {err && <div className="sponsor-editor-err">{err}</div>}
        </div>

        <div className="sponsor-editor-foot">
          <button className="sponsor-editor-cancel" onClick={onClose} disabled={saving}>{tr({ zh: '取消', en: 'Cancel' })}</button>
          <button className="sponsor-editor-save" onClick={() => void handleSave()} disabled={saving}>
            {saving ? '…' : tr({ zh: '保存', en: 'Save',
                zhHant: "儲存"
            })}
          </button>
        </div>
      </div>
    </div>
  );
}
