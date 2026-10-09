import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const detailSource = readFileSync(fileURLToPath(new URL(
  '../app/[lang]/alg/[puzzle]/[set]/[subgroup]/AlgCaseView.tsx',
  import.meta.url,
)), 'utf8');
const metaSource = readFileSync(fileURLToPath(new URL(
  '../components/AlgCaseMetaContent.tsx',
  import.meta.url,
)), 'utf8');
const editorSource = readFileSync(fileURLToPath(new URL(
  '../components/AdminCaseEditor.tsx',
  import.meta.url,
)), 'utf8');
const algEditorSource = readFileSync(fileURLToPath(new URL(
  '../components/AlgEditor.tsx',
  import.meta.url,
)), 'utf8');
const communitySource = readFileSync(fileURLToPath(new URL(
  '../components/CommunityAlgs.tsx',
  import.meta.url,
)), 'utf8');
const styles = readFileSync(fileURLToPath(new URL(
  '../app/[lang]/alg/alg.css',
  import.meta.url,
)), 'utf8');

describe('community algorithm placement', () => {
  it('mounts community rows inside the formula area for both detail layouts', () => {
    expect(detailSource).toContain("algsAfter={(!editor || effectiveViewAngle !== 'default') ? renderCommunityAlgs(!editor) : undefined}");
    expect(detailSource).toContain('{oi === 0 && renderCommunityAlgs(!editor)}');
    expect(metaSource.indexOf('{algsAfter}')).toBeGreaterThan(metaSource.indexOf('{algsWrap('));
    expect(metaSource.indexOf('{algsAfter}')).toBeLessThan(metaSource.indexOf('</div>\n        </div>)}'));
  });

  it('hides the community add button while the official algorithm editor is open', () => {
    expect(detailSource).toContain('allowAdd={allowAdd}');
    expect(detailSource).toContain('algorithmsAfter={renderCommunityAlgs(false)}');
    expect(detailSource.match(/renderCommunityAlgs\(!editor\)/g)).toHaveLength(2);
  });

  it('keeps admin-visible submissions after editable rows and before the add button', () => {
    expect(editorSource).toContain('renderBeforeAdd={children ? oi => oi === 0 ? algorithmsAfter : null : undefined}');
    expect(editorSource).not.toContain('{oi === 0 && algorithmsAfter}');
    expect(algEditorSource.indexOf('{renderBeforeAdd?.(oi)}')).toBeGreaterThan(algEditorSource.indexOf('{ori.map((row, ai) => {'));
    expect(algEditorSource.indexOf('{renderBeforeAdd?.(oi)}')).toBeLessThan(algEditorSource.indexOf('className="alg-editor-add"'));
  });

  it('keeps only one community component definition instead of a detached footer copy', () => {
    expect(detailSource.match(/<CommunityAlgs/g)).toHaveLength(1);
  });

  it('uses one delete icon and aligns every formula at the same inset', () => {
    expect(algEditorSource).toContain("import { Trash2,");
    expect(algEditorSource).toContain('<Trash2 size={12} />');
    expect(communitySource).not.toContain('UserIdLabel');
    expect(styles).toContain('--alg-case-detail-formula-indent: 32px;');
    expect(styles).toContain('padding-inline-start: var(--alg-case-detail-formula-indent);');
    expect(styles).toContain('grid-template-columns: 24px minmax(0, 1fr) auto;');
  });
});
