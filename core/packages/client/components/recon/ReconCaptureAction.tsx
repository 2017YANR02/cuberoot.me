'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ownerKey } from '@cuberoot/shared/account';
import type { Solve } from '@cuberoot/shared/timer';
import { reconRecording } from '@cuberoot/shared/recon-ground-truth';
import {
  fitReconCaptureSync, validateReconCaptureInput,
  type ReconCapture, type ReconCaptureInput, type ReconCaptureAnchor, type ReconCaptureSyncWarning,
} from '@cuberoot/shared/recon-capture';
import { useAuthUser, useIsAdmin } from '@/lib/auth-store';
import { createDriveUpload, uploadDriveChunk } from '@/lib/drive-api';
import { reconCaptureDriveTransport, reconCaptureEnvironment } from '@/lib/recon-capture-transport';
import {
  listReconCaptures, reconCaptureStatus, createReconCapture, completeReconCapture, saveReconCaptureSync,
  inspectCaptureVideo, sameCaptureVideo,
} from '@/lib/recon-capture-api';
import { persistItem } from '@/lib/safe-storage';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import { tr } from '@/i18n/tr';
import './recon-intake.css';
import './recon-capture.css';

interface CaptureDraft {
  version: 1;
  id: string;
  owner: string;
  input: Omit<ReconCaptureInput, 'driveNodeId'> & { driveNodeId: string | null };
}
type Stage = 'idle' | 'reading' | 'uploading' | 'verifying' | 'syncing';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Keep legacy v1 drafts untouched; their destination was not recorded.
const storageKey = (owner: string, solveId: string) => `recon-capture.v2:${encodeURIComponent(reconCaptureEnvironment)}:${encodeURIComponent(owner)}:${encodeURIComponent(solveId)}`;

function readDraft(key: string, owner: string, solveId: string): CaptureDraft | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  const value = JSON.parse(raw) as CaptureDraft;
  // A null node is a locally saved intention, before Drive creates its upload.
  if (value?.version !== 1 || value.owner !== owner || !UUID.test(value.id)
    || value.input?.sourceSolveId !== solveId
    || validateReconCaptureInput({ ...value.input, driveNodeId: value.input.driveNodeId ?? value.id }).length) {
    throw new Error(tr({ zh: '本机采集进度无法读取，原记录已保留。', en: 'The saved capture draft cannot be read. The original record is preserved.' }));
  }
  return value;
}

function writeDraft(key: string, draft: CaptureDraft): void {
  if (!persistItem(key, JSON.stringify(draft))) {
    throw new Error(tr({ zh: '无法保存续传进度，请先释放浏览器存储空间。', en: 'Resume progress could not be saved. Free some browser storage first.' }));
  }
}

function checkSignal(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
}

const syncWarningText = (warning: ReconCaptureSyncWarning) => tr({
  'clock-scale': { zh: '视频与动作时钟倍率有差异', en: 'Video and move clock rates differ' },
  'anchor-residual': { zh: '对齐点偏差超过 20 ms', en: 'Anchor residual exceeds 20 ms' },
  'outside-video': { zh: '部分动作映射到视频范围外', en: 'Some moves map outside the video' },
  'two-anchors-only': { zh: '可补一个中间动作检查偏差', en: 'Add a middle move to check alignment error' },
  'unverified-video-duration': { zh: '视频时长尚未读出', en: 'Video duration is unavailable' },
}[warning]);

export default function ReconCaptureAction({ solve }: { solve: Solve }) {
  const user = useAuthUser();
  const admin = useIsAdmin();
  const [open, setOpen] = useState(false);
  const owner = ownerKey(user?.uid, user?.wcaId);
  if (!admin || !owner || solve.event !== '333' || !solve.moves?.length) return null;
  return <div className="ri-action">
    <button className="ri-button" type="button" onClick={() => setOpen(true)}>{tr({ zh: '添加视频', en: 'Add video' })}</button>
    {open && createPortal(<CaptureDialog key={`${owner}:${solve.id}`} owner={owner} solve={solve} onClose={() => setOpen(false)} />, document.body)}
  </div>;
}

