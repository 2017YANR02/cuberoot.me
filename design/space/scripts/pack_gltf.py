"""Share content-addressed images across Space GLBs without changing their meshes."""
import hashlib
import json
import os
import struct
import tempfile
from pathlib import Path


def atomic_write(path, data):
    """Stage on the destination volume; a failed write never truncates the last export."""
    path.parent.mkdir(parents=True, exist_ok=True)
    staging = path.parent / '.tmp'
    staging.mkdir(exist_ok=True)
    pending = None
    try:
        with tempfile.NamedTemporaryFile(dir=staging, delete=False) as stream:
            pending = Path(stream.name)
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(pending, path)
    finally:
        if pending is not None and pending.exists():
            pending.unlink()


def pack(source, target):
    raw = source.read_bytes()
    if len(raw) < 28:
        raise ValueError('Truncated GLB')
    magic, version, length = struct.unpack_from('<III', raw)
    if magic != 0x46546C67 or version != 2 or length != len(raw):
        raise ValueError('Invalid GLB header')
    json_length, kind = struct.unpack_from('<II', raw, 12)
    if kind != 0x4E4F534A:
        raise ValueError('Expected GLB JSON chunk')
    document = json.loads(raw[20:20 + json_length])
    binary_length, binary_kind = struct.unpack_from('<II', raw, 20 + json_length)
    binary = raw[28 + json_length:]
    if binary_kind != 0x004E4942 or binary_length != len(binary):
        raise ValueError('Invalid GLB binary chunk')
    views = document.get('bufferViews', [])
    for view in views:
        offset, size = view.get('byteOffset', 0), view['byteLength']
        if view.get('buffer', 0) != 0 or offset < 0 or size < 0 or offset + size > len(binary):
            raise ValueError('GLB buffer view exceeds its binary chunk')
    image_views = set()
    images = []
    for image in document.get('images', []):
        if 'bufferView' not in image:
            images.append(image['uri']); continue
        index = image.pop('bufferView')
        view = views[index]
        payload = binary[view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']]
        suffix = {'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp'}[image.pop('mimeType')]
        name = 'textures/' + hashlib.sha256(payload).hexdigest()[:24] + suffix
        path = target.parent / name
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists() or hashlib.sha256(path.read_bytes()).digest() != hashlib.sha256(payload).digest():
            atomic_write(path, payload)
        image['uri'] = name
        images.append(name); image_views.add(index)
    referenced = set()
    def refs(value):
        if isinstance(value, dict):
            for key, item in value.items():
                if key == 'bufferView': referenced.add(item)
                else: refs(item)
        elif isinstance(value, list):
            for item in value: refs(item)
    refs(document)
    packed = bytearray(); remap = {}; new_views = []
    for index, view in enumerate(views):
        if index in image_views and index not in referenced: continue
        packed.extend(b'\0' * (-len(packed) % 4))
        offset = len(packed)
        packed.extend(binary[view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']])
        remap[index] = len(new_views)
        new_views.append({**view, 'byteOffset': offset})
    def rewrite(value):
        if isinstance(value, dict):
            for key, item in value.items():
                if key == 'bufferView': value[key] = remap[item]
                else: rewrite(item)
        elif isinstance(value, list):
            for item in value: rewrite(item)
    rewrite(document)
    document['bufferViews'] = new_views
    document['buffers'] = [{'byteLength': len(packed)}]
    encoded = json.dumps(document, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
    encoded += b' ' * (-len(encoded) % 4)
    packed.extend(b'\0' * (-len(packed) % 4))
    result = struct.pack('<IIIII', magic, 2, 28 + len(encoded) + len(packed), len(encoded), 0x4E4F534A) + encoded + struct.pack('<II', len(packed), 0x004E4942) + packed
    atomic_write(target, result)
    return {'sha256': hashlib.sha256(result).hexdigest(), 'bytes': len(result), 'textures': sorted(set(images)), 'schemaVersion': 2}


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--directory', type=Path, required=True)
    args = parser.parse_args()
    for path in args.directory.glob('*.glb'):
        entry = json.loads(path.with_suffix('.json').read_text(encoding='utf-8'))
        entry.update(pack(path, path))
        atomic_write(path.with_suffix('.json'), (json.dumps(entry, indent=2) + '\n').encode('utf-8'))
        print(path.stem, entry['bytes'])
