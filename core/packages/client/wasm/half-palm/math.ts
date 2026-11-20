// These two kernels also compile to WebAssembly. Keep buffers and loop
// indices compatible with AssemblyScript and keep all sums in double precision.
type Index = number;
type Scalar = number;
type Float = number;

export function smoothPalm(
  source: Float32Array, destination: Float32Array, coords: Uint32Array,
  weights: Float64Array, means: Float64Array, offsets: Uint32Array, neighbors: Uint32Array,
  volumeWeight: Scalar,
): void {
  destination.set(source);
  for (let pass = 0; pass < 16; pass++) {
    const step = (pass % 2 ? -.36 : .35) * volumeWeight;
    for (let j = 0; j < coords.length; j++) {
      let k = offsets[j];
      const end = offsets[j + 1];
      let x: Scalar = 0, y: Scalar = 0, z: Scalar = 0;
      // The common manifold vertex has six neighbours. Sum the first
      // four together and handle arbitrary remaining valence below.
      if (end - k >= 4) {
        const a = neighbors[k], b = neighbors[k + 1], c = neighbors[k + 2], d = neighbors[k + 3];
        x = (source[a] as Scalar) + source[b] + source[c] + source[d];
        y = (source[a + 1] as Scalar) + source[b + 1] + source[c + 1] + source[d + 1];
        z = (source[a + 2] as Scalar) + source[b + 2] + source[c + 2] + source[d + 2];
        k += 4;
      }
      for (; k < end; k++) {
        const coord = neighbors[k];
        x += source[coord]; y += source[coord + 1]; z += source[coord + 2];
      }
      const o = coords[j], w = step * weights[j], mean = means[j];
      destination[o] = (source[o] + (x * mean - source[o]) * w) as Float;
      destination[o + 1] = (source[o + 1] + (y * mean - source[o + 1]) * w) as Float;
      destination[o + 2] = (source[o + 2] + (z * mean - source[o + 2]) * w) as Float;
    }
    const previous = source;
    source = destination;
    destination = previous;
  }
}

export function blendPalm(
  linear: Float64Array, inverse: Float64Array, volume: Float64Array,
  bone: Float64Array, joints: Float64Array, blendVertices: Uint32Array,
  bones: Uint16Array, weights: Float32Array, rigid: Uint8Array,
): void {
  for (let g = 0; g < blendVertices.length; g++) {
    const vertex = blendVertices[g], influence = vertex * 4, m = g * 12;
    const reference = bones[influence] * 11;
    let qx: Scalar = 0, qy: Scalar = 0, qz: Scalar = 0, qw: Scalar = 0;
    let dx: Scalar = 0, dy: Scalar = 0, dz: Scalar = 0, dw: Scalar = 0, sx: Scalar = 0, sy: Scalar = 0, sz: Scalar = 0;
    for (let n = 0; n < 12; n++) linear[m+n] = 0;
    for (let k = 0; k < 4; k++) {
      const w = weights[influence+k] as Scalar;
      if (!w) continue;
      const index = bones[influence+k], offset = index * 12;
      for (let n = 0; n < 12; n++) linear[m+n] += w * bone[offset+n];
      if (rigid[vertex]) continue;
      const r = index * 11;
      const dot = joints[r]*joints[reference] + joints[r+1]*joints[reference+1]
        + joints[r+2]*joints[reference+2] + joints[r+3]*joints[reference+3];
      const signed = dot < 0 ? -w : w;
      qx += signed*joints[r]; qy += signed*joints[r+1];
      qz += signed*joints[r+2]; qw += signed*joints[r+3];
      dx += signed*joints[r+4]; dy += signed*joints[r+5];
      dz += signed*joints[r+6]; dw += signed*joints[r+7];
      sx += w*joints[r+8]; sy += w*joints[r+9]; sz += w*joints[r+10];
    }
    invertAffine(linear, inverse, m);
    if (rigid[vertex]) continue;
    // Matrix of the normalized dual quaternion. Both the quadratic
    // rotation terms and dual * conjugate(real) divide by |real|².
    const normSq = qx*qx + qy*qy + qz*qz + qw*qw, t = 2/normSq;
    const xx = t*qx*qx, yy = t*qy*qy, zz = t*qz*qz;
    const xy = t*qx*qy, xz = t*qx*qz, yz = t*qy*qz;
    const wx = t*qw*qx, wy = t*qw*qy, wz = t*qw*qz;
    const v = volume;
    v[m] = (1-yy-zz)*sx; v[m+1] = (xy-wz)*sy; v[m+2] = (xz+wy)*sz;
    v[m+4] = (xy+wz)*sx; v[m+5] = (1-xx-zz)*sy; v[m+6] = (yz-wx)*sz;
    v[m+8] = (xz-wy)*sx; v[m+9] = (yz+wx)*sy; v[m+10] = (1-xx-yy)*sz;
    v[m+3] = (dx*qw-dw*qx-dy*qz+dz*qy)/normSq;
    v[m+7] = (dy*qw-dw*qy-dz*qx+dx*qz)/normSq;
    v[m+11] = (dz*qw-dw*qz-dx*qy+dy*qx)/normSq;
  }
}

