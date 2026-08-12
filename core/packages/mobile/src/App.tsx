import { Capacitor } from '@capacitor/core';

const COPY = {
  en: {
    bridge: 'Native bridge',
    foundation: 'Mobile foundation',
    nativeReady: 'Ready',
    previewReady: 'Web preview',
    runtime: 'Runtime',
    summary: 'One codebase, native where it matters.',
  },
  zh: {
    bridge: '原生桥接',
    foundation: '移动端基础',
    nativeReady: '已就绪',
    previewReady: '网页预览',
    runtime: '运行环境',
    summary: '一套代码，需要时调用原生能力。',
  },
} as const;

type SupportedLanguage = keyof typeof COPY;

function preferredLanguage(): SupportedLanguage {
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function App() {
  const language = preferredLanguage();
  const copy = COPY[language];
  const platform = Capacitor.getPlatform();
  const isNative = Capacitor.isNativePlatform();

  return (
    <main className="app-shell">
      <section className="foundation" aria-labelledby="app-title">
        <p className="eyebrow">{copy.foundation}</p>

        <div className="cube-mark" aria-hidden="true">
          {Array.from({ length: 9 }, (_, index) => (
            <span className="cube-sticker" key={index} />
          ))}
        </div>

        <h1 id="app-title">CubeRoot</h1>
        <p className="summary">{copy.summary}</p>

        <dl className="runtime-status">
          <div>
            <dt>{copy.runtime}</dt>
            <dd>{platform.toUpperCase()}</dd>
          </div>
          <div>
            <dt>{copy.bridge}</dt>
            <dd>{isNative ? copy.nativeReady : copy.previewReady}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
