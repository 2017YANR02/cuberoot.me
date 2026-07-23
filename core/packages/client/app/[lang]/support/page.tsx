'use client';

/**
 * /support — 致谢 / 赞助墙。
 * 公开展示赞助者(头像 + 名字 + 金额,金额降序)与贡献者(头像 + 名字 + 贡献次数,
 * 次数降序,issue #28)。顶部「支持本站」开打赏弹窗(复用 DonateModal)。
 * admin 登录后行内 + 新增 / 编辑 / 删除;贡献者卡片上点次数数字即 +1。
 * 数据走 /v1/sponsors + /v1/contributors。
 */
import { useEffect, useMemo, useState } from 'react';
import { Heart, Plus, Pencil, Trash2, Crown, List, X } from 'lucide-react';
import { tr, useLang } from '@/i18n/tr';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import AppLink from '@/components/AppLink';
import DonateModal from '@/components/DonateModal';
import { displayCuberName } from '@/lib/cuber-name-display';
import { isAdmin } from '@/lib/auth-store';
import { firstGlyph } from '@/lib/first-glyph';
import {
  listSponsors, deleteSponsor, type Sponsor,
  listContributors, deleteContributor, bumpContributor, type Contributor,
} from '@/lib/sponsors-api';
import SupportEditor, { type EditorTarget } from './SupportEditor';
import './support.css';

const INITIAL_VISIBLE = 18;
const CURRENCY_SYMBOL: Record<string, string> = { CNY: '¥', USD: '$', EUR: '€' };

function fmtAmount(amount: number, currency: string): string {
  const sym = CURRENCY_SYMBOL[currency] || '';
  const n = Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(/\.?0+$/, '');
  return `${sym}${n}`;
}

function PersonAvatar({ name, wcaId, avatarUrl }: { name: string; wcaId?: string; avatarUrl?: string }) {
  const avatar = (
    <span className="sponsor-avatar">
      {avatarUrl
        ? <img src={avatarUrl} alt="" loading="lazy" decoding="async" />
        : <span className="sponsor-avatar-fb">{firstGlyph(name)}</span>}
    </span>
  );
  return wcaId
    ? <AppLink href={`/wca/persons/${wcaId}`} className="sponsor-avatar-link" aria-label={name}>{avatar}</AppLink>
    : avatar;
}

function PersonName({ name, wcaId }: { name: string; wcaId?: string }) {
  return wcaId
    ? <AppLink href={`/wca/persons/${wcaId}`} className="sponsor-name sponsor-name-link">{name}</AppLink>
    : <span className="sponsor-name">{name}</span>;
}

function AdminBtns<T>({ item, onEdit, onDelete }: { item: T; onEdit: (x: T) => void; onDelete: (x: T) => void }) {
  return (
    <div className="sponsor-admin">
      <button className="sponsor-admin-btn" onClick={() => onEdit(item)} aria-label="edit"><Pencil size={13} /></button>
      <button className="sponsor-admin-del sponsor-admin-btn" onClick={() => onDelete(item)} aria-label="delete"><Trash2 size={13} /></button>
    </div>
  );
}

function SponsorCard({ sponsor, isZh, admin, onEdit, onDelete }: {
  sponsor: Sponsor;
  isZh: boolean;
  admin: boolean;
  onEdit: (s: Sponsor) => void;
  onDelete: (s: Sponsor) => void;
}) {
  const name = displayCuberName(sponsor.name, isZh);
  return (
    <div className="sponsor-card" title={sponsor.message || undefined}>
      <PersonAvatar name={name} wcaId={sponsor.wcaId} avatarUrl={sponsor.avatarUrl} />
      <PersonName name={name} wcaId={sponsor.wcaId} />
      <span className="sponsor-amount">{fmtAmount(sponsor.amount, sponsor.currency)}</span>
      {sponsor.message && <span className="sponsor-message">{sponsor.message}</span>}
      {admin && <AdminBtns item={sponsor} onEdit={onEdit} onDelete={onDelete} />}
    </div>
  );
}

