/** Read raster headers only; never accept SVG, an arbitrary URL, or the supplied MIME alone. */
export function rasterImageMime(data: Buffer): string | null {
  let mime = '';
  let width = 0;
  let height = 0;
  if (data.length >= 33 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    && data.toString('ascii', 12, 16) === 'IHDR') {
    mime = 'image/png'; width = data.readUInt32BE(16); height = data.readUInt32BE(20);
  } else if (data.length >= 14 && /^GIF8[79]a$/.test(data.toString('ascii', 0, 6)) && data.at(-1) === 0x3b) {
    mime = 'image/gif'; width = data.readUInt16LE(6); height = data.readUInt16LE(8);
  } else if (data.length >= 30 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP'
    && data.readUInt32LE(4) + 8 === data.length) {
    mime = 'image/webp';
    const chunk = data.toString('ascii', 12, 16);
    if (chunk === 'VP8X') { width = data.readUIntLE(24, 3) + 1; height = data.readUIntLE(27, 3) + 1; }
    else if (chunk === 'VP8 ' && data.subarray(23, 26).equals(Buffer.from([157, 1, 42]))) {
      width = data.readUInt16LE(26) & 0x3fff; height = data.readUInt16LE(28) & 0x3fff;
    } else if (chunk === 'VP8L' && data[20] === 0x2f) {
      const bits = data.readUInt32LE(21); width = (bits & 0x3fff) + 1; height = ((bits >>> 14) & 0x3fff) + 1;
    }
  } else if (data.length >= 4 && data[0] === 0xff && data[1] === 0xd8 && data.at(-2) === 0xff && data.at(-1) === 0xd9) {
    mime = 'image/jpeg';
    let offset = 2;
    while (offset + 4 <= data.length && data[offset] === 0xff) {
      while (data[offset + 1] === 0xff) offset++;
      const marker = data[offset + 1];
      if (marker === 0xda || marker === 0xd9 || offset + 4 > data.length) break;
      const size = data.readUInt16BE(offset + 2);
      if (size < 2 || offset + 2 + size > data.length) break;
      if ([0xc0, 0xc1, 0xc2].includes(marker) && size >= 8) {
        height = data.readUInt16BE(offset + 5); width = data.readUInt16BE(offset + 7); break;
      }
      offset += 2 + size;
    }
  }
  if (!mime || width < 1 || height < 1 || width > 4096 || height > 4096 || width * height > 16_000_000) return null;
  return mime;
}

