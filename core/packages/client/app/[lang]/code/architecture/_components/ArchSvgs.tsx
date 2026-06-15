export function SystemTopoSVG() {
  return (
    <svg viewBox="0 0 880 380" className="diagram-svg" role="img" aria-label="System topology">
      <defs>
        <marker id="topo-ah" markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="context-stroke" />
        </marker>
      </defs>
      {/* ── top lane: build / data ── */}
      <g className="d-box d-box-ext">
        <rect x="300" y="24" width="180" height="60" rx="6" />
        <text x="390" y="50" className="d-title">WCA Public Dump</text>
        <text x="390" y="68" className="d-sub">每周 · .sql + .tsv</text>
      </g>
      <g className="d-box d-box-ext">
        <rect x="560" y="24" width="180" height="60" rx="6" />
        <text x="650" y="50" className="d-title">GitHub Actions</text>
        <text x="650" y="68" className="d-sub">CI · 周更 · deploy</text>
      </g>
      {/* ── serving lane ── */}
      <g className="d-box d-box-ext">
        <rect x="30" y="24" width="200" height="78" rx="10" />
        <text x="130" y="52" className="d-title">Vercel edge</text>
        <text x="130" y="70" className="d-sub">同份 Next 代码</text>
        <text x="130" y="88" className="d-sub d-mono">push 部署 · edge cache</text>
      </g>
      <g className="d-box d-box-user">
        <rect x="20" y="190" width="180" height="80" rx="10" />
        <text x="110" y="220" className="d-title">User Browser</text>
        <text x="110" y="238" className="d-sub">Chrome / Safari / Edge</text>
        <text x="110" y="256" className="d-sub d-mono">cuberoot.me</text>
      </g>
      <g className="d-box d-box-server">
        <rect x="320" y="120" width="240" height="230" rx="10" />
        <text x="440" y="150" className="d-title d-title-lg">Cloud VM</text>
        <text x="440" y="170" className="d-sub d-mono">one box, three services</text>
        <line x1="340" y1="190" x2="540" y2="190" className="d-divider" />
        <g>
          <rect x="340" y="204" width="200" height="36" rx="4" className="d-inner d-inner-a" />
          <text x="440" y="227" className="d-inner-text">nginx <tspan className="d-port">:443</tspan></text>
        </g>
        <g>
          <rect x="340" y="248" width="200" height="36" rx="4" className="d-inner d-inner-b" />
          <text x="440" y="271" className="d-inner-text">Hono API <tspan className="d-port">:3001</tspan></text>
        </g>
        <g>
          <rect x="340" y="292" width="200" height="36" rx="4" className="d-inner d-inner-c" />
          <text x="440" y="315" className="d-inner-text">PostgreSQL 13 <tspan className="d-port">:5432</tspan></text>
        </g>
      </g>
      <g className="d-box d-box-ext">
        <rect x="680" y="190" width="180" height="80" rx="10" />
        <text x="770" y="218" className="d-title">GH Pages</text>
        <text x="770" y="236" className="d-sub">fallback mirror</text>
        <text x="770" y="254" className="d-sub d-mono">cuberoot.me (CNAME)</text>
      </g>
      {/* ── top-lane arrows ── */}
      <g className="d-arrow d-arrow-cold">
        <line x1="480" y1="54" x2="560" y2="54" markerEnd="url(#topo-ah)" />
        <text x="520" y="44" className="d-label">pull weekly</text>
      </g>
      <g className="d-arrow d-arrow-cold">
        <line x1="634" y1="84" x2="550" y2="120" markerEnd="url(#topo-ah)" />
        <text x="614" y="104" className="d-label">scp · ssh</text>
      </g>
      {/* ── serving-lane arrows ── */}
      <g className="d-arrow d-arrow-hot">
        <line x1="200" y1="230" x2="320" y2="230" markerEnd="url(#topo-ah)" />
        <text x="256" y="222" className="d-label">HTTPS</text>
      </g>
      <g className="d-arrow d-arrow-hot">
        <line x1="110" y1="190" x2="126" y2="102" markerEnd="url(#topo-ah)" />
        <text x="66" y="150" className="d-label">split DNS</text>
      </g>
      <g className="d-arrow d-arrow-cold">
        <line x1="228" y1="100" x2="320" y2="200" markerEnd="url(#topo-ah)" />
        <text x="250" y="128" className="d-label">api · static</text>
      </g>
      <g className="d-arrow d-arrow-cold">
        <line x1="680" y1="230" x2="560" y2="230" markerEnd="url(#topo-ah)" />
        <text x="620" y="222" className="d-label">301</text>
      </g>
    </svg>
  );
}