function ContributorCard({ contributor, isZh, admin, onEdit, onDelete, onBump, onOpenDetail }: {
  contributor: Contributor;
  isZh: boolean;
  admin: boolean;
  onEdit: (ct: Contributor) => void;
  onDelete: (ct: Contributor) => void;
  onBump: (ct: Contributor) => void;
  onOpenDetail: (ct: Contributor) => void;
}) {
  const name = displayCuberName(contributor.name, isZh);
  const countTitle = tr({ zh: '贡献 {n} 次', en: '{n} contributions' }).replace('{n}', String(contributor.score));
  const hasDetail = contributor.contributions.length > 0;
  return (
    <div className="sponsor-card">
      <PersonAvatar name={name} wcaId={contributor.wcaId} avatarUrl={contributor.avatarUrl} />
      <PersonName name={name} wcaId={contributor.wcaId} />
      {admin ? (
        <button
          className="contrib-score contrib-score-btn"
          onClick={() => onBump(contributor)}
          title={tr({ zh: '点击 +1', en: 'Click to +1' })}
        >
          {contributor.score}
        </button>
      ) : (
        <span className="contrib-score" title={countTitle}>{contributor.score}</span>
      )}
      {hasDetail && (
        <button className="contrib-detail-open" onClick={() => onOpenDetail(contributor)}>
          <List size={11} />
          {tr({ zh: '查看贡献', en: 'View details' })}
        </button>
      )}
      {admin && <AdminBtns item={contributor} onEdit={onEdit} onDelete={onDelete} />}
    </div>
  );
}

