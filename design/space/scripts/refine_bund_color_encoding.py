"""Correct four existing byte albedos; preserve geometry and light parameters.

Default writes disposable PNG candidates and a report. --apply requires a
source-fingerprint-matched candidate report and saves a backed-up source.
No generator is rerun. References and validation: ../references/peace-crown.md.
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

sys.path.insert(0, str(Path(__file__).parent))
import refine_bund_hero_details as hero
import refine_peace_crown as guard

SOURCE = guard.SOURCE
OUTPUT = guard.ROOT / '.tmp/png/space-parallel-20260910/color-encoding'
REVISION = 'bund-albedo-srgb-20260910'
PROPERTY = 'spaceBundColorEncodingRevision'
IMAGE_KEYS = ['12/albedo', '13/albedo', '20/albedo', '20/copper-albedo']


def pixels(image):
    data = np.empty(image.size[0]*image.size[1]*4, dtype=np.float32)
    image.pixels.foreach_get(data)
    return data.reshape(-1, 4)


def digest(data):
    return hashlib.sha256(data.tobytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    scene = bpy.context.scene
    if Path(bpy.data.filepath).resolve() != SOURCE or scene.get('space_contract') != 2 or scene.get('space_asset') != 'shanghai':
        raise RuntimeError('Open the canonical contract-v2 Shanghai source')
    if scene.get(PROPERTY):
        raise RuntimeError('Color revision exists; do not encode an image twice')
    token = guard.source_fingerprint()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    candidate_path = OUTPUT / 'candidate-report.json'
    candidate = json.loads(candidate_path.read_text(encoding='utf8')) if args.apply else None
    if candidate and (candidate['sourceBefore'] != list(token) or candidate['revision'] != REVISION):
        raise RuntimeError('Candidate belongs to a different source; review again')
    objects = [o for o in scene.objects if o.get('space_export')]
    ids = Counter(o.get('spaceId') for o in objects)
    transforms = {o: o.matrix_world.copy() for o in scene.objects}
    materials = {mat for o in objects if o.type == 'MESH' for mat in o.data.materials if mat}
    textures = [node for mat in materials if mat.use_nodes for node in mat.node_tree.nodes
                if node.type == 'TEX_IMAGE' and node.image]
    untouched = {node.image: digest(pixels(node.image)) for node in textures
                 if node.image.name not in [hero.REVISION+'/'+key for key in IMAGE_KEYS]}
    report = {'revision': REVISION, 'sourceBefore': token, 'saved': False, 'images': []}
    for key in IMAGE_KEYS:
        image = bpy.data.images.get(hero.REVISION+'/'+key)
        nodes = [node for node in textures if node.image == image]
        if image is None or image.is_float or image.colorspace_settings.name != 'sRGB' or not nodes:
            raise RuntimeError('Expected a runtime non-float sRGB albedo: '+key)
        if not all(link.to_socket.name == 'Base Color' for node in nodes for link in node.outputs['Color'].links):
            raise RuntimeError('Image has a non-color consumer: '+key)
        old = pixels(image)
        if not np.isfinite(old).all() or not np.all(old[:, 3] == 1):
            raise RuntimeError('Unexpected albedo data or alpha')
        # The original generator wrote linear values directly into byte RGB.
        # Correct those values, retaining their existing procedural variation.
        new = old.copy()
        new[:, :3] = hero.encode_srgb(old[:, :3])
        image.pixels.foreach_set(new.ravel())
        image.update()
        image.pack()
        actual = pixels(image)
        if np.max(np.abs(actual-new)) > 1/255+.000001 or not np.array_equal(old[:, 3], actual[:, 3]):
            raise RuntimeError('Byte encoding or alpha roundtrip failed')
        filename = key.replace('/', '-')+'.png'
        # Write packed bytes directly, without altering the authored filepath.
        (OUTPUT / filename).write_bytes(bytes(image.packed_file.data))
        entry = {'image': image.name, 'file': filename, 'size': list(image.size),
                 'beforeSha256': digest(old), 'afterSha256': digest(actual),
                 'beforeMeanRgb': (old[:, :3].mean(axis=0, dtype=np.float64)*255).tolist(),
                 'afterMeanRgb': (actual[:, :3].mean(axis=0, dtype=np.float64)*255).tolist(),
                 'runtimeTextureNodes': len(nodes)}
        if candidate and entry != candidate['images'][len(report['images'])]:
            raise RuntimeError('Candidate pixels changed; inspect before saving')
        report['images'].append(entry)
    if any(digest(pixels(image)) != value for image, value in untouched.items()):
        raise RuntimeError('Unrelated image changed')
    if ids != Counter(o.get('spaceId') for o in scene.objects if o.get('space_export')) or any(
            o.matrix_world != matrix for o, matrix in transforms.items()):
        raise RuntimeError('Runtime identities or object transforms changed')
    report.update(preservedRuntimeObjects=sum(ids.values()), untouchedImages=len(untouched))
    scene[PROPERTY] = REVISION
    guard.assert_source_unchanged(token)
    if args.apply:
        backup = OUTPUT / 'shanghai-before-albedo-encoding.blend'
        if backup.exists():
            raise RuntimeError('Backup exists; inspect prior apply before proceeding')
        shutil.copy2(SOURCE, backup)
        report['backupSha256'] = hashlib.sha256(backup.read_bytes()).hexdigest()
        guard.assert_source_unchanged(token)
        bpy.context.preferences.filepaths.save_version = max(1, bpy.context.preferences.filepaths.save_version)
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), compress=True)
        report.update(saved=True, sourceAfter=guard.source_fingerprint())
    path = OUTPUT / ('saved-report.json' if args.apply else 'candidate-report.json')
    path.write_text(json.dumps(report, indent=2)+'\n', encoding='utf8')
    print('BUND_COLOR_ENCODING '+json.dumps(report), flush=True)


if __name__ == '__main__':
    main()
