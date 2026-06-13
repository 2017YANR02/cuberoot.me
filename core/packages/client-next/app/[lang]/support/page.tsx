'use client';

/**
 * /support — 致谢 / 赞助墙。
 * 公开展示赞助者(头像 + 名字 + WCA ID + 金额,金额降序),顶部「支持本站」开打赏弹窗
 * (复用 DonateModal)。admin 登录后行内 + 新增 / 编辑 / 删除,数据走 /v1/sponsors。
 */
import { useEffect, useMemo, useState } from 'react';
import { Heart, Plus, Pencil, Trash2 } from 'lucide-react';
import { tr, useLang } from '@/i18n/tr';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import AppLink from '@/components/AppLink';
import DonateModal from '@/components/DonateModal';
import { displayCuberName } from '@/lib/cuber-name-display';
import { isAdmin } from '@/lib/auth-store';
import { listSponsors, deleteSponsor, type Sponsor } from '@/lib/sponsors-api';
import SponsorEditor from './SponsorEditor';
import './support.css';

const INITIAL_VISIBLE = 18;
const CURRENCY_SYMBOL: Record<string, string> = { CNY: '¥', USD: '$', EUR: '€' };

function fmtAmount(amount: number, currency: string): string {
  const sym = CURRENCY_SYMBOL[currency] || '';
  const n = Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(/\.?0+$/, '');
  return `${sym}${n}`;
}

function firstGlyph(name: string): string {
  const t = name.trim();
  if (!t) return '?';
  return String.fromCodePoint(t.codePointAt(0) ?? 63).toUpperCase();
}

function SponsorCard({ sponsor, isZh, admin, onEdit, onDelete }: {
  sponsor: Sponsor;
  isZh: boolean;
  admin: boolean;
  onEdit: (s: Sponsor) => void;
  onDelete: (s: Sponsor) => void;
}) {
  const name = displayCuberName(sponsor.name, isZh);
  const avatar = (
    <span className="sponsor-avatar">
      {sponsor.avatarUrl
        ? <img src={sponsor.avatarUrl} alt="" loading="lazy" decoding="async" />
        : <span className="sponsor-avatar-fb">{firstGlyph(name)}</span>}
    </span>
  );

  return (
    <div className="sponsor-card" title={sponsor.message || undefined}>
      {sponsor.wcaId
        ? <AppLink href={`/person/${sponsor.wcaId}`} className="sponsor-avatar-link" aria-label={name}>{avatar}</AppLink>
        : avatar}
      {sponsor.wcaId
        ? <AppLink href={`/person/${sponsor.wcaId}`} className="sponsor-name sponsor-name-link">{name}</AppLink>
        : <span className="sponsor-name">{name}</span>}
      {sponsor.wcaId && <span className="sponsor-wcaid">{sponsor.wcaId}</span>}
      <span className="sponsor-amount">{fmtAmount(sponsor.amount, sponsor.currency)}</span>
      {admin && (
        <div className="sponsor-admin">
          <button onClick={() => onEdit(sponsor)} aria-label="edit"><Pencil size={13} /></button>
          <button className="sponsor-admin-del" onClick={() => onDelete(sponsor)} aria-label="delete"><Trash2 size={13} /></button>
        </div>
      )}
    </div>
  );
}

export default function SupportPage() {
  const lang = useLang();
  const isZh = lang !== 'en';
  useDocumentTitle('致谢', 'Acknowledgments');

  // admin 来自 client-only auth store;mount 后再 gate,避免 SSR/首帧 hydration mismatch。
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const admin = mounted && isAdmin();

  const [sponsors, setSponsors] = useState<Sponsor[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [donateOpen, setDonateOpen] = useState(false);
  const [editing, setEditing] = useState<Sponsor | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancel = false;
    listSponsors()
      .then(rows => { if (!cancel) setSponsors(rows); })
      .catch(e => { if (!cancel) setLoadErr(e instanceof Error ? e.message : String(e)); });
    return () => { cancel = true; };
  }, []);

  const total = sponsors?.length ?? 0;
  const visible = useMemo(
    () => (sponsors ? (expanded ? sponsors : sponsors.slice(0, INITIAL_VISIBLE)) : []),
    [sponsors, expanded],
  );
  const remaining = total - visible.length;

  function applySaved(saved: Sponsor) {
    setSponsors(prev => {
      const list = prev ? prev.slice() : [];
      const i = list.findIndex(s => s.id === saved.id);
      if (i >= 0) list[i] = saved; else list.push(saved);
      list.sort((a, b) => b.amount - a.amount);
      return list;
    });
    setEditing(null);
    setCreating(false);
  }

  async function handleDelete(s: Sponsor) {
    if (!window.confirm(tr({ zh: '删除「{n}」?', en: 'Delete "{n}"?',
        zhHant: "刪除「{n}」?"
    }).replace('{n}', s.name))) return;
    try {
      await deleteSponsor(s.id);
      setSponsors(prev => prev?.filter(x => x.id !== s.id) ?? null);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="support-page">
      <header className="support-head">
        <h1 className="support-title">{tr({ zh: '致谢', en: 'Acknowledgments',
            zhHant: "致謝"
        })}</h1>
        <p className="support-sub">
          {tr({
            zh: '所有赞助将全部用于服务器购买与日常维护。感谢每一位支持 CubeRoot 的朋友。',
            en: 'Every donation goes entirely toward server costs and upkeep. Thank you to everyone who supports CubeRoot.',
              zhHant: "所有贊助將全部用於伺服器購買與日常維護。感謝每一位支援 CubeRoot 的朋友。"
        })}
        </p>
        <button className="support-cta" onClick={() => setDonateOpen(true)}>
          <Heart size={15} className="support-cta-heart" />
          {tr({ zh: '支持本站', en: 'Support this site',
              zhHant: "支援本站"
        })}
        </button>
      </header>

      {loadErr ? (
        <div className="support-empty">{tr({ zh: '加载失败', en: 'Failed to load',
            zhHant: "載入失敗"
        })}: {loadErr}</div>
      ) : !sponsors ? (
        <div className="support-empty">{tr({ zh: '加载中…', en: 'Loading…',
            zhHant: "載入中…"
        })}</div>
      ) : (
        <>
          <div className="support-count">
            <span>
              {total > 0
                ? tr({ zh: '已有 {n} 位朋友赞助', en: '{n} supporters so far',
                    zhHant: "已有 {n} 位朋友贊助"
                }).replace('{n}', String(total))
                : tr({ zh: '成为第一位赞助者', en: 'Be the first supporter',
                    zhHant: "成為第一位贊助者"
                })}
            </span>
            {admin && (
              <button className="support-add" onClick={() => setCreating(true)}>
                <Plus size={13} /> {tr({ zh: '新增', en: 'Add' })}
              </button>
            )}
          </div>

          {total > 0 && (
            <div className="support-grid">
              {visible.map(s => (
                <SponsorCard
                  key={s.id}
                  sponsor={s}
                  isZh={isZh}
                  admin={admin}
                  onEdit={setEditing}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}

          {remaining > 0 && (
            <button className="support-more" onClick={() => setExpanded(true)}>
              {tr({ zh: '展开剩余 {n} 人', en: 'Show {n} more',
                  zhHant: "展開剩餘 {n} 人"
            }).replace('{n}', String(remaining))}
            </button>
          )}
        </>
      )}

      {donateOpen && <DonateModal lang={isZh ? 'zh' : 'en'} onClose={() => setDonateOpen(false)} />}
      {(editing || creating) && (
        <SponsorEditor
          initial={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={applySaved}
        />
      )}
    </div>
  );
}
