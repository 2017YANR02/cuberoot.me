import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)
import { describe, expect, it } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

describe('algorithm player placement', () => {
  it('embeds editing in the canonical detail and links category actions to it', () => {
    const detail = read('app/[lang]/alg/[puzzle]/[set]/[subgroup]/AlgCaseView.tsx');
    const category = read('components/AlgCategoryView.tsx');
    expect(detail).toContain('>{renderDetail}</AdminCaseEditor>');
    expect(detail).toContain('editorAlgorithms={editor?.algorithms}');
    expect(detail).toContain('{editor ? editor.name : primary}');
    expect(detail).not.toContain('<Pencil');
    expect(category).not.toContain('<Pencil');
    expect(category).toMatch(/<Link\s+href=\{caseDetailHref\(c\)\}\s+className="alg-case-cardlink"/);
    expect(category).not.toContain("setEditorState({ mode: 'edit'");
    expect(detail).toContain('isAdmin && caseObj.id != null');
    expect(detail).not.toContain('editMode');
    expect(category).toContain('onClose={() => setEditorState(null)}');
  });

  it('uses the shared top-layer display rule in every formula list, rich text and PDF', () => {
    for (const path of [
      'components/AlgCategoryView.tsx',
      'components/AlgCaseMetaContent.tsx',
      'app/[lang]/alg/[puzzle]/[set]/[subgroup]/AlgCaseView.tsx',
    ]) {
      const source = read(path);
      expect(source, path).toMatch(/displayCaseAlg\(puzzle, set,/);
      expect(source, path).toMatch(/displayCaseAlgHtml\(puzzle, set,/);
    }
    expect(read('lib/alg_pdf/from_cases.ts')).toContain('displayCaseAlg(puzzle, set, angled)');
  });
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
    expect(meta).toContain("'alg-meta-case-player-layout alg-case-detail-ori-main alg-player-list-layout'");
  });

  it('reuses the fixed F2L player-and-list layout for every lean case detail', () => {
    const detail = read('app/[lang]/alg/[puzzle]/[set]/[subgroup]/AlgCaseView.tsx');
    const relations = read('components/AlgCaseRelationCards.tsx');
    const styles = read('app/[lang]/alg/alg.css');
    const sharedStyles = read('components/AlgPlayer/alg-sim-player.css');

    expect(detail).toMatch(/displayedOrientations\.map\(\(\{ oriAlgs, oi \}\) => \{[\s\S]*?const orientedSetup = oriAdjustSetup\(caseObj\.setup, oi\);/);
    expect(detail).toContain("const selectedAlg = caseViewAlg(selectedEntry?.alg ?? '', effectiveViewAngle);");
    expect(detail).toContain("const primaryAlg = caseViewAlg(oriAlgs[0]?.alg ?? '', effectiveViewAngle);");
    expect(detail).toContain('const canonicalPrimary = canonicalF2lPlayerSequence(primaryAlg);');
    expect(detail).toMatch(/const playerAlg = useF2lOrientationGrid[\s\S]*?canonicalF2lPlayerSequence\(selectedAlg\)\.alg[\s\S]*?: selectedAlg;/);
    expect(detail).toMatch(/const orientationSetup = useF2lOrientationGrid[\s\S]*?canonicalPrimary\.setup[\s\S]*?: caseViewSetup\(orientedSetup, effectiveViewAngle\);/);
    expect(detail).toMatch(/className="alg-case-detail-ori-player alg-player-list-player"[\s\S]*?<AlgPlayer[\s\S]*?alg=\{playerAlg\}[\s\S]*?setup=\{orientationSetup\}[\s\S]*?orientation=\{effectiveOrientation\}/);
    expect(detail).toMatch(/className="alg-case-detail-ori-algs alg-player-list-options">[\s\S]*?<SetupLine[\s\S]*?displayCaseScramble\(puzzle, set, orientationSetup\)/);
    expect(detail).toContain('renderOrientationSetup={(setup) => (');
    expect(detail).not.toContain('{editor && <div hidden={effectiveViewAngle !== \'default\'}>{editor.setup}</div>}');
    expect(detail).not.toContain('inlinePlayer');
    expect(detail).toContain('autoPlay={playRequest > 0}');
    expect(detail).toContain('playRequest={playRequest}');
    expect(detail).toContain('className="alg-case-detail-lean is-paired-player"');
    expect(detail).toContain("useF2lOrientationGrid = puzzle === '3x3'");
    expect(detail).toContain("(set === 'f2l' || set === 'adv-f2l')");
    expect(detail).toMatch(/F2L_DETAIL_ORIENTATION_ORDER = new Map\(\[\s*\['FR', 0\],[\s\S]*?\['FL', 1\],[\s\S]*?\['BR', 2\],[\s\S]*?\['BL', 3\]/);
    expect(detail).toContain("useF2lOrientationGrid ? ' is-f2l-orientation-grid' : ''");
    expect(detail).toContain('size={useF2lOrientationGrid ? 220 : 260}');
    expect(detail).toContain("editor ? ' is-editing' : ''");
    expect(detail).toMatch(/className="alg-case-detail-ori-main alg-player-list-layout"[\s\S]*?className="alg-case-detail-ori-player alg-player-list-player"[\s\S]*?className="alg-case-detail-ori-algs alg-player-list-options"/);
    expect(detail).toContain("import { AlgCaseRelationCards, type AlgCaseRelationCardItem } from '@/components/AlgCaseRelationCards'");
    expect(detail).toContain("import { compareAlgGroupLabel } from '@/lib/alg_group_order'");
    expect(detail).toMatch(/const leanRelationCards = \(editor\?: InlineCaseEditorParts\): AlgCaseRelationCardItem\[\] => \(\[[\s\S]*?\]\)\.sort\(\(a, b\) => \([\s\S]*?compareAlgGroupLabel\(a\.name, b\.name\)/);
    expect(detail).toMatch(/\.map\(\(member, index\): AlgCaseRelationCardItem => \(\{[\s\S]*?current: member\.current,[\s\S]*?href: member\.current \? undefined : hrefFor\(member\.caseObj\)/);
    expect(detail).toContain('items={leanRelationCards(editor)}');
    expect(relations).toContain('className="alg-meta-related-grid alg-meta-top-grid"');
    expect(relations).toMatch(/<CaseThumb[\s\S]*?size=\{76\}/);
    expect(relations).toContain('alg-meta-related-card${item.current ? \' is-self is-current\' : \'\'}');
    expect(detail).not.toContain('alg-case-detail-lean-aside');
    expect(styles).toMatch(/\.alg-case-detail-lean\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;[\s\S]*?gap:\s*0;/);
    expect(styles).not.toContain('.alg-case-detail-lean-aside');
    expect(detail).not.toContain('{!multiOri && (');
    expect(detail).not.toContain('is-without-thumb');
    expect(styles).toMatch(/\.alg-case-detail-lean-algs\.is-paired-player\s*\{\s*gap:\s*24px;/);
    expect(styles).toMatch(/@media \(min-width: 901px\)[\s\S]*?\.alg-case-detail\.is-f2l-orientation-grid\s*\{[\s\S]*?max-width:\s*min\(1440px, 100%\);/);
    expect(styles).toMatch(/\.alg-case-detail-lean-algs\.is-paired-player\.is-f2l-orientation-grid\.is-editing \.alg-editor\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/);
    expect(styles).toMatch(/\.is-f2l-orientation-grid\.is-editing \.alg-editor > \.alg-editor-ori:nth-child\(3\)\s*\{\s*order:\s*4;/);
    expect(styles).toMatch(/@media \(min-width: 901px\) and \(max-width: 1399px\)[\s\S]*?\.is-f2l-orientation-grid \.alg-player-list-layout\s*\{[\s\S]*?flex-direction:\s*column;/);
    expect(sharedStyles).toMatch(/\.alg-player-list-layout\s*\{[\s\S]*?grid-template-columns:\s*300px minmax\(0, 1fr\);/);
    expect(styles).toContain('.alg-case-detail-ori-algs > .alg-alg-sortable:has(.alg-alg-row.is-expanded)');
    expect(sharedStyles).toMatch(/@media \(max-width: 900px\)[\s\S]*?\.alg-player-list-layout\s*\{[\s\S]*?flex-direction:\s*column;/);
  });

  it('keeps rich metadata above a fixed shared player and alg list', () => {
    const meta = read('components/AlgCaseMetaContent.tsx');
    const relations = read('components/AlgCaseRelationCards.tsx');
    const modal = read('components/AlgCaseMetaModal.tsx');
    const styles = read('app/[lang]/alg/alg.css');
    const beforePlayer = meta.slice(meta.indexOf('<AlgCaseRelationCards'), meta.indexOf('<div className="alg-meta-case">'));
    const mappedAlgs = meta.slice(meta.indexOf('algsWrap(algs.map'));

    expect(meta).toContain('const relationCards: AlgCaseRelationCardItem[]');
    expect(beforePlayer).toContain('<AlgCaseRelationCards');
    expect(relations).toContain('<CaseThumb');
    expect(relations).toContain('alg-meta-related-label');
    expect(relations).toContain('alg-meta-related-name');
    expect(relations).toContain('is-current');
    expect(beforePlayer).toContain('alg-meta-scramble-row');
    expect(beforePlayer).toContain('prefix={(');
    expect(beforePlayer).toContain('alg-meta-scramble-prefix');
    expect(beforePlayer).not.toContain('<AlgPlayer');
    expect(meta).toContain('?? algs.find(a => !caseAlgIssue(a.entry))');
    expect(meta).toContain('const playbackAlg = caseViewAlg(a.alg, viewAngle)');
    expect(meta).toContain('const shown = displayCaseAlg(puzzle, set, playbackAlg)');
    expect(meta).toMatch(/alg-meta-case-player-layout alg-case-detail-ori-main alg-player-list-layout[\s\S]*?className="alg-case-detail-ori-player alg-player-list-player"[\s\S]*?<AlgPlayer[\s\S]*?alg=\{selectedAlg\.playbackAlg\}[\s\S]*?alg-meta-case-algs alg-case-detail-ori-algs alg-player-list-options/);
    expect(meta).toContain('selected={selected}');
    expect(meta).toContain('setSelectedAlgKey(rowKey)');
    expect(meta).toContain('setPlayRequest(current => current + 1)');
    expect(mappedAlgs).not.toContain('<AlgPlayer');
    expect(modal).toMatch(/<AlgCaseMetaContent\s+caseObj=\{caseObj\}[\s\S]*?jump=\{\{ kind: 'callback', onJump \}\}\s*\/>/);
    expect(modal).not.toMatch(/<AlgCaseMetaContent[\s\S]{0,500}?\bplayable\b/);
    expect(styles).toMatch(/\.alg-meta-related-grid\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;[^}]*gap:\s*10px;/);
    expect(styles).toMatch(/\.alg-meta-top-grid\s*\{[^}]*border-bottom:\s*1px solid var\(--border-default\);/);
    expect(styles).toMatch(/\.alg-meta-scramble-row\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*row;[^}]*flex-wrap:\s*nowrap;/);
    expect(styles).toMatch(/\.alg-case-standard-detail code\s*\{[^}]*white-space:\s*nowrap;[^}]*overflow-x:\s*auto;/);
    expect(styles).toMatch(/\.alg-meta-case-player-layout\s*\{\s*flex:\s*1;\s*min-width:\s*0;\s*\}/);
  });

  it('preserves saved move marks on both lean and metadata-rich case details', () => {
    const detail = read('app/[lang]/alg/[puzzle]/[set]/[subgroup]/AlgCaseView.tsx');
    const meta = read('components/AlgCaseMetaContent.tsx');
    const styles = read('app/[lang]/alg/alg.css');

    expect(detail).toContain("import { sanitizeAlgHtml } from '@/lib/alg_html'");
    expect(detail).toMatch(/entry\.algHtml && viewAngle === 'default' && puzzle !== 'sq1'[\s\S]*?sanitizeAlgHtml\(displayCaseAlgHtml\(puzzle, set, entry\.algHtml\)\)/);
    expect(meta).toContain("import { sanitizeAlgHtml } from '@/lib/alg_html'");
    expect(meta).toMatch(/algHtml=\{viewAngle === 'default' && puzzle !== 'sq1' \? a\.html : undefined\}/);
    expect(meta).toContain('sanitizeAlgHtml(algHtml)');
    expect(styles).toContain('.alg-meta-algline-code u.wavy');
    expect(styles).toContain('.alg-meta-algline-code s');
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
    const interaction = read('components/sim-embed/attachEmbeddedSimInteraction.ts');

    expect(player).toContain("import('@/components/sim-embed/attachEmbeddedSimInteraction')");
    expect(player).toContain('const detachInteraction = attachEmbeddedSimInteraction({');
    expect(player).toContain('mode: interactionMode');
    expect(player).toContain('detachInteraction()');
    expect(interaction).toContain("import Toucher from '@/app/[lang]/sim/Toucher'");
    expect(interaction).toContain('toucher.init(dom, world.controller.touch)');
    expect(interaction).toContain("world.controller.dragEmpty = 'view'");
    expect(interaction).toContain('world.controller.onOrbit = orbit');
    expect(interaction).toContain('toucher.destroy()');
  });

  it('routes every /alg animation surface through the shared /sim-backed AlgPlayer', () => {
    const player = read('components/AlgPlayer/AlgPlayer.tsx');
    const simPlayer = read('components/AlgPlayer/AlgSimPlayer.tsx');
    const editor = read('components/AdminCaseEditor.tsx');
    const helper = read('app/[lang]/alg/3bld/helper/page.tsx');
    const comm = read('app/[lang]/alg/3bld/comm/page.tsx');

    expect(player).toMatch(/SIM_SUPPORTED[\s\S]{0,200}\b2x2\b[\s\S]{0,200}\b3x3\b[\s\S]{0,200}\b4x4\b[\s\S]{0,200}\b5x5\b[\s\S]{0,200}\bsq1\b[\s\S]{0,200}\bpyraminx\b[\s\S]{0,200}\bskewb\b/);
    expect(simPlayer).toContain("sq1: 'sq1'");
    expect(simPlayer).toContain("if (puzzle === 'sq1')");
    expect(simPlayer).toContain('(cube as Sq1Cube).setStickering(set)');
    expect(editor).toContain('<AlgPlayer');
    expect(editor).toMatch(/useQueryState\(\s*'orientation'[\s\S]*?withDefault\(DEFAULT_ALG_CUBE_ORIENTATION\)/);
    expect(editor).toContain('orientation={orientation}');
    expect(editor).not.toMatch(/<AlgPlayer[\s\S]{0,500}?\bengine=/);
    for (const source of [helper, comm]) {
      expect(source).toContain("import AlgPlayer from '@/components/AlgPlayer'");
      expect(source).toContain('<AlgPlayer');
      expect(source).not.toContain('TwistySection');
      expect(source).not.toContain("cubing/twisty");
    }
    const detail = read('app/[lang]/alg/[puzzle]/[set]/[subgroup]/AlgCaseView.tsx');
    const meta = read('components/AlgCaseMetaContent.tsx');
    expect(detail).not.toMatch(/<AlgPlayer[\s\S]{0,500}?engine=['"]twisty['"]/);
    expect(meta).not.toMatch(/<AlgPlayer[\s\S]{0,500}?engine=['"]twisty['"]/);
  });
});