function invertAffine(matrix: Float64Array, out: Float64Array, m: Index): void {
  const a = matrix[m], b = matrix[m+1], c = matrix[m+2], x = matrix[m+3];
  const d = matrix[m+4], e = matrix[m+5], f = matrix[m+6], y = matrix[m+7];
  const g = matrix[m+8], h = matrix[m+9], i = matrix[m+10], z = matrix[m+11];
  const A = e*i-f*h, D = f*g-d*i, G = d*h-e*g;
  const det = a*A+b*D+c*G;
  if (!det) { out.fill(0, m, m+12); return; }
  const scale = 1/det;
  out[m] = A*scale; out[m+1] = (c*h-b*i)*scale; out[m+2] = (b*f-c*e)*scale;
  out[m+4] = D*scale; out[m+5] = (a*i-c*g)*scale; out[m+6] = (c*d-a*f)*scale;
  out[m+8] = G*scale; out[m+9] = (b*g-a*h)*scale; out[m+10] = (a*e-b*d)*scale;
  for (let row = m; row < m+12; row += 4) out[row+3] = -(out[row]*x+out[row+1]*y+out[row+2]*z);
}

export function projectPalm(
  positions: Float32Array, source: Float32Array, posed: Float32Array,
  linear: Float64Array, volume: Float64Array, blendOffsets: Uint32Array,
  volumeWeights: Float64Array, rigid: Uint8Array, weight: Scalar,
): void {
  for (let i = 0; i < blendOffsets.length; i++) {
    const m = blendOffsets[i], v = i * 3;
    // Match the Float32 rounding of a shape first stored in bind space.
    const w = weight * volumeWeights[i];
    const x: Scalar = Math.fround((positions[v] + ((source[v] as Scalar) - positions[v]) * w));
    const y: Scalar = Math.fround((positions[v+1] + ((source[v+1] as Scalar) - positions[v+1]) * w));
    const z: Scalar = Math.fround((positions[v+2] + ((source[v+2] as Scalar) - positions[v+2]) * w));
    const lx = linear[m]*x + linear[m+1]*y + linear[m+2]*z + linear[m+3];
    const ly = linear[m+4]*x + linear[m+5]*y + linear[m+6]*z + linear[m+7];
    const lz = linear[m+8]*x + linear[m+9]*y + linear[m+10]*z + linear[m+11];
    const amount = rigid[i] ? 0 : .8 * w;
    posed[v] = (lx + (volume[m]*x + volume[m+1]*y + volume[m+2]*z + volume[m+3] - lx) * amount) as Float;
    posed[v+1] = (ly + (volume[m+4]*x + volume[m+5]*y + volume[m+6]*z + volume[m+7] - ly) * amount) as Float;
    posed[v+2] = (lz + (volume[m+8]*x + volume[m+9]*y + volume[m+10]*z + volume[m+11] - lz) * amount) as Float;
  }
}

