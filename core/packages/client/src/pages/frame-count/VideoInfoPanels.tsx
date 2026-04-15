import { useState, useRef, useEffect, useLayoutEffect } from 'react';

interface VideoInfo {
  videoFile: File;
  videoFps: number;
  codec: string | null;
  width: number;
  height: number;
  durationSec: number;
  sampleCount: number | null;
  audio: { codec: string; sampleRate: number; channels: number; bitrate: number } | null;
  vfr: { isVFR: boolean; minFps: number; maxFps: number } | null;
}

function parseAudioCodec(codec: string): string {
  if (codec.startsWith('mp4a.40')) return 'AAC';
  if (codec.startsWith('mp4a')) return 'AAC';
  if (codec === 'opus') return 'Opus';
  if (codec === 'vorbis') return 'Vorbis';
  if (codec.startsWith('ac-3') || codec === 'ec-3') return 'AC-3 / EAC-3';
  if (codec.startsWith('alac')) return 'ALAC';
  if (codec.startsWith('flac')) return 'FLAC';
  return codec;
}

function parseCodec(codec: string | null): { family: string; profile?: string; hint?: string } {
  if (!codec) return { family: '未知' };
  const [prefix, ...rest] = codec.split('.');
  switch (prefix) {
    case 'avc1':
    case 'avc3':
      return { family: 'H.264 / AVC' };
    case 'hev1':
    case 'hvc1': {
      const profileIdc = parseInt(rest[0] ?? '', 10);
      if (profileIdc === 1) return { family: 'HEVC', profile: 'Main (4:2:0 8-bit)' };
      if (profileIdc === 2) return { family: 'HEVC', profile: 'Main 10 (4:2:0 10-bit)' };
      if (profileIdc === 3) return { family: 'HEVC', profile: 'Main Still Picture' };
      if (profileIdc === 4) return {
        family: 'HEVC',
        profile: 'Format Range Extensions',
        hint: '浏览器不支持此 profile (含 4:2:2 / 4:4:4 / 高 bit-depth)',
      };
      return { family: 'HEVC', profile: `profile_idc=${profileIdc}` };
    }
    case 'vp09': return { family: 'VP9' };
    case 'vp08': return { family: 'VP8' };
    case 'av01': return { family: 'AV1' };
    default: return { family: prefix };
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(2);
  return `${m}:${s.padStart(5, '0')}`;
}

export function VideoInfoButton({ info }: { info: VideoInfo }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [popPos, setPopPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  // 初次渲染 popover 时宽度尚未确定, 先隐藏避免"错位闪现", useLayoutEffect 测完宽度同步居中后再显示
  const [positioned, setPositioned] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  // 打开时按按钮位置固定在视口 (position:fixed), 避开上游 overflow:hidden 裁剪
  // useLayoutEffect: popover 挂载后、浏览器绘制前同步测量宽度并定位, 避免错位闪现
  useLayoutEffect(() => {
    if (!open) {
      setPositioned(false);
      return;
    }
    const reposition = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      const popW = popRef.current?.offsetWidth ?? 0;
      const cx = r.left + r.width / 2;
      const margin = 8;
      let left = cx - popW / 2;
      if (popW > 0) {
        left = Math.max(margin, Math.min(window.innerWidth - popW - margin, left));
      }
      setPopPos({ top: r.bottom + 6, left });
      setPositioned(true);
    };
    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open]);

  const codecInfo = parseCodec(info.codec);
  const bitrateMbps = info.durationSec > 0
    ? (info.videoFile.size * 8 / info.durationSec / 1_000_000).toFixed(0)
    : '?';

  return (
    <div className="fc-info-wrap" ref={rootRef}>
      <button
        ref={btnRef}
        className="fc-info-btn"
        onClick={() => setOpen(v => !v)}
        title="视频信息"
        type="button"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      </button>
      {open && (
        <div
          ref={popRef}
          className="fc-info-popover"
          role="dialog"
          style={{
            ['--popover-top' as string]: `${popPos.top}px`,
            ['--popover-left' as string]: `${popPos.left}px`,
            visibility: positioned ? 'visible' : 'hidden',
          }}
        >
          <div className="fc-info-row"><span>分辨率</span><span>{info.width} × {info.height}</span></div>
          <div className="fc-info-row">
            <span>帧率</span>
            <span>
              {info.videoFps > 0 ? `${info.videoFps.toFixed(2)} fps` : '—'}
              {info.vfr && (
                info.vfr.isVFR
                  ? <span className="fc-info-badge fc-info-badge-warn" title={`变帧率 ${info.vfr.minFps.toFixed(1)}–${info.vfr.maxFps.toFixed(1)} fps`}>VFR</span>
                  : <span className="fc-info-badge fc-info-badge-ok" title="定帧率">CFR</span>
              )}
            </span>
          </div>
          {info.vfr?.isVFR && (
            <div className="fc-info-row"><span>帧率范围</span><span>{info.vfr.minFps.toFixed(1)} – {info.vfr.maxFps.toFixed(1)} fps</span></div>
          )}
          <div className="fc-info-row"><span>时长</span><span>{formatDuration(info.durationSec)}</span></div>
          <div className="fc-info-row"><span>码率</span><span>{bitrateMbps} Mb/s</span></div>
          <div className="fc-info-row"><span>文件大小</span><span>{formatBytes(info.videoFile.size)}</span></div>
          {info.sampleCount !== null && (
            <div className="fc-info-row"><span>总帧数</span><span>{info.sampleCount}</span></div>
          )}
          <div className="fc-info-sep" />
          <div className="fc-info-row"><span>编码</span><span>{codecInfo.family}</span></div>
          {codecInfo.profile && (
            <div className="fc-info-row"><span>Profile</span><span>{codecInfo.profile}</span></div>
          )}
          <div className="fc-info-row fc-info-codec-str"><span>Codec</span><code>{info.codec ?? '—'}</code></div>
          {codecInfo.hint && <div className="fc-info-hint">⚠️ {codecInfo.hint}</div>}
          {info.audio && (
            <>
              <div className="fc-info-sep" />
              <div className="fc-info-row"><span>音频</span><span>{parseAudioCodec(info.audio.codec)}</span></div>
              {info.audio.sampleRate > 0 && (
                <div className="fc-info-row"><span>采样率</span><span>{(info.audio.sampleRate / 1000).toFixed(1)} kHz</span></div>
              )}
              {info.audio.channels > 0 && (
                <div className="fc-info-row"><span>声道</span><span>{info.audio.channels === 1 ? 'Mono' : info.audio.channels === 2 ? 'Stereo' : `${info.audio.channels} ch`}</span></div>
              )}
              {info.audio.bitrate > 0 && (
                <div className="fc-info-row"><span>音频码率</span><span>{Math.round(info.audio.bitrate / 1000)} kb/s</span></div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// 小视频 <200MB 读取几乎瞬间完成, 显示加载卡片反而闪烁; 只在大文件上展示
const LOADING_OVERLAY_MIN_BYTES = 200 * 1024 * 1024;

export function LoadingProgressOverlay({ bytes, total }: { bytes: number; total: number }) {
  if (total < LOADING_OVERLAY_MIN_BYTES) return null;
  if (bytes >= total) return null;
  const pct = total > 0 ? (bytes / total) * 100 : 0;
  const mb = (n: number) => (n / 1048576).toFixed(0);
  return (
    <div className="fc-loading-overlay">
      <div className="fc-loading-title">加载视频中…</div>
      <div className="fc-loading-stats">
        {mb(bytes)} MB / {mb(total)} MB · {pct.toFixed(1)}%
      </div>
      <div className="fc-loading-bar">
        <div className="fc-loading-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const GPU_DECODE_STORAGE_KEY = 'fc.ffmpegGpuDecode';

export function DecodeErrorCard({
  videoFile,
  codec,
  onCopy,
}: {
  videoFile: File;
  codec: string | null;
  onCopy: (text: string, label: string) => void;
}) {
  const filename = videoFile.name;
  const outName = filename.replace(/\.[^.]+$/, '_h264.mp4');
  const codecInfo = parseCodec(codec);

  // 默认 CPU 解码 (稳妥). 用户勾选时切 GPU 硬解 -- RTX 40/50 系才稳, 30 及以下常失败.
  const [gpuDecode, setGpuDecode] = useState(() => {
    try { return localStorage.getItem(GPU_DECODE_STORAGE_KEY) === '1'; } catch { return false; }
  });
  const toggleGpu = (v: boolean) => {
    setGpuDecode(v);
    try { localStorage.setItem(GPU_DECODE_STORAGE_KEY, v ? '1' : '0'); } catch { /* private mode etc. */ }
  };

  // NVIDIA 两条命令受 toggle 影响; libx264 纯软件版与显卡无关始终 CPU 软解.
  const hwaccel = gpuDecode ? '-hwaccel cuda ' : '';
  const commands: Array<{ label: string; desc: string; cmd: string }> = [
    {
      label: 'NVIDIA 快速 (推荐)',
      desc: gpuDecode
        ? 'GPU 全程硬解硬编, 1-2 分钟'
        : 'CPU 解 HEVC, GPU 编 H.264, 2-5 分钟',
      cmd: `ffmpeg -y ${hwaccel}-i "${filename}" -c:v h264_nvenc -preset p4 -cq 20 -pix_fmt yuv420p -c:a aac -b:a 192k "${outName}"`,
    },
    {
      label: '纯软件兼容',
      desc: '无 GPU 也可, 10-30 分钟',
      cmd: `ffmpeg -y -i "${filename}" -c:v libx264 -pix_fmt yuv420p -crf 20 -preset fast -c:a aac -b:a 192k "${outName}"`,
    },
    {
      label: 'NVIDIA 保留 10-bit HEVC',
      desc: '体积更小质量更好, Firefox 不支持',
      cmd: `ffmpeg -y ${hwaccel}-i "${filename}" -c:v hevc_nvenc -preset p4 -cq 22 -pix_fmt p010le -c:a aac -b:a 192k "${outName}"`,
    },
  ];

  return (
    <div className="fc-decode-error-card">
      <div className="fc-decode-error-title">⚠️ 无法解码此视频</div>
      <div className="fc-decode-error-body">
        浏览器不支持此 {codecInfo.family} profile{codecInfo.profile ? ` (${codecInfo.profile})` : ''}。
        Canon / Sony 专业机的 HEVC 4:2:2 10-bit、iPhone ProRes 常见此问题。
      </div>
      {codec && <div className="fc-decode-error-codec">Codec: <code>{codec}</code></div>}
      <label className="fc-decode-error-toggle">
        <input
          type="checkbox"
          checked={gpuDecode}
          onChange={(e) => toggleGpu(e.target.checked)}
        />
        <span>尝试 GPU 硬解 (RTX 40/50 系显卡勾选, 最快)</span>
      </label>
      <div className="fc-decode-error-hint">请用 FFmpeg 转码后重试:</div>
      <div className="fc-decode-error-cmds">
        {commands.map((c, i) => (
          <div key={i} className="fc-decode-error-cmd">
            <div className="fc-decode-error-cmd-head">
              <div>
                <div className="fc-decode-error-cmd-label">{c.label}</div>
                <div className="fc-decode-error-cmd-desc">{c.desc}</div>
              </div>
              <button
                className="fc-decode-error-copy"
                onClick={() => onCopy(c.cmd, 'command')}
                type="button"
              >
                Copy
              </button>
            </div>
            <code className="fc-decode-error-cmd-body">{c.cmd}</code>
          </div>
        ))}
      </div>
    </div>
  );
}
