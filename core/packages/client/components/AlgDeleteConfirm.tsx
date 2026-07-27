'use client';

/**
 * 删公式 / 删 case 的二次确认弹层。
 *
 * 存在的理由不是「再问一遍」,是**摊开连带**:镜像系统(issue #40 T5)里一条人写的公式会
 * 自动生成若干复制品,落点是**别的 case**(左右镜落伙伴的 FL、前后镜落伙伴的 BR),源一删
 * 它们跟着没 —— 站在眼前这张 case 上一条都看不见。不列出来,删就是静默的。
 *
 * 清单谁算:调用方用 `@cuberoot/shared/alg-mirror` 的 `mirrorCascadeOnEdit` /
 * `mirrorCascadeOnDelete`,它们内部跑的是 server 入库同步的那份 `regenerateMirrorAlgs` ——
 * 所以这里显示的就是保存后真会消失的那些,不是另算一版近似。
 *
 * 本组件自己不算任何东西,只负责摆:`target` 是主角(直接被删的),`cascade` 是连带。
 */
import { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { tr } from '@/i18n/tr';

/** 一组公式 —— `where` 是它们在哪(case 名 + 视角),单条不需要就留空。 */
export interface AlgDeleteGroup {
  where?: string;
  algs: string[];
}

interface Props {
  title: string;
  /** 直接被删掉的公式。空数组 = 没有可列的正文(如删一张没公式的 case)。 */
  target: AlgDeleteGroup[];
  /** 连带被抹掉的自动生成公式。空 = 不出这一段。 */
  cascade: AlgDeleteGroup[];
  /** 连带还在算(伙伴 case 还没拉回来)—— 这期间不让点删,免得删在半路。 */
  cascadePending?: boolean;
  /** 连带算不出来的原因(拉伙伴失败之类)。有值就明说,别假装「没有连带」。 */
  cascadeError?: string | null;
  /** 额外提醒,如「这条是生成的,删了会重新长出来」。 */
  note?: string | null;
  busy?: boolean;
  error?: string | null;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

function AlgList({ groups, scroll }: { groups: AlgDeleteGroup[]; scroll?: boolean }) {
  return (
    <div className={`alg-del-list${scroll ? ' is-scroll' : ''}`}>
      {groups.map((g, i) => (
        <div key={i} className="alg-del-group">
          {g.where && <span className="alg-del-where">{g.where}</span>}
          {g.algs.map((a, j) => <code key={j} className="alg-del-alg">{a}</code>)}
        </div>
      ))}
    </div>
  );
}

export default function AlgDeleteConfirm({
  title, target, cascade, cascadePending, cascadeError, note,
  busy, error, confirmLabel, onCancel, onConfirm,
}: Props) {
  // 危险操作,默认焦点给「取消」—— 顺手一个回车不该把东西删了
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { cancelRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCancel]);

  const cascadeCount = cascade.reduce((n, g) => n + g.algs.length, 0);

  return (
    // 常常嵌在 AdminCaseEditor 的 backdrop 里,那层点空白 = 关编辑器 —— 不掐住就会连编辑器一起关掉
    <div
      className="alg-admin-modal-backdrop alg-del-backdrop"
      onClick={e => { e.stopPropagation(); onCancel(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className="alg-admin-modal alg-del-modal" onClick={e => e.stopPropagation()}>
        <div className="alg-admin-modal-head">
          <h2>{title}</h2>
        </div>

        <div className="alg-admin-modal-body">
          {/* 删整张 case 时正文可能几十条 —— 让它自己滚,否则底下的连带警告被顶出视野,
              而连带正是这个弹层存在的理由 */}
          {target.length > 0 && <AlgList groups={target} scroll />}

          {cascadePending && (
            <div className="alg-del-cascade-head">{tr({ zh: '正在查会不会连带删到别的公式…', en: 'Checking what else would go…' })}</div>
          )}

          {cascadeError && (
            <div className="alg-admin-modal-error">
              <AlertTriangle size={13} /> {cascadeError}
            </div>
          )}

          {cascadeCount > 0 && (
            <>
              <div className="alg-del-cascade-head">
                <AlertTriangle size={13} />
                {tr({
                  zh: `以下 ${cascadeCount} 条自动生成的公式会一起消失`,
                  en: `${cascadeCount} auto-generated alg${cascadeCount > 1 ? 's' : ''} will go with it`,
                })}
              </div>
              <AlgList groups={cascade} />
            </>
          )}

          {note && <div className="alg-del-note">{note}</div>}
          {error && <div className="alg-admin-modal-error">{error}</div>}
        </div>

        <div className="alg-admin-modal-foot">
          <div className="alg-admin-modal-foot-spacer" />
          <button ref={cancelRef} type="button" className="alg-admin-modal-foot-btn" onClick={onCancel}>
            {tr({ zh: '取消', en: 'Cancel' })}
          </button>
          <button
            type="button"
            className="alg-admin-modal-delete alg-admin-modal-foot-btn"
            disabled={busy || cascadePending}
            onClick={onConfirm}
          >
            <Trash2 size={14} /> {confirmLabel ?? tr({ zh: '删除', en: 'Delete' })}
          </button>
        </div>
      </div>
    </div>
  );
}
