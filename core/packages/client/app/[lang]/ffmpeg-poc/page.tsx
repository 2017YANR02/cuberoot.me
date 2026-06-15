'use client';

// POC: verify @ffmpeg/ffmpeg multi-threaded WASM loads in Next.js 16 App Router.
// Mirrors packages/client-vite/src/pages/frame-count/FrameCountPage.tsx:1965-1971.
// COOP/COEP set globally in next.config.ts so SharedArrayBuffer is available.

import { useCallback, useRef, useState } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

interface PocResult {
  sabAvailable: boolean;
  crossOriginIsolated: boolean;
  loadMs: number;
  logTailLines: string[];
  versionLine: string | null;
}

export default function FfmpegPocPage() {
  const [status, setStatus] = useState<string>('Click Load FFmpeg to start');
  const [result, setResult] = useState<PocResult | null>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);

  const runPoc = useCallback(async () => {
    setResult(null);
    setStatus('Creating FFmpeg instance…');
    const ff = new FFmpeg();
    ffmpegRef.current = ff;

    const logs: string[] = [];
    ff.on('log', ({ message }) => {
      logs.push(message);
    });

    setStatus('Resolving core via toBlobURL…');
    const t0 = performance.now();
    const coreURL = await toBlobURL('/ffmpeg/ffmpeg-core.js', 'text/javascript');
    const wasmURL = await toBlobURL('/ffmpeg/ffmpeg-core.wasm', 'application/wasm');
    const workerURL = await toBlobURL('/ffmpeg/ffmpeg-core.worker.js', 'text/javascript');

    setStatus('Calling ff.load()…');
    // classWorkerURL: bypass Turbopack module-worker bundling. See public/ffmpeg/ffmpeg-classworker.js.
    // Use absolute URL — `new URL(rel, import.meta.url)` inside @ffmpeg/ffmpeg classes.js
    // resolves against the Turbopack chunk URL which is file:// in dev.
    const classWorkerURL = new URL('/ffmpeg/ffmpeg-classworker.js', window.location.origin).href;
    await ff.load({ classWorkerURL, coreURL, wasmURL, workerURL });

    setStatus('Running -version probe…');
    const beforeProbe = logs.length;
    await ff.exec(['-version']);
    const probeLogs = logs.slice(beforeProbe);
    const versionLine = probeLogs.find((l) => l.startsWith('ffmpeg version')) ?? null;

    setResult({
      sabAvailable: typeof SharedArrayBuffer !== 'undefined',
      crossOriginIsolated: typeof self !== 'undefined' && self.crossOriginIsolated,
      loadMs: Math.round(performance.now() - t0),
      logTailLines: logs.slice(-8),
      versionLine,
    });
    setStatus('Done.');
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: 'ui-sans-serif, system-ui' }}>
      <h1>FFmpeg WASM POC (Next.js 16)</h1>
      <p style={{ color: '#666' }}>
        Verifies @ffmpeg/ffmpeg + multi-threaded core load via toBlobURL inside a Next.js App Router
        client component with COOP/COEP cross-origin isolation.
      </p>

      <button
        type="button"
        onClick={() => {
          runPoc().catch((e: unknown) => {
            const dump =
              e instanceof Error
                ? `${e.name}: ${e.message}\n${e.stack}`
                : typeof e === 'string'
                  ? e
                  : (() => { try { return JSON.stringify(e); } catch { return String(e); } })();
            setStatus(`Caught: ${dump}`);
            console.error('[ffmpeg-poc caught]', e);
          });
        }}
        style={{ marginTop: 16, padding: '8px 16px' }}
      >
        Load FFmpeg
      </button>

      <div
        style={{
          marginTop: 16,
          padding: 12,
          background: '#f4f4f5',
          borderRadius: 6,
          fontFamily: 'ui-monospace, monospace',
          fontSize: 13,
        }}
      >
        <strong>Status:</strong> {status}
      </div>

      {result && (
        <table
          style={{
            marginTop: 16,
            borderCollapse: 'collapse',
            fontFamily: 'ui-monospace, monospace',
            fontSize: 13,
          }}
        >
          <tbody>
            <tr>
              <td style={{ padding: '4px 12px 4px 0', color: '#666' }}>crossOriginIsolated</td>
              <td>{String(result.crossOriginIsolated)}</td>
            </tr>
            <tr>
              <td style={{ padding: '4px 12px 4px 0', color: '#666' }}>SharedArrayBuffer</td>
              <td>{String(result.sabAvailable)}</td>
            </tr>
            <tr>
              <td style={{ padding: '4px 12px 4px 0', color: '#666' }}>loadMs</td>
              <td>{result.loadMs}</td>
            </tr>
            <tr>
              <td style={{ padding: '4px 12px 4px 0', color: '#666' }}>version</td>
              <td>{result.versionLine ?? '(not found in log)'}</td>
            </tr>
          </tbody>
        </table>
      )}

      {result && (
        <pre
          style={{
            marginTop: 16,
            padding: 12,
            background: '#1f1f23',
            color: '#e4e4e7',
            borderRadius: 6,
            fontSize: 12,
            overflow: 'auto',
            maxWidth: '100%',
          }}
        >
          {result.logTailLines.join('\n')}
        </pre>
      )}
    </main>
  );
}