export function PackageDepsSVG() {
  return (
    <svg viewBox="0 0 760 320" className="diagram-svg" role="img" aria-label="Monorepo packages">
      <defs>
        <marker id="pkg-ah" markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="context-stroke" />
        </marker>
      </defs>
      <g className="d-pkg d-pkg-shared">
        <rect x="320" y="130" width="120" height="60" rx="8" />
        <text x="380" y="158" className="d-title">shared</text>
        <text x="380" y="176" className="d-sub d-mono">types only</text>
      </g>
      <g className="d-pkg d-pkg-app">
        <rect x="80" y="40" width="160" height="64" rx="8" />
        <text x="160" y="68" className="d-title">client</text>
        <text x="160" y="86" className="d-sub d-mono">React 19 + Next.js 16</text>
      </g>
      <g className="d-pkg d-pkg-app">
        <rect x="80" y="220" width="160" height="64" rx="8" />
        <text x="160" y="248" className="d-title">server</text>
        <text x="160" y="266" className="d-sub d-mono">Hono + PG</text>
      </g>
      <g className="d-pkg d-pkg-iso">
        <rect x="520" y="220" width="160" height="64" rx="8" />
        <text x="600" y="248" className="d-title">stats-build</text>
        <text x="600" y="266" className="d-sub d-mono">CLI · 独立</text>
      </g>
      <g className="d-edge">
        <line x1="240" y1="86" x2="320" y2="148" markerEnd="url(#pkg-ah)" />
      </g>
      <g className="d-edge">
        <line x1="240" y1="240" x2="320" y2="170" markerEnd="url(#pkg-ah)" />
      </g>
      <text x="380" y="306" className="d-caption">
        client / server 都依赖 shared (纯类型) · stats-build 独立 CLI
      </text>
    </svg>
  );
}

export function RequestLifecycleSVG() {
  const steps = [
    { x: 30,  label: 'click',      t: '0 ms' },
    { x: 150, label: 'JS handler', t: '~2 ms' },
    { x: 280, label: 'fetch()',    t: '~5 ms' },
    { x: 420, label: 'nginx',      t: '~15 ms' },
    { x: 540, label: 'Hono',       t: '~18 ms' },
    { x: 660, label: 'PG query',   t: '~25 ms' },
    { x: 790, label: 'JSON → DOM', t: '~40 ms' },
  ];
  return (
    <svg viewBox="0 0 880 200" className="diagram-svg" role="img" aria-label="Request lifecycle">
      <line x1="20" y1="100" x2="860" y2="100" className="d-axis" />
      <polygon points="860,100 850,95 850,105" className="d-axis-arrow" />
      {steps.map((s, i) => (
        <g key={i} className="d-step">
          <circle cx={s.x + 20} cy="100" r="7" />
          <line x1={s.x + 20} y1="100" x2={s.x + 20} y2={i % 2 === 0 ? 50 : 150} className="d-step-line" />
          <text x={s.x + 20} y={i % 2 === 0 ? 38 : 174} className="d-step-label">{s.label}</text>
          <text x={s.x + 20} y={i % 2 === 0 ? 22 : 190} className="d-step-time">{s.t}</text>
        </g>
      ))}
      <text x="20" y="194" className="d-caption">典型读请求 · 端到端 &lt; 50ms · 缓存命中 &lt; 10ms</text>
    </svg>
  );
}

export function StatsPipelineSVG() {
  const nodes = [
    { x: 20,  label: 'WCA dump',      sub: '每周公开',                tone: 'ext' },
    { x: 180, label: 'MySQL',         sub: '本机 :3306',              tone: 'work' },
    { x: 340, label: 'stats-build',   sub: '80+ SQL · 1 TS',          tone: 'core' },
    { x: 500, label: 'JSON + TSV',    sub: 'artifacts/',              tone: 'work' },
    { x: 660, label: 'scp → VM',      sub: '~6 MB',                   tone: 'work' },
    { x: 820, label: 'PG / API / UI', sub: 'nginx cache 24h',         tone: 'ext' },
  ];
  return (
    <svg viewBox="0 0 980 200" className="diagram-svg" role="img" aria-label="Stats pipeline">
      {nodes.map((n, i) => (
        <g key={i} className={`d-pl d-pl-${n.tone}`}>
          <rect x={n.x} y="60" width="140" height="76" rx="8" />
          <text x={n.x + 70} y="88" className="d-title">{n.label}</text>
          <text x={n.x + 70} y="108" className="d-sub">{n.sub}</text>
          {i < nodes.length - 1 && (
            <g className="d-arrow d-arrow-pipeline">
              <line x1={n.x + 140} y1="98" x2={n.x + 160} y2="98" />
              <polygon points={`${n.x + 160},98 ${n.x + 152},94 ${n.x + 152},102`} />
            </g>
          )}
        </g>
      ))}
      <text x="20" y="180" className="d-caption">
        三处必须同步:builder.ts (写 TSV) · stats.yml (scp 清单) · load.sql (\copy 引)
      </text>
    </svg>
  );
}

