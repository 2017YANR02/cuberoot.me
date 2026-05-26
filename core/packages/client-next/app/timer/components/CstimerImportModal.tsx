'use client';

/**
 * CstimerImportModal — per-session import of a cstimer "Local backup" JSON.
 * User picks which sessions to import; each session targets its mapped EventId.
 *
 * Slim port — no Replace mode; everything appends.
 */

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Solve } from '../timer-db';
import { addSolve } from '../timer-db';
import { parseCstimerExport, type CstimerSessionParsed } from '../timer-cstimer-import';

interface Props {
  isZh: boolean;
  onClose: () => void;
  onImported: (solvesByEvent: Map<string, Solve[]>) => void;
}

export default function CstimerImportModal({ isZh, onClose, onImported }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const [parsed, setParsed] = useState<CstimerSessionParsed[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleFile = async (file: File) => {
    setErr(null);
    try {
      const text = await file.text();
      const sessions = parseCstimerExport(text);
      if (sessions.length === 0) {
        setErr(t('未识别到 cstimer 会话', 'No cstimer sessions found'));
        return;
      }
      setParsed(sessions);
      setSelected(new Set(sessions.map((s) => s.sessionId)));
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const handleImport = async () => {
    if (!parsed) return;
    setBusy(true);
    const byEvent = new Map<string, Solve[]>();
    let n = 0;
    for (const sess of parsed) {
      if (!selected.has(sess.sessionId)) continue;
      const bucket = byEvent.get(sess.event) ?? [];
      for (const s of sess.solves) {
        await addSolve(s);
        bucket.push(s);
        n++;
      }
      byEvent.set(sess.event, bucket);
    }
    setBusy(false);
    onImported(byEvent);
    window.alert(t(`已导入 ${n} 条成绩`, `Imported ${n} solves`));
    onClose();
  };

  return (
    <div className="tmr-modal-backdrop" onClick={onClose}>
      <div className="tmr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tmr-modal-head">
          <h3>{t('导入 cstimer JSON', 'Import cstimer JSON')}</h3>
          <button type="button" className="tmr-icon-btn" onClick={onClose} aria-label={t('关闭', 'Close')}>
            <X size={16} />
          </button>
        </div>

        {parsed === null && (
          <div style={{ padding: '8px 0' }}>
            <p style={{ fontSize: 13, opacity: 0.7, marginTop: 0 }}>
              {t(
                '从 cstimer 主页 → 工具 → Local backup → Export,把 JSON 文件拖到这里或点击选择。',
                'In cstimer: Tools → Local backup → Export. Drop the JSON file here or pick it below.',
              )}
            </p>
            <input
              type="file"
              accept="application/json,.json,.txt"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            {err && <div style={{ marginTop: 8, color: '#e57373', fontSize: 13 }}>{err}</div>}
          </div>
        )}

        {parsed !== null && (
          <>
            <div className="tmr-cstimer-list">
              {parsed.map((sess) => (
                <label key={sess.sessionId} className="tmr-cstimer-row">
                  <input
                    type="checkbox"
                    checked={selected.has(sess.sessionId)}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) next.add(sess.sessionId);
                      else next.delete(sess.sessionId);
                      setSelected(next);
                    }}
                  />
                  <span className="tmr-cstimer-name">{sess.name}</span>
                  <span className="tmr-cstimer-event">→ {sess.event}{!sess.matched ? '?' : ''}</span>
                  <span className="tmr-cstimer-count">{sess.solves.length}</span>
                </label>
              ))}
            </div>
            <div className="tmr-modal-foot">
              <span style={{ fontSize: 12, opacity: 0.6 }}>
                {t('"?" = 未识别项目,默认 333', '"?" = unrecognized event, defaulted to 333')}
              </span>
              <button type="button" className="tmr-action-btn" disabled={busy} onClick={handleImport}>
                {busy ? t('导入中…', 'Importing…') : t('导入所选', 'Import selected')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
