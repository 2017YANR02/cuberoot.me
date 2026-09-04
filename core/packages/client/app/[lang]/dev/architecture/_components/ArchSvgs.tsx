export function RequestLifecycleSVG() {
  const steps = ['click', 'handler', 'fetch()', 'HTTP cache', 'Hono', 'PostgreSQL', 'JSON → DOM'];

  return (
    <svg viewBox="0 0 880 170" className="diagram-svg" role="img" aria-label="Request lifecycle">
      <line x1="20" y1="84" x2="860" y2="84" className="d-axis" />
      <polygon points="860,84 850,79 850,89" className="d-axis-arrow" />
      {steps.map((label, index) => {
        const x = 50 + index * 125;
        const upper = index % 2 === 0;
        return (
          <g key={label} className="d-step">
            <circle cx={x} cy="84" r="7" />
            <line x1={x} y1="84" x2={x} y2={upper ? 48 : 120} className="d-step-line" />
            <text x={x} y={upper ? 36 : 144} className="d-step-label">{label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function StatsPipelineSVG() {
  const nodes = [
    { label: 'WCA export', sub: 'public source', tone: 'ext' },
    { label: 'stats-build', sub: 'SQL + TypeScript', tone: 'core' },
    { label: 'JSON + TSV', sub: 'generated artifacts', tone: 'work' },
    { label: 'PG + static', sub: 'published data', tone: 'work' },
    { label: 'API + Web', sub: 'product views', tone: 'ext' },
  ];

  return (
    <svg viewBox="0 0 900 180" className="diagram-svg" role="img" aria-label="Statistics data pipeline">
      {nodes.map((node, index) => {
        const x = 15 + index * 178;
        return (
          <g key={node.label} className={`d-pl d-pl-${node.tone}`}>
            <rect x={x} y="48" width="150" height="76" rx="8" />
            <text x={x + 75} y="77" className="d-title">{node.label}</text>
            <text x={x + 75} y="99" className="d-sub">{node.sub}</text>
            {index < nodes.length - 1 && (
              <g className="d-arrow d-arrow-pipeline">
                <line x1={x + 150} y1="86" x2={x + 178} y2="86" />
                <polygon points={`${x + 178},86 ${x + 170},82 ${x + 170},90`} />
              </g>
            )}
          </g>
        );
      })}
      <text x="15" y="156" className="d-caption">builder output / transfer manifest / database loader stay aligned</text>
    </svg>
  );
}
