import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)
import { describe, expect, it } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

describe('algorithm player placement', () => {
  it('keeps category lists static and plays algs on case detail pages', () => {
    const category = read('components/AlgCategoryView.tsx');
    const detail = read('app/[lang]/alg/[puzzle]/[set]/[subgroup]/AlgCaseView.tsx');
    const meta = read('components/AlgCaseMetaContent.tsx');

    expect(category).not.toContain("import AlgPlayer from '@/components/AlgPlayer'");
    expect(category).not.toContain('<AlgPlayer');

    // Every canonical case detail uses a fixed player beside its alg list;
    // metadata-heavy cases opt into the same layout through AlgCaseMetaContent.
    expect(detail).toContain('<AlgPlayer');
    expect(detail.match(/<AlgPlayer\b/g) ?? []).toHaveLength(1);
    expect(detail).toMatch(/<AlgCaseMetaContent[\s\S]*?\bplayable\b/);
    expect(meta).toContain("import AlgPlayer from '@/components/AlgPlayer'");
    expect(meta.match(/<AlgPlayer\b/g) ?? []).toHaveLength(1);
    expect(meta).toContain("'alg-meta-case-player-layout alg-case-detail-ori-main'");
  });

  it('reuses the fixed F2L player-and-list layout for every lean case detail', () => {
    const detail = read('app/[lang]/alg/[puzzle]/[set]/[subgroup]/AlgCaseView.tsx');
    const styles = read('app/[lang]/alg/alg.css');

    expect(detail).toMatch(/caseObj\.algs\.map\(\(oriAlgs, oi\) => \{[\s\S]*?const orientedSetup = oriAdjustSetup\(caseObj\.setup, oi\);/);
    expect(detail).toMatch(/className="alg-case-detail-ori-player"[\s\S]*?<AlgPlayer[\s\S]*?alg=\{displayAlg\(caseViewAlg\(selectedEntry\.alg, effectiveViewAngle\)\)\}[\s\S]*?setup=\{caseViewSetup\(selectedEntry\.setup \?\? orientedSetup, effectiveViewAngle\)\}/);
    expect(detail).not.toContain('inlinePlayer');
    expect(detail).toContain('autoPlay={playRequest > 0}');
    expect(detail).toContain('playRequest={playRequest}');
    expect(detail).toContain('className="alg-case-detail-lean is-paired-player"');
    expect(detail).toContain('className="alg-case-detail-lean-algs is-paired-player"');
    expect(detail).toMatch(/className="alg-case-detail-ori-main"[\s\S]*?className="alg-case-detail-ori-player"[\s\S]*?className="alg-case-detail-ori-algs"/);
    expect(detail).toMatch(/className="alg-case-detail-lean-thumb"[\s\S]*?<CaseThumb/);
    expect(detail).not.toContain('{!multiOri && (');
    expect(detail).not.toContain('is-without-thumb');
    expect(styles).toMatch(/\.alg-case-detail-lean-algs\.is-paired-player\s*\{\s*gap:\s*24px;/);
    expect(styles).toMatch(/\.alg-case-detail-ori-main\s*\{[\s\S]*?grid-template-columns:\s*300px minmax\(0, 1fr\);/);
    expect(styles).toContain('@media (max-width: 900px)');
    expect(styles).toContain('.alg-case-detail-lean.is-paired-player .alg-case-detail-lean-aside');
    expect(styles).toContain('.alg-case-detail-ori-algs > .alg-alg-sortable:has(.alg-alg-row.is-expanded)');
    expect(styles).toMatch(/@media \(max-width: 680px\)[\s\S]*?\.alg-case-detail-ori-main\s*\{[\s\S]*?flex-direction:\s*column;/);
  });

  it('keeps rich metadata above a fixed shared player and alg list', () => {
    const meta = read('components/AlgCaseMetaContent.tsx');
    const modal = read('components/AlgCaseMetaModal.tsx');
    const styles = read('app/[lang]/alg/alg.css');
    const beforePlayer = meta.slice(meta.indexOf('<div className="alg-meta-related-grid alg-meta-top-grid">'), meta.indexOf('<div className="alg-meta-case">'));
    const mappedAlgs = meta.slice(meta.indexOf('algsWrap(algs.map'));

    expect(beforePlayer).toContain('family.map');
    expect(beforePlayer).toContain('<CaseThumb');
    expect(beforePlayer).toContain('alg-meta-related-label');
    expect(beforePlayer).toContain('alg-meta-related-name');
    expect(beforePlayer).toContain('is-current');
    expect(beforePlayer).toContain('alg-meta-scramble-row');
    expect(beforePlayer).not.toContain('<AlgPlayer');
    expect(meta).toContain("const selectedAlg = algs.find(a => `${a.key}:${a.originalIndex}` === selectedAlgKey) ?? algs[0]");
    expect(meta).toContain('playbackAlg: shown');
    expect(meta).toMatch(/alg-meta-case-player-layout alg-case-detail-ori-main[\s\S]*?className="alg-case-detail-ori-player"[\s\S]*?<AlgPlayer[\s\S]*?alg=\{selectedAlg\.playbackAlg\}[\s\S]*?alg-meta-case-algs alg-case-detail-ori-algs/);
    expect(meta).toContain('selected={selected}');
    expect(meta).toContain('setSelectedAlgKey(rowKey)');
    expect(meta).toContain('setPlayRequest(current => current + 1)');
    expect(mappedAlgs).not.toContain('<AlgPlayer');
    expect(modal).toMatch(/<AlgCaseMetaContent\s+caseObj=\{caseObj\}[\s\S]*?jump=\{\{ kind: 'callback', onJump \}\}\s*\/>/);
    expect(modal).not.toMatch(/<AlgCaseMetaContent[\s\S]{0,500}?\bplayable\b/);
    expect(styles).toMatch(/\.alg-meta-related-grid\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;[^}]*gap:\s*10px;/);
    expect(styles).toMatch(/\.alg-meta-top-grid\s*\{[^}]*border-bottom:\s*1px solid var\(--border-default\);/);
    expect(styles).toMatch(/\.alg-meta-case-player-layout\s*\{\s*flex:\s*1;\s*\}/);
  });

  it('keeps the existing case header controls above either body layout', () => {
    const detail = read('app/[lang]/alg/[puzzle]/[set]/[subgroup]/AlgCaseView.tsx');
    const header = detail.slice(detail.indexOf('<div className="alg-case-detail-head">'), detail.indexOf('{m ? ('));

    expect(header).toMatch(/alg-case-detail-back[\s\S]*?alg-case-detail-title[\s\S]*?<BoolToggle[\s\S]*?alg-view-angle[\s\S]*?<CubeOrientationSelect[\s\S]*?<AlgPdfButton[\s\S]*?<AlgAdminValidate/);
    expect(header).not.toContain('alg-case-detail-ori-main');
    expect(header).not.toContain('<AlgPlayer');
  });

  it('routes every canonical case detail through the shared AlgCaseView', () => {
    const route = read('app/[lang]/alg/[puzzle]/[set]/[subgroup]/AlgSubOrCaseClient.tsx');

    expect(route).toContain("import AlgCaseView from './AlgCaseView'");
    expect(route).toContain('return <AlgCaseView puzzle={puzzle as AlgPuzzle} set={set} caseObj={caseObj} data={data} />;');
  });

  it('binds the shared sim pointer bridge so dragging the cube changes only the view', () => {
    const player = read('components/AlgPlayer/AlgSimPlayer.tsx');

    expect(player).toContain("import('@/app/[lang]/sim/Toucher')");
    expect(player).toContain('toucher.init(m.renderer.domElement, world.controller.touch)');
    expect(player).toContain("world.controller.dragEmpty = 'view'");
    expect(player).toContain('world.controller.onOrbit = (dx, dy) => orbitSceneFree(world, dx, dy, ORBIT_K)');
    expect(player).toContain('toucher.destroy()');
  });

  it('routes every SQ1 formula-set player through the shared /sim engine', () => {
    const player = read('components/AlgPlayer/AlgPlayer.tsx');
    const simPlayer = read('components/AlgPlayer/AlgSimPlayer.tsx');
    const editor = read('components/AdminCaseEditor.tsx');

    expect(player).toMatch(/DEFAULT_SIM[^\n]+\bsq1\b/);
    expect(simPlayer).toContain("sq1: 'sq1'");
    expect(simPlayer).toContain("if (puzzle === 'sq1')");
    expect(simPlayer).toContain('(cube as Sq1Cube).setStickering(set)');
    expect(editor).toContain("engine={puzzle === 'sq1' ? 'sim' : 'twisty'}");
    const detail = read('app/[lang]/alg/[puzzle]/[set]/[subgroup]/AlgCaseView.tsx');
    const meta = read('components/AlgCaseMetaContent.tsx');
    expect(detail).not.toMatch(/<AlgPlayer[\s\S]{0,500}?engine=['"]twisty['"]/);
    expect(meta).not.toMatch(/<AlgPlayer[\s\S]{0,500}?engine=['"]twisty['"]/);
  });
});