export function MobilePipelineSVG() {
  return (
    <svg viewBox="0 0 900 540" className="diagram-svg" role="img" aria-label="Mobile build pipeline">
      <g className="d-box d-box-user">
        <rect x="280" y="14" width="340" height="68" rx="10" />
        <text x="450" y="42" className="d-title">static bundle (Next build)</text>
        <text x="450" y="64" className="d-sub d-mono">pnpm exec cap sync</text>
      </g>
      <g className="d-box d-box-server">
        <rect x="280" y="118" width="340" height="68" rx="10" />
        <text x="450" y="146" className="d-title">Capacitor 8 套壳</text>
        <text x="450" y="168" className="d-sub d-mono">appId me.cuberoot.app · webDir dist</text>
      </g>
      <g className="d-arrow">
        <line x1="450" y1="82" x2="450" y2="114" />
        <polygon points="450,114 445,106 455,106" />
      </g>
      <g className="d-arrow">
        <line x1="450" y1="186" x2="450" y2="210" />
        <line x1="170" y1="210" x2="730" y2="210" />
        <line x1="170" y1="210" x2="170" y2="232" />
        <line x1="730" y1="210" x2="730" y2="232" />
        <polygon points="170,232 165,224 175,224" />
        <polygon points="730,232 725,224 735,224" />
      </g>
      <g className="d-box d-box-ext">
        <rect x="40" y="232" width="260" height="68" rx="10" />
        <text x="170" y="260" className="d-title">ubuntu-latest runner</text>
        <text x="170" y="282" className="d-sub d-mono">gradle assembleDebug · ~3.5min</text>
      </g>
      <g className="d-box d-box-ext">
        <rect x="600" y="232" width="260" height="68" rx="10" />
        <text x="730" y="260" className="d-title">macos-latest runner</text>
        <text x="730" y="282" className="d-sub d-mono">xcodebuild archive · ~3min</text>
      </g>
      <g className="d-arrow">
        <line x1="170" y1="300" x2="170" y2="336" />
        <polygon points="170,336 165,328 175,328" />
      </g>
      <g className="d-arrow">
        <line x1="730" y1="300" x2="730" y2="336" />
        <polygon points="730,336 725,328 735,328" />
      </g>
      <g>
        <rect x="40" y="336" width="260" height="68" rx="10" fill="#ECF1EC" stroke="#B5CAB5" strokeWidth="1.5" />
        <text x="170" y="364" className="d-title">cuberoot.apk</text>
        <text x="170" y="386" className="d-sub">~40MB · debug signed</text>
      </g>
      <g>
        <rect x="600" y="336" width="260" height="68" rx="10" fill="#ECF1EC" stroke="#B5CAB5" strokeWidth="1.5" />
        <text x="730" y="364" className="d-title">cuberoot-unsigned.ipa</text>
        <text x="730" y="386" className="d-sub">~34MB · 待 Sideloadly 签</text>
      </g>
      <g className="d-arrow">
        <line x1="170" y1="404" x2="170" y2="440" />
        <polygon points="170,440 165,432 175,432" />
      </g>
      <g className="d-arrow">
        <line x1="730" y1="404" x2="730" y2="440" />
        <polygon points="730,440 725,432 735,432" />
      </g>
      <g className="d-box d-box-user">
        <rect x="40" y="440" width="260" height="68" rx="10" />
        <text x="170" y="468" className="d-title">Android 直装</text>
        <text x="170" y="490" className="d-sub">允许未知来源 · 数据持久</text>
      </g>
      <g className="d-box d-box-user">
        <rect x="600" y="440" width="260" height="68" rx="10" />
        <text x="730" y="468" className="d-title">iPhone · Sideloadly 自签</text>
        <text x="730" y="490" className="d-sub">免费 Apple ID · 7 天证书</text>
      </g>
    </svg>
  );
}
