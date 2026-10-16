// Reviewed layout shells, not a ban on cards, inputs, menus or focus rings.
// Shared by the write/CI scanner and the browser inventory.
// Containers forbid decorative paint; headings only forbid separator borders.
// Add entries only after confirming an actual defect, never from a heuristic hit.
export const unframedSurfaces = [
  // These sections keep their ordinary-theme fallback; only scenery adapters
  // must remain unpainted. Controls and semantic child states are separate.
  ...[
    ['.alg-case-detail-ori-algs', '/zh/alg/3x3/oll/l-'],
    ['.detail-stats-grid', '/zh/recon/2381-ruimin-yan-3-3'],
    ['.detail-note', '/zh/recon/2381-ruimin-yan-3-3'],
    ['.wca-stats-table-wrapper', '/zh/wca/most_competitions_abroad'],
    ['.ns-stat-cell', '/zh/wca/results'],
    ['.reconstruct-playback-main', '/zh/timer'],
    ['.reconstruct-playback-side', '/zh/timer'],
    ['.reconstruct-stage-cell', '/zh/timer'],
    ['.reconstruct-move-list', '/zh/timer'],
    ['.reconstruct-empty', '/zh/timer'],
    ['.timer-reconstruct-metric', '/zh/timer'],
  ].map(([selector, route]) => ({ selector, route, kind: 'scenery-content' })),
  { selector: '.calendar-page .toolbar', kind: 'container', route: '/zh/wca/comp?year=2026&month=10&country=cn' },
  { selector: '.wca-stats-index-toolbar', kind: 'container', route: '/zh/wca' },
  { selector: '.sor-race-bar', kind: 'container', route: '/zh/wca/results?events=333,222' },
  { selector: '.viz-page .toolbar', kind: 'container', route: '/zh/wca/persons/2017YANR02?tab=results' },
  { selector: '.sim-header', kind: 'container', route: '/zh/sim' },
  { selector: '.directory-toolbar', kind: 'container', route: '/zh/teachers' },
  { selector: '.cmt-tabs', kind: 'container', route: '/zh/alg/commutator' },
  { selector: '.t10h-controls', kind: 'container', route: '/zh/wca/results?events=333,222' },
  ...[
    ['.wca-stats-index-section-header', '/zh/wca'],
    ['.about-section-title', '/zh/about'],
    ['.wiki-section-title', '/zh/wiki'],
    ['.calca-section-title', '/zh/calc-about'],
    ['.fca-section-title', '/zh/frame-count-about'],
    ['.moa-section-title', '/zh/mosaic-about'],
    ['.nema-section-title', '/zh/nemesizer-about'],
    ['.rca-section-title', '/zh/recon-about'],
    ['.ca-section-title', '/zh/wca/comp-about'],
    ['.gla-section-title', '/zh/wca/globe-about'],
    ['.pa-section-title', '/zh/wca/prediction-about'],
    ['.wcif-section > h2', '/zh/dev/wcif'],
  ].map(([selector, route]) => ({ selector, route, kind: 'heading' })),
];
