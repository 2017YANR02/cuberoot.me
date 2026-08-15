import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// guard-registry: tracked at /code/guards (app/[lang]/code/guards/_guards.ts)
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

    // Lean cases such as F2L render the player directly; metadata-heavy cases
    // opt into the same player through AlgCaseMetaContent.
    expect(detail).toContain('<AlgPlayer');
    expect(detail).toMatch(/<AlgCaseMetaContent[\s\S]*?\bplayable\b/);
    expect(meta).toContain("import AlgPlayer from '@/components/AlgPlayer'");
    expect(meta).toContain('{expanded && (');
  });

  it('renders one correctly oriented shared player for every multi-orientation slot', () => {
    const detail = read('app/[lang]/alg/[puzzle]/[set]/[subgroup]/AlgCaseView.tsx');
    const styles = read('app/[lang]/alg/alg.css');

    expect(detail).toMatch(/caseObj\.algs\.map\(\(oriAlgs, oi\) => \{[\s\S]*?const orientedSetup = oriAdjustSetup\(caseObj\.setup, oi\);/);
    expect(detail).toMatch(/className="alg-case-detail-ori-player"[\s\S]*?<AlgPlayer[\s\S]*?alg=\{caseViewAlg\(selectedEntry\.alg, effectiveViewAngle\)\}[\s\S]*?setup=\{caseViewSetup\(selectedEntry\.setup \?\? orientedSetup, effectiveViewAngle\)\}/);
    expect(detail).toContain('inlinePlayer={!multiOri}');
    expect(detail).toContain('autoPlay={playRequest > 0}');
    expect(detail).toContain('playRequest={playRequest}');
    expect(detail).toContain("alg-case-detail-lean${multiOri ? ' is-multi-ori' : ''}");
    expect(detail).toMatch(/className="alg-case-detail-lean-thumb"[\s\S]*?<CaseThumb/);
    expect(detail).not.toContain('{!multiOri && (');
    expect(detail).not.toContain('is-without-thumb');
    expect(styles).toContain('@media (max-width: 900px)');
    expect(styles).toContain('.alg-case-detail-lean.is-multi-ori .alg-case-detail-lean-aside');
    expect(styles).toContain('.alg-case-detail-ori > .alg-alg-sortable:has(.alg-alg-row.is-expanded)');
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
  });
});