export function encodePalm(
  posed: Float32Array, posedNormals: Float32Array, positions: Float32Array, normals: Float32Array,
  inverse: Float64Array, blendOffsets: Uint32Array,
): void {
  for (let i = 0; i < blendOffsets.length; i++) {
    const m = blendOffsets[i], v = i * 3;
    const x = posed[v], y = posed[v+1], z = posed[v+2];
    positions[v] = (inverse[m]*x + inverse[m+1]*y + inverse[m+2]*z + inverse[m+3]) as Float;
    positions[v+1] = (inverse[m+4]*x + inverse[m+5]*y + inverse[m+6]*z + inverse[m+7]) as Float;
    positions[v+2] = (inverse[m+8]*x + inverse[m+9]*y + inverse[m+10]*z + inverse[m+11]) as Float;
    const nx = posedNormals[v], ny = posedNormals[v+1], nz = posedNormals[v+2];
    const bx = inverse[m]*nx + inverse[m+1]*ny + inverse[m+2]*nz;
    const by = inverse[m+4]*nx + inverse[m+5]*ny + inverse[m+6]*nz;
    const bz = inverse[m+8]*nx + inverse[m+9]*ny + inverse[m+10]*nz;
    const length = Math.sqrt(bx*bx + by*by + bz*bz) || 1;
    normals[v] = (bx/length) as Float;
    normals[v+1] = (by/length) as Float;
    normals[v+2] = (bz/length) as Float;
  }
}

// Corner offsets are in original face order. Round each accumulation to
// Float32 just as the JavaScript renderer does at a welded vertex.
export function accumulateNormals(
  positions: Float32Array, corners: Uint32Array, welded: Uint32Array, sum: Float32Array,
): void {
  sum.fill(0);
  for (let i = 0; i < corners.length; i += 3) {
    const a = corners[i] * 3, b = corners[i + 1] * 3, c = corners[i + 2] * 3;
    const ax = positions[a] as Scalar, ay = positions[a + 1] as Scalar, az = positions[a + 2] as Scalar;
    const bx = positions[b] - ax, by = positions[b + 1] - ay, bz = positions[b + 2] - az;
    const cx = positions[c] - ax, cy = positions[c + 1] - ay, cz = positions[c + 2] - az;
    const nx = by * cz - bz * cy, ny = bz * cx - bx * cz, nz = bx * cy - by * cx;
    for (let k = i; k < i + 3; k++) {
      const w = welded[corners[k]];
      sum[w] = (sum[w] + nx) as Float;
      sum[w + 1] = (sum[w + 1] + ny) as Float;
      sum[w + 2] = (sum[w + 2] + nz) as Float;
    }
  }
}

export function normalizeWeldedNormals(
  sum: Float32Array, groups: Uint32Array, vertices: Uint32Array,
  welded: Uint32Array, normals: Float32Array,
): void {
  for (let i = 0; i < groups.length; i++) {
    const w = groups[i];
    const x = sum[w] as Scalar, y = sum[w + 1] as Scalar, z = sum[w + 2] as Scalar;
    const len = Math.sqrt(x*x + y*y + z*z);
    if (len > 0) {
      sum[w] = (x / len) as Float;
      sum[w + 1] = (y / len) as Float;
      sum[w + 2] = (z / len) as Float;
    }
  }
  for (let i = 0; i < vertices.length; i++) {
    const vertex = vertices[i], w = welded[vertex];
    const x = sum[w], y = sum[w + 1], z = sum[w + 2];
    if (!x && !y && !z) continue;
    const offset = vertex * 3;
    normals[offset] = x;
    normals[offset + 1] = y;
    normals[offset + 2] = z;
  }
}