function CaptureDialog({ owner, solve, onClose }: { owner: string; solve: Solve; onClose: () => void }) {
  const key = storageKey(owner, solve.id);
  const [recording] = useState(() => reconRecording(solve));
  const [draft, setDraft] = useState<CaptureDraft | null>(null);
  const [capture, setCapture] = useState<ReconCapture | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [canSelect, setCanSelect] = useState(false);
  const [stage, setStage] = useState<Stage>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [anchors, setAnchors] = useState<ReconCaptureAnchor[]>([]);
  const [moveIndex, setMoveIndex] = useState(0);
  const [previewError, setPreviewError] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const request = useRef<AbortController | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const objectUrl = useRef('');
  const forceNew = useRef(false);
  const busy = stage !== 'idle';
  const stop = useCallback(() => { request.current?.abort(); }, []);
  const close = useCallback(() => { stop(); onClose(); }, [stop, onClose]);
  const dismiss = useModalDismiss(close);
  useEffect(() => () => { request.current?.abort(); request.current = null; if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    setLoading(true); setCanSelect(false); setError('');
    void (async () => {
      const status = await reconCaptureStatus(controller.signal);
      if (!status.available) throw new Error(tr({ zh: '视频采集服务暂不可用。', en: 'Video capture is currently unavailable.' }));
      const local = forceNew.current ? null : readDraft(key, owner, solve.id);
      const result = await listReconCaptures(solve.id, controller.signal);
      checkSignal(controller.signal);
      const existing = forceNew.current ? undefined : local ? result.items.find(item => item.id === local.id) : result.items[0];
      const restored = existing ? { version: 1 as const, id: existing.id, owner, input: existing.input } : local;
      setDraft(restored); setCapture(existing ?? null); setAnchors(existing?.sync?.anchors ?? []);
      if (existing?.status === 'needs-review') localStorage.removeItem(key);
      else if (restored) writeDraft(key, restored);
      setCanSelect(true);
    })().catch(reason => { if (!controller.signal.aborted) setError(String(reason)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [key, owner, solve.id, loadVersion]);

  const setOriginal = (original: File) => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(original);
    setFile(original); setPreview(objectUrl.current); setPreviewError(false);
  };

  const startNew = () => {
    stop(); request.current = null;
    try { localStorage.removeItem(key); }
    catch { setError(tr({ zh: '无法清除本机采集进度，请检查浏览器存储权限。', en: 'Could not clear this capture draft. Check browser storage permissions.' })); return; }
    forceNew.current = true;
    setDraft(null); setCapture(null); setAnchors([]); setMoveIndex(0); setFile(null); setPreview('');
    setError(''); setStage('idle'); setLoading(false); setCanSelect(true); setProgress(0);
    if (objectUrl.current) { URL.revokeObjectURL(objectUrl.current); objectUrl.current = ''; }
    setNotice(tr({ zh: '旧样本和网盘文件已保留，可选择新视频。', en: 'Previous samples and Drive files are preserved. Choose a new video.' }));
  };

  const transfer = async (original: File) => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    const signal = controller.signal;
    setError(''); setStage('reading'); setProgress(0);
    try {
      // Fail before a Drive write when the capture API has not been deployed.
      const status = await reconCaptureStatus(signal);
      if (!status.available) throw new Error(tr({ zh: '视频采集服务暂不可用。', en: 'Video capture is currently unavailable.' }));
      const manifest = await inspectCaptureVideo(original, signal, bytes => setProgress(bytes / original.size));
      checkSignal(signal);
      let current = draft;
      if (current && !sameCaptureVideo(current.input.video, manifest)) {
        throw new Error(tr({ zh: '这个文件与已保存的原视频不同，请选择同一原片续传或校时。', en: 'This file differs from the saved original. Select the same video to resume or align it.' }));
      }
      if (!current) {
        current = { version: 1, id: crypto.randomUUID(), owner,
          input: { sourceSolveId: solve.id, recording, video: manifest, driveNodeId: null } };
      }
      const inputErrors = validateReconCaptureInput({ ...current.input, driveNodeId: current.input.driveNodeId ?? current.id });
      if (inputErrors.length) throw new Error(inputErrors.join('; '));
      // A completed capture is durable on the server; do not cache its gyro payload again.
      if (!capture || capture.id !== current.id || capture.status !== 'needs-review') writeDraft(key, current);
      setDraft(current); forceNew.current = false;
      setOriginal(original);
      if (!current.input.driveNodeId) {
        const extension = current.input.video.mimeType === 'video/quicktime' ? 'mov'
          : current.input.video.mimeType === 'video/webm' ? 'webm' : 'mp4';
        const uploadFile = new File([original], `recon-${current.id}.${extension}`, {
          type: current.input.video.mimeType, lastModified: current.input.video.lastModified,
        });
        const upload = await createDriveUpload(uploadFile, null, signal, reconCaptureDriveTransport);
        checkSignal(signal);
        current = { ...current, input: { ...current.input, driveNodeId: upload.nodeId } };
        writeDraft(key, current); setDraft(current);
      }
      const input: ReconCaptureInput = { ...current.input, driveNodeId: current.input.driveNodeId! };
      let saved = await createReconCapture(current.id, input, signal);
      checkSignal(signal); setCapture(saved); setAnchors(saved.sync?.anchors ?? []);
      forceNew.current = false;
      if (saved.id !== current.id) {
        current = { ...current, id: saved.id, input: saved.input };
        writeDraft(key, current); setDraft(current);
      }
      if (!saved.upload.available) throw new Error(tr({ zh: '原视频已不可用，请检查网盘文件或上传期限。', en: 'The original is unavailable. Check the Drive file or upload expiry.' }));
      if (saved.status === 'needs-review') { localStorage.removeItem(key); return; }
      setStage('uploading');
      let offset = saved.upload.receivedBytes;
      setProgress(offset / original.size);
      if (saved.upload.chunkBytes !== input.video.chunkBytes || offset < 0 || offset > original.size) {
        throw new Error(tr({ zh: '上传进度不匹配，请重新读取样本。', en: 'Upload progress does not match. Reload the sample.' }));
      }
      while (!saved.upload.ready && offset < original.size) {
        checkSignal(signal);
        if (!saved.upload.id) throw new Error(tr({ zh: '续传记录不可用。', en: 'The resumable upload is unavailable.' }));
        const start = offset;
        const end = Math.min(start + saved.upload.chunkBytes, original.size);
        const result = await uploadDriveChunk(saved.upload.id, start, original.slice(start, end), signal,
          bytes => setProgress((start + bytes) / original.size), reconCaptureDriveTransport);
        checkSignal(signal);
        if (result.offset !== end || (result.nodeId && result.nodeId !== input.driveNodeId)) {
          throw new Error(tr({ zh: '上传响应与当前文件不一致，请重试读取进度。', en: 'The upload response does not match this file. Retry to reload progress.' }));
        }
        offset = result.offset; setProgress(offset / original.size);
      }
      setStage('verifying');
      saved = await completeReconCapture(current.id, signal);
      checkSignal(signal); setCapture(saved); setAnchors(saved.sync?.anchors ?? []);
      localStorage.removeItem(key);
      window.dispatchEvent(new Event('recon-capture:changed'));
    } catch (reason) {
      if (!signal.aborted) setError(String(reason));
    } finally {
      if (request.current === controller) setStage('idle');
    }
  };

  const mapped = useMemo(() => {
    if (!capture || anchors.length < 2) return null;
    try { return fitReconCaptureSync(capture.input.recording, { ...capture.input.video, durationMs: capture.videoDurationMs }, anchors); }
    catch { return null; }
  }, [capture, anchors]);

  const mark = (index: number) => {
    if (!video.current || !Number.isFinite(video.current.currentTime)) return;
    if (anchors.length >= 20 && !anchors.some(anchor => anchor.moveIndex === index)) return;
    video.current.pause();
    const point = { moveIndex: index, videoTimeMs: video.current.currentTime * 1000 };
    setAnchors(previous => [...previous.filter(a => a.moveIndex !== index), point].sort((a, b) => a.moveIndex - b.moveIndex));
  };

  const saveSync = async () => {
    if (!capture || !mapped) return;
    const controller = new AbortController(); request.current = controller;
    setStage('syncing'); setError('');
    try {
      const saved = await saveReconCaptureSync(capture.id, capture.revision, anchors, controller.signal);
      checkSignal(controller.signal); setCapture(saved); setAnchors(saved.sync?.anchors ?? []);
    } catch (reason) { if (!controller.signal.aborted) setError(String(reason)); }
    finally { if (request.current === controller) setStage('idle'); }
  };

  const ready = capture?.status === 'needs-review';
  const shownRecording = capture?.input.recording ?? draft?.input.recording ?? recording;
  const moves = shownRecording.moves;
  return <div className="ri-backdrop" {...dismiss}>
    <section className="ri-dialog rc-dialog" role="dialog" aria-modal="true" aria-label={tr({ zh: '采集视频样本', en: 'Collect a video sample' })}
      data-site-surface="panel" onKeyDownCapture={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
      <div className="ri-heading"><h2>{tr({ zh: '采集视频样本', en: 'Collect a video sample' })}</h2>
        <button className="ri-button" type="button" onClick={close}>{tr({ zh: '关闭', en: 'Close' })}</button></div>
      <p className="rc-summary">{(shownRecording.timeMs / 1000).toFixed(3)} s · {shownRecording.model} · {moves.length} {tr({ zh: '条动作', en: 'moves' })}</p>
      <p className="rc-scramble">{shownRecording.scramble}</p>
      <div className="rc-controls">
        <input ref={fileInput} type="file" hidden accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm" onChange={event => {
          const selected = event.target.files?.[0]; event.target.value = '';
          if (selected) void transfer(selected);
        }} />
        <button className="ri-button ri-primary" type="button" disabled={busy || loading || !canSelect} onClick={() => fileInput.current?.click()}>
          {draft ? tr({ zh: '选择原视频', en: 'Select original video' }) : tr({ zh: '选择并保存视频', en: 'Choose and save video' })}</button>
        {file && !busy && !ready && <button className="ri-button" type="button" disabled={!canSelect} onClick={() => void transfer(file)}>{tr({ zh: '继续上传', en: 'Resume upload' })}</button>}
        {busy && <button className="ri-button" type="button" onClick={stop}>{tr({ zh: '停止', en: 'Stop' })}</button>}
        {!busy && <button className="ri-button" type="button" disabled={loading} onClick={() => setLoadVersion(value => value + 1)}>{tr({ zh: '刷新状态', en: 'Refresh status' })}</button>}
        {(draft || capture || error) && <button className="ri-button" type="button" onClick={startNew}>{tr({ zh: '新建采集', en: 'New capture' })}</button>}
      </div>
      <p className="rc-status" aria-live="polite">{loading ? tr({ zh: '读取采集记录…', en: 'Loading capture…' })
        : stage === 'reading' ? `${tr({ zh: '校验原视频', en: 'Checking original' })} ${Math.round(progress * 100)}%`
        : stage === 'uploading' ? `${tr({ zh: '上传', en: 'Uploading' })} ${Math.round(progress * 100)}%`
        : stage === 'verifying' ? tr({ zh: '确认文件完整性…', en: 'Verifying the complete file…' })
        : stage === 'syncing' ? tr({ zh: '保存对齐点…', en: 'Saving alignment…' })
        : ready ? capture.sync ? tr({ zh: '已保存 · 对齐点已记录 · 待审核', en: 'Saved · Alignment recorded · Awaiting review' })
          : tr({ zh: '已保存 · 待对齐', en: 'Saved · Awaiting alignment' })
        : draft ? tr({ zh: '上传未完成，可选择同一原视频续传。', en: 'Upload incomplete. Select the same original to resume.' })
        : tr({ zh: '原片与这把的打乱、动作和姿态一起私有保存。', en: 'The original, scramble, moves and orientation are saved privately together.' })}</p>
      {draft && <p className="rc-filename">{draft.input.video.filename}</p>}
      {preview && <video ref={video} className="rc-video" src={preview} controls playsInline preload="metadata" onError={() => setPreviewError(true)} />}
      {previewError && <p className="rc-status">{tr({ zh: '浏览器无法预览此格式，原片仍可保存。', en: 'This browser cannot preview the format. The original can still be saved.' })}</p>}
      {ready && preview && !previewError && <div className="rc-alignment">
        <p>{tr({ zh: '暂停到动作完成的位置，添加对齐点。', en: 'Pause at a completed turn and add an alignment point.' })}</p>
        <div className="rc-controls">
          <button className="ri-button" type="button" disabled={busy} onClick={() => mark(0)}>{tr({ zh: '标记第一步', en: 'Mark first move' })}</button>
          <button className="ri-button" type="button" disabled={busy} onClick={() => mark(moves.length - 1)}>{tr({ zh: '标记最后一步', en: 'Mark last move' })}</button>
          <select className="ri-field" aria-label={tr({ zh: '选择动作', en: 'Select move' })} value={moveIndex} disabled={busy} onChange={event => setMoveIndex(Number(event.target.value))}>
            {moves.map((move, index) => <option key={index} value={index}>{index + 1}. {move.m} · {(move.ts / 1000).toFixed(3)} s</option>)}
          </select>
          <button className="ri-button" type="button" disabled={busy || (anchors.length >= 20 && !anchors.some(a => a.moveIndex === moveIndex))} onClick={() => mark(moveIndex)}>{tr({ zh: '标记所选动作', en: 'Mark selected move' })}</button>
        </div>
        <ul className="rc-anchors">{anchors.map(anchor => <li key={anchor.moveIndex}>
          <span>{anchor.moveIndex + 1}. {moves[anchor.moveIndex]?.m} · {(anchor.videoTimeMs / 1000).toFixed(3)} s</span>
          <button className="ri-button" type="button" disabled={busy} onClick={() => setAnchors(points => points.filter(a => a.moveIndex !== anchor.moveIndex))}>{tr({ zh: '移除', en: 'Remove' })}</button>
        </li>)}</ul>
        {anchors.length >= 2 && !mapped && <p role="alert">{tr({ zh: '请检查动作顺序、视频时刻及重复的设备时间。', en: 'Check move order, video times and duplicate device timestamps.' })}</p>}
        {mapped && <p className="rc-status">{tr({ zh: '最大对齐偏差', en: 'Maximum anchor error' })}: {mapped.maxResidualMs.toFixed(1)} ms · {mapped.warnings.map(syncWarningText).join(' · ')}</p>}
        <button className="ri-button" type="button" disabled={busy || !mapped} onClick={() => void saveSync()}>{tr({ zh: '保存对齐点', en: 'Save alignment' })}</button>
      </div>}
      {error && <p role="alert" className="rc-error">{error}</p>}
      {notice && <p role="status" className="rc-status">{notice}</p>}
    </section>
  </div>;
}
