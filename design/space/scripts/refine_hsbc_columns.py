"""Correct HSBC's column spacing without rebuilding subsequent Blender edits.

The 2021 frontal photo establishes two inner pairs, not measured metric axes.
Default: disposable candidate render. --apply saves with a source backup;
--review-saved only renders. References: ../references/shanghai-landmarks.md.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import shutil
import sys

import bpy
import numpy as np
from mathutils import Matrix

sys.path.insert(0, str(Path(__file__).parent))
import refine_bund_galleries as galleries
import refine_bund_hero_details as hero
import refine_hsbc_drum as drum
import refine_peace_crown as guard
import refine_shanghai_landmarks as previous

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / 'design/space/scenes/shanghai.blend'
OUTPUT = ROOT / '.tmp/png/space-parallel-20260910/hsbc'
REVISION = 'hsbc-paired-columns-20260910'
PROPERTY = 'spaceHsbcColumnRevision'
OLD_AXES = [-12.7, -7.62, -2.54, 2.54, 7.62, 12.7]


def uv_bytes(mesh):
    result = []
    for layer in mesh.uv_layers:
        values = np.empty(len(mesh.loops)*2, dtype=np.float32)
        layer.data.foreach_get('uv', values)
        result.append((layer.name, values.tobytes()))
    return result


def author(root, archive):
    if root.get('spaceId') != hero.IDS['12'] or root.get(PROPERTY):
        raise RuntimeError('Expected uncorrected HSBC root; preserve subsequent edits')
    objects = {o.get('spaceId'): o for o in previous.meshes(root)}
    changes = []
    for part, count, per_column in [('fluted-columns', 41472, 6912), ('stone-carving', 25392, 3512)]:
        obj = objects[hero.REVISION+'/'+root['spaceId']+'/'+part]
        mesh = obj.data
        if len(mesh.vertices) != count or mesh.has_custom_normals or obj.matrix_local != Matrix.Identity(4):
            raise RuntimeError('Column geometry changed; inspect before applying '+part)
        before = np.array([v.co[:] for v in mesh.vertices], dtype=np.float32)
        # Window ornaments share stone-carving but lie outside the portico.
        groups = np.full(count, -1, dtype=np.int8)
        for i, axis in enumerate(OLD_AXES):
            mask = (np.abs(before[:, 0]-axis) < 1.112) & (before[:, 1] > .98)
            mask &= (before[:, 2] > 6.80) & (before[:, 2] < 23.09)
            if int(mask.sum()) != per_column or np.any(groups[mask] != -1):
                raise RuntimeError(f'Column {i} membership changed: {part}, {mask.sum()}')
            groups[mask] = i
        if part == 'fluted-columns' and np.any(groups == -1):
            raise RuntimeError('Unclassified shaft geometry')
        # Thirty window ornaments each contain four frame and two corbel boxes
        # (24 face-local vertices per box), independently of the column carving.
        if part == 'stone-carving':
            windows = before[groups == -1]
            if len(windows) != 30*6*24 or np.any(np.abs(windows[:, 0]) < 17.64):
                raise RuntimeError('Window ornament membership changed')
        for face in mesh.polygons:
            if len(set(groups[list(face.vertices)].tolist())) != 1:
                raise RuntimeError('A face crosses movable assemblies')
        uv = uv_bytes(mesh)
        loops = tuple(v.vertex_index for v in mesh.loops)
        materials = tuple(mesh.materials)
        galleries.archive(obj, archive)
        after = before.copy()
        for i, (old, new) in enumerate(zip(OLD_AXES, hero.HSBC_COLUMN_AXES)):
            after[groups == i, 0] += new-old
        mesh.vertices.foreach_set('co', after.ravel())
        mesh.update()
        actual = np.array([v.co[:] for v in mesh.vertices], dtype=np.float32)
        if not np.array_equal(actual, after) or uv_bytes(mesh) != uv:
            raise RuntimeError('Unexpected position or material UV change')
        if loops != tuple(v.vertex_index for v in mesh.loops) or materials != tuple(mesh.materials):
            raise RuntimeError('Topology or material assignments changed')
        changes.append({'part': part, 'vertices': count, 'verticesPerColumn': per_column,
                        'movedVertices': int(np.any(before != actual, axis=1).sum()),
                        'unchangedVertices': int(np.all(before == actual, axis=1).sum()),
                        'uvAndTopologyPreserved': True})
    root[PROPERTY] = REVISION
    root['spaceBundHeroDetail']['columnAxes'] = hero.HSBC_COLUMN_AXES
    root['spaceHsbcColumnSpacingEstimated'] = True
    bpy.context.view_layer.update()
    return {'oldAxes': OLD_AXES, 'newAxes': hero.HSBC_COLUMN_AXES, 'parts': changes,
            'photoDate': '2021-06-20', 'metricSpacingEstimated': True}


def main():
    parser = argparse.ArgumentParser()
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument('--apply', action='store_true')
    modes.add_argument('--review-saved', action='store_true')
    parser.add_argument('--no-render', action='store_true')
    parser.add_argument('--night', action='store_true')
    parser.add_argument('--wide', action='store_true')
    parser.add_argument('--label', default='columns-candidate')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if not args.label or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_' for c in args.label):
        parser.error('Use an ASCII label containing letters, numbers, dash or underscore')
    scene = bpy.context.scene
    if Path(bpy.data.filepath).resolve() != SOURCE or scene.get('space_contract') != 2 or scene.get('space_asset') != 'shanghai':
        raise RuntimeError('Open the canonical contract-v2 Shanghai source')
    token = guard.source_fingerprint()
    root = next(o for o in scene.objects if o.get('space_export') and o.get('spaceId') == hero.IDS['12'])
    report = {'revision': REVISION, 'sourceBefore': token, 'saved': False}
    OUTPUT.mkdir(parents=True, exist_ok=True)
    if args.review_saved:
        if root.get(PROPERTY) != REVISION:
            raise RuntimeError('Corrected column revision missing')
    else:
        original = {o: o.matrix_world.copy() for o in scene.objects}
        ids = Counter(o.get('spaceId') for o in scene.objects if o.get('space_export'))
        archive = bpy.data.collections.new('ARCHIVE before '+REVISION+' (not exported)')
        scene.collection.children.link(archive)
        archive.hide_render = archive.hide_viewport = True
        report['details'] = author(root, archive)
        if ids != Counter(o.get('spaceId') for o in scene.objects if o.get('space_export')):
            raise RuntimeError('Runtime identities changed')
        if any(obj.matrix_world != matrix for obj, matrix in original.items()):
            raise RuntimeError('Original object transform changed')
        report['preservedRuntimeIds'] = sum(ids.values())
    report['crownProbes'] = drum.verify(root)
    guard.assert_source_unchanged(token)
    if args.apply:
        backup = OUTPUT / 'shanghai-before-paired-columns.blend'
        if backup.exists():
            raise RuntimeError('Backup already exists; inspect previous integration')
        shutil.copy2(SOURCE, backup)
        report['backup'] = str(backup)
        report['backupSha256'] = hashlib.sha256(backup.read_bytes()).hexdigest()
        guard.assert_source_unchanged(token)
        bpy.context.preferences.filepaths.save_version = max(1, bpy.context.preferences.filepaths.save_version)
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), compress=True)
        report['saved'] = True
        report['sourceAfter'] = guard.source_fingerprint()
    (OUTPUT/(args.label+'-report.json')).write_text(json.dumps(report, indent=2)+'\n', encoding='utf8')
    print('HSBC_PAIRED_COLUMNS '+json.dumps(report), flush=True)
    if not args.no_render:
        hero.OUTPUT = OUTPUT
        hero.review(root, '12', args.label, args.night, not args.wide)


if __name__ == '__main__':
    main()
