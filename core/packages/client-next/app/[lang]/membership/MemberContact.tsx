'use client';

/**
 * 会员联系方式:用于到期续费提醒 / 万一 WCA 登录失效时人工找回会员资格。可留空。
 */
import { useState } from 'react';
import { Check } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { setMyContact, type Membership } from '@/lib/membership-api';

interface Props {
  membership: Membership;
  onSaved: (m: Membership) => void;
  isZh: boolean;
}

const KINDS: Array<{ v: string; zh: string; en: string }> = [
  { v: 'email', zh: '邮箱', en: 'Email' },
  { v: 'wechat', zh: '微信', en: 'WeChat' },
  { v: 'qq', zh: 'QQ', en: 'QQ' },
  { v: 'phone', zh: '手机', en: 'Phone' },
  { v: 'other', zh: '其他', en: 'Other' },
];

export default function MemberContact({ membership, onSaved }: Props) {
  const [contact, setContact] = useState(membership.contact ?? '');
  const [kind, setKind] = useState(membership.contactKind ?? 'email');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true); setErr(null); setSaved(false);
    try {
      const trimmed = contact.trim();
      const r = await setMyContact({ contact: trimmed || null, contactKind: trimmed ? kind : null });
      onSaved(r.membership);
      setSaved(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mem-contact">
      <h3 className="mem-contact-title">{tr({ zh: '续费提醒联系方式', en: 'Contact for renewal reminders'
    })}</h3>
      <p className="mem-contact-hint">
        {tr({
          zh: '选填。到期前用于提醒续费,或在 WCA 登录失效时帮你找回会员资格。',
          en: 'Optional. Used to remind you before expiry, or to restore your membership if WCA sign-in breaks.'
        })}
      </p>
      <div className="mem-contact-row">
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="mem-contact-kind">
          {KINDS.map((k) => <option key={k.v} value={k.v}>{tr({ zh: k.zh, en: k.en })}</option>)}
        </select>
        <input
          className="mem-contact-input"
          value={contact}
          onChange={(e) => { setContact(e.target.value); setSaved(false); }}
          placeholder={tr({ zh: '填写联系方式', en: 'Your contact'
        })}
          maxLength={200}
        />
        <button className="mem-contact-save" onClick={() => void save()} disabled={saving}>
          {saved ? <Check size={14} /> : saving ? '…' : tr({ zh: '保存', en: 'Save'
        })}
        </button>
      </div>
      {err && <div className="mem-pay-err">{err}</div>}
    </section>
  );
}
