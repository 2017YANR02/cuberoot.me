"""Small real GLB fixtures exercise binary remapping, image sharing and corruption."""
import base64
import json
import struct
import tempfile
import unittest
from pathlib import Path

from pack_gltf import pack


class PackTests(unittest.TestCase):
    def setUp(self):
        root = Path(__file__).resolve().parents[3] / '.tmp/png/space-blender'
        root.mkdir(parents=True, exist_ok=True)
        self.folder = tempfile.TemporaryDirectory(dir=root)
        self.addCleanup(self.folder.cleanup)
        self.directory = Path(self.folder.name)

    def test_image_removal_keeps_geometry_and_shared_attribute_offsets(self):
        pixels = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=')
        image_data = pixels + b'\0' * (-len(pixels) % 4)
        vertices = struct.pack('<9f', 0, 0, 0, 1, 0, 0, 0, 1, 0)
        binary = image_data + vertices
        document = {
            'asset': {'version': '2.0'},
            'buffers': [{'byteLength': len(binary)}],
            'bufferViews': [{'buffer': 0, 'byteLength': len(pixels)}, {'buffer': 0, 'byteOffset': len(image_data), 'byteLength': len(vertices)}],
            'images': [{'bufferView': 0, 'mimeType': 'image/png'}],
            'accessors': [{'bufferView': 1, 'componentType': 5126, 'count': 3, 'type': 'VEC3'}],
            'meshes': [{'primitives': [{'attributes': {'POSITION': 0, '_BUILDINGDATA': 0}}]}],
        }
        encoded = json.dumps(document).encode()
        encoded += b' ' * (-len(encoded) % 4)
        source = self.directory / 'input.glb'
        source.write_bytes(struct.pack('<IIIII', 0x46546C67, 2, 28 + len(encoded) + len(binary), len(encoded), 0x4E4F534A) + encoded + struct.pack('<II', len(binary), 0x004E4942) + binary)
        target = self.directory / 'output.glb'
        summary = pack(source, target)
        raw = target.read_bytes()
        size = struct.unpack_from('<I', raw, 12)[0]
        result = json.loads(raw[20:20 + size])
        self.assertEqual(raw[28 + size:], vertices)
        self.assertEqual(result['accessors'][0]['bufferView'], 0)
        self.assertEqual(result['meshes'], document['meshes'])
        self.assertEqual((self.directory / summary['textures'][0]).read_bytes(), pixels)
        self.assertEqual(pack(target, target), summary)
        self.assertEqual(len(list((self.directory / 'textures').glob('*.png'))), 1)

    def test_invalid_input_does_not_replace_export(self):
        source, target = self.directory / 'bad.glb', self.directory / 'output.glb'
        source.write_bytes(b'not a glb')
        target.write_bytes(b'existing export')
        with self.assertRaises(ValueError):
            pack(source, target)
        self.assertEqual(target.read_bytes(), b'existing export')


if __name__ == '__main__':
    unittest.main()
