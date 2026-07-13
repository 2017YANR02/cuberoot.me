'use client';

/**
 * case 的富元数据弹窗(1lll / zbll / pll / ell —— 从站长自编的那张 1LLL 表导入的才有)。
 *
 * 为什么是弹窗:元数据有 20 来个字段(6 套打乱、4 套最优解、对称性、镜像/逆的编号……),
 * 铺进 case 卡片会把主视图挤爆(docs/1lll-migration.md B10)。
 *
 * 镜像 / 逆 / 镜像逆存的是**表编号**(`meta.no`),不是 DB id。同一个 set 里能找到就做成链接,
 * 找不到(镜像落在别的 set)就只显示编号 —— 不去猜。
 */
import { useEffect, useMemo } from 'react';
import { X, Copy, Check } from 'lucide-react';
import type { AlgCase, AlgCaseMeta } from '@cuberoot/shared';
import { useCopy } from '@/hooks/useCopy';
import { tr } from '@/i18n/tr';

const METRIC_LABEL: Record<string, string> = { stm: 'STM', sqtm: 'SQTM', htm: 'HTM', qtm: 'QTM' };

/** 一行「标签 + 可复制的公式」 */
function AlgLine({ label, alg }: { label: string; alg: string }) {
  const { copied, copy } = useCopy();
  return (
    <div className="alg-meta-algline">
      <span className="alg-meta-algline-label">{label}</span>
      <code className="alg-meta-algline-code">{alg}</code>
      <button
        type="button"
        className="alg-meta-copy"
        onClick={() => copy(alg)}
        title={tr({ zh: '复制', en: 'Copy' })}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="alg-meta-row">
      <span className="alg-meta-key">{label}</span>
      <span className="alg-meta-val">{children}</span>
    </div>
  );
}

interface Props {
  caseObj: AlgCase;
  /** 同一个 set 里的 `meta.no` → case,用来把镜像/逆做成链接 */
  byNo: Map<number, AlgCase>;
  onClose: () => void;
  onJump: (c: AlgCase) => void;
}

export default function AlgCaseMetaModal({ caseObj, byNo, onClose, onJump }: Props) {
  const m = caseObj.meta as AlgCaseMeta;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const related = useMemo(() => ([
    { label: tr({ zh: '镜像', en: 'Mirror' }), no: m.mirror },
    { label: tr({ zh: '逆', en: 'Inverse' }), no: m.inv },
    { label: tr({ zh: '镜像逆', en: 'Inv. mirror' }), no: m.im },
  ].filter(r => r.no != null)), [m.mirror, m.inv, m.im]);

  const sym = m.sym ?? {};
  const symFlags = [
    sym.selfMirror && tr({ zh: '自镜像', en: 'self-mirror' }),
    sym.selfInv && tr({ zh: '自逆', en: 'self-inverse' }),
    sym.full && tr({ zh: '全对称', en: 'full' }),
    sym.anti && tr({ zh: '反对称', en: 'anti' }),
  ].filter(Boolean) as string[];

  const optimal = Object.entries(m.optimal ?? {}) as Array<[string, { len: number; scramble?: string }]>;

  return (
    <div className="alg-admin-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="alg-admin-modal alg-meta-modal" onClick={e => e.stopPropagation()}>
        <div className="alg-admin-modal-head">
          <h2>
            {m.ollcp}
            <span className="alg-meta-head-sub">{caseObj.name}</span>
          </h2>
          <button type="button" className="alg-admin-modal-head-btn" onClick={onClose} title={tr({ zh: '关闭', en: 'Close' })}>
            <X size={16} />
          </button>
        </div>

        <div className="alg-admin-modal-body alg-meta-body">
          <Row label={tr({ zh: '编号', en: 'No.' })}>{m.no}</Row>
          <Row label={tr({ zh: '子集', en: 'Subset' })}>{m.subset}</Row>
          <Row label="OLL">{m.oll}</Row>
          {m.cp && <Row label={tr({ zh: '角换', en: 'CP' })}>{m.cp}</Row>}
          {m.type && <Row label={tr({ zh: '叠加类型', en: 'Type' })}>{m.type}</Row>}
          {m.gen && <Row label={tr({ zh: '生成元', en: 'Generators' })}><code>{m.gen}</code></Row>}

          {(sym.cn || symFlags.length > 0) && (
            <Row label={tr({ zh: '对称性', en: 'Symmetry' })}>
              {sym.cn && <span className="alg-meta-chip">C{sym.cn}</span>}
              {symFlags.map(f => <span key={f} className="alg-meta-chip">{f}</span>)}
            </Row>
          )}

          {related.length > 0 && (
            <Row label={tr({ zh: '关联', en: 'Related' })}>
              {related.map(r => {
                const target = byNo.get(r.no!);
                return (
                  <span key={r.label} className="alg-meta-related">
                    {r.label}
                    {target
                      ? (
                        <button type="button" className="alg-meta-link" onClick={() => onJump(target)}>
                          {target.meta?.ollcp ?? target.name}
                        </button>
                      )
                      : <span className="alg-meta-link is-plain">#{r.no}</span>}
                  </span>
                );
              })}
            </Row>
          )}

          {m.scramble && (
            <div className="alg-meta-section">
              <h3>{tr({ zh: '打乱', en: 'Scramble' })}</h3>
              <AlgLine label={tr({ zh: '逆 case', en: 'Inv case' })} alg={m.scramble} />
            </div>
          )}

          {optimal.length > 0 && (
            <div className="alg-meta-section">
              <h3>{tr({ zh: '最优解', en: 'Optimal' })}</h3>
              {optimal.map(([metric, o]) => (
                <div key={metric} className="alg-meta-optimal">
                  <span className="alg-meta-optimal-len">
                    {METRIC_LABEL[metric] ?? metric} <strong>{o.len}</strong>
                  </span>
                  {o.scramble && <AlgLine label="" alg={o.scramble} />}
                </div>
              ))}
            </div>
          )}

          {(m.coep?.alg || m.coep?.scramble) && (
            <div className="alg-meta-section">
              <h3>COEP</h3>
              {m.coep.alg && <AlgLine label={tr({ zh: '公式', en: 'Alg' })} alg={m.coep.alg} />}
              {m.coep.scramble && <AlgLine label={tr({ zh: '打乱', en: 'Scramble' })} alg={m.coep.scramble} />}
            </div>
          )}

          {(m.sdbNo || m.docNo || m.oldNo) && (
            <div className="alg-meta-section alg-meta-refs">
              {m.sdbNo && <Row label="speedcubedb">{m.sdbNo}</Row>}
              {m.docNo && <Row label={tr({ zh: '旧编号 (doc)', en: 'Old no. (doc)' })}>{m.docNo}</Row>}
              {m.oldNo && <Row label={tr({ zh: '旧编号', en: 'Old no.' })}>{m.oldNo}</Row>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