// 展开一位贡献者的每次贡献内容明细(点卡片上的「查看贡献」打开)。
function ContributorDetail({ contributor, isZh, onClose }: {
  contributor: Contributor;
  isZh: boolean;
  onClose: () => void;
}) {
  const name = displayCuberName(contributor.name, isZh);
  const items = contributor.contributions;
  return (
    <div className="sponsor-editor-backdrop" onClick={onClose}>
      <div className="contrib-detail" onClick={e => e.stopPropagation()}>
        <div className="sponsor-editor-head">
          <div className="contrib-detail-person">
            <PersonAvatar name={name} wcaId={contributor.wcaId} avatarUrl={contributor.avatarUrl} />
            <div className="contrib-detail-person-text">
              <PersonName name={name} wcaId={contributor.wcaId} />
              <span className="contrib-detail-count">
                {tr({ zh: '共 {n} 次贡献', en: '{n} contributions' }).replace('{n}', String(contributor.score))}
              </span>
            </div>
          </div>
          <button className="sponsor-editor-close" onClick={onClose} aria-label="close"><X size={18} /></button>
        </div>
        <div className="contrib-detail-body">
          {items.length === 0 ? (
            <div className="contrib-detail-empty">{tr({ zh: '暂无明细', en: 'No details yet' })}</div>
          ) : (
            <ol className="contrib-detail-list">
              {items.map((ct, i) => {
                const text = isZh ? (ct.zh || ct.en) : (ct.en || ct.zh);
                return (
                  <li className="contrib-detail-item" key={i}>
                    {ct.date && <span className="contrib-detail-date">{ct.date}</span>}
                    <span className="contrib-detail-text">{text}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
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
  const [contributors, setContributors] = useState<Contributor[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [contribErr, setContribErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [donateOpen, setDonateOpen] = useState(false);
  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null);
  const [detailContributor, setDetailContributor] = useState<Contributor | null>(null);

  useEffect(() => {
    let cancel = false;
    listSponsors()
      .then(rows => { if (!cancel) setSponsors(rows); })
      .catch(e => { if (!cancel) setLoadErr(e instanceof Error ? e.message : String(e)); });
    // 贡献者拉不到不拖累赞助区:公开视图静默隐藏,admin 视图显示错误。
    listContributors()
      .then(rows => { if (!cancel) setContributors(rows); })
      .catch(e => { if (!cancel) setContribErr(e instanceof Error ? e.message : String(e)); });
    return () => { cancel = true; };
  }, []);

  const total = sponsors?.length ?? 0;
  const visible = useMemo(
    () => (sponsors ? (expanded ? sponsors : sponsors.slice(0, INITIAL_VISIBLE)) : []),
    [sponsors, expanded],
  );
  const remaining = total - visible.length;

  function applySavedContributor(saved: Contributor) {
    setContributors(prev => {
      const list = prev ? prev.slice() : [];
      const i = list.findIndex(ct => ct.id === saved.id);
      if (i >= 0) list[i] = saved; else list.push(saved);
      list.sort((a, b) => b.score - a.score);
      return list;
    });
  }

  function handleSaved(saved: Sponsor | Contributor) {
    if (editorTarget?.kind === 'contributor') {
      applySavedContributor(saved as Contributor);
    } else {
      const s = saved as Sponsor;
      setSponsors(prev => {
        const list = prev ? prev.slice() : [];
        const i = list.findIndex(x => x.id === s.id);
        if (i >= 0) list[i] = s; else list.push(s);
        list.sort((a, b) => b.amount - a.amount);
        return list;
      });
    }
    setEditorTarget(null);
  }

  async function handleDelete(s: Sponsor) {
    if (!window.confirm(tr({ zh: '删除「{n}」?', en: 'Delete "{n}"?'
    }).replace('{n}', s.name))) return;
    try {
      await deleteSponsor(s.id);
      setSponsors(prev => prev?.filter(x => x.id !== s.id) ?? null);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleDeleteContributor(ct: Contributor) {
    if (!window.confirm(tr({ zh: '删除「{n}」?', en: 'Delete "{n}"?'
    }).replace('{n}', ct.name))) return;
    try {
      await deleteContributor(ct.id);
      setContributors(prev => prev?.filter(x => x.id !== ct.id) ?? null);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleBump(ct: Contributor) {
    try {
      applySavedContributor(await bumpContributor(ct.id));
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    }
  }

  const showContribSection = (contributors?.length ?? 0) > 0 || admin;

  return (
    <div className="support-page">
      <header className="support-head">
        <h1 className="support-title">{tr({ zh: '致谢', en: 'Acknowledgments'
        })}</h1>
        <p className="support-sub">
          {tr({
            zh: '所有赞助将全部用于服务器购买与日常维护。感谢每一位支持 CubeRoot 的朋友。',
            en: 'Every donation goes entirely toward server costs and upkeep. Thank you to everyone who supports CubeRoot.'
        })}
        </p>
        <div className="support-cta-row">
          <button className="support-cta" onClick={() => setDonateOpen(true)}>
            <Heart size={15} className="support-cta-heart" />
            {tr({ zh: '支持本站', en: 'Support this site'
          })}
          </button>
          <AppLink href="/membership" className="support-member-link">
            <Crown size={14} />
            {tr({ zh: '成为会员', en: 'Become a member'
            })}
          </AppLink>
        </div>
      </header>

      {loadErr ? (
        <div className="support-empty">{tr({ zh: '加载失败', en: 'Failed to load'
        })}: {loadErr}</div>
      ) : !sponsors ? (
        <div className="support-empty">{tr({ zh: '加载中…', en: 'Loading…'
        })}</div>
      ) : (
        <>
          <div className="support-count">
            <span>
              {total > 0
                ? tr({ zh: '已有 {n} 位朋友赞助', en: '{n} supporters so far'
                }).replace('{n}', String(total))
                : tr({ zh: '成为第一位赞助者', en: 'Be the first supporter'
                })}
            </span>
            {admin && (
              <button className="support-add" onClick={() => setEditorTarget({ kind: 'sponsor', initial: null })}>
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
                  onEdit={x => setEditorTarget({ kind: 'sponsor', initial: x })}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}

          {remaining > 0 && (
            <button className="support-more" onClick={() => setExpanded(true)}>
              {tr({ zh: '展开剩余 {n} 人', en: 'Show {n} more'
            }).replace('{n}', String(remaining))}
            </button>
          )}
        </>
      )}

      {showContribSection && (
        <section className="support-contrib">
          <h2 className="support-contrib-title">{tr({ zh: '贡献者', en: 'Contributors'
          })}</h2>
          <p className="support-sub">
            {tr({
              zh: '感谢每一位提交反馈、建议与 bug 的朋友，数字是贡献次数。',
              en: 'Thanks to everyone who filed feedback, ideas and bug reports — the number is their contribution count.'
          })}
          </p>
          {admin && (
            <div className="support-count">
              <button className="support-add" onClick={() => setEditorTarget({ kind: 'contributor', initial: null })}>
                <Plus size={13} /> {tr({ zh: '新增', en: 'Add' })}
              </button>
            </div>
          )}
          {admin && contribErr && (
            <div className="support-empty">{tr({ zh: '加载失败', en: 'Failed to load'
            })}: {contribErr}</div>
          )}
          {contributors && contributors.length > 0 && (
            <div className="support-grid">
              {contributors.map(ct => (
                <ContributorCard
                  key={ct.id}
                  contributor={ct}
                  isZh={isZh}
                  admin={admin}
                  onEdit={x => setEditorTarget({ kind: 'contributor', initial: x })}
                  onDelete={handleDeleteContributor}
                  onBump={handleBump}
                  onOpenDetail={setDetailContributor}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {detailContributor && (
        <ContributorDetail
          contributor={detailContributor}
          isZh={isZh}
          onClose={() => setDetailContributor(null)}
        />
      )}
      {donateOpen && <DonateModal lang={isZh ? 'zh' : 'en'} onClose={() => setDonateOpen(false)} />}
      {editorTarget && (
        <SupportEditor
          target={editorTarget}
          onClose={() => setEditorTarget(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
