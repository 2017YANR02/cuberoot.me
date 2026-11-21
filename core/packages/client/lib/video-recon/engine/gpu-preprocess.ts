import { areaAxis, linearAxis } from "./preprocess";
import type { Transform } from "./detector";

const params = `
struct Params {
  source: vec2<u32>, view: vec2<u32>, inputSize: vec2<u32>,
  resized: vec2<u32>, pad: vec2<u32>, fast2: u32, unused: u32,
}
`;
const texturePixel = `
fn texturePixel(x: u32, y: u32) -> vec3<u32> {
  let rgba = vec4<u32>(round(textureLoad(image, vec2<i32>(i32(x), i32(y)), 0) * 255.0));
  if (rgba.a == 0u) { return vec3<u32>(0u); }
  if (rgba.a == 255u) { return rgba.rgb; }
  let numerator = rgba.rgb * 255u;
  let base = numerator / rgba.a;
  let remainder = (numerator % rgba.a) * 2u;
  let up = (remainder > vec3<u32>(rgba.a)) | ((remainder == vec3<u32>(rgba.a)) & ((base & vec3<u32>(1u)) != vec3<u32>(0u)));
  return min(base + select(vec3<u32>(0u), vec3<u32>(1u), up), vec3<u32>(255u));
}
`;
const horizontalShader =
  params +
  `
struct Tap { index: u32, weight: f32 }
@group(0) @binding(0) var image: texture_2d<f32>;
@group(0) @binding(1) var<uniform> p: Params;
@group(0) @binding(2) var<storage, read> offsets: array<u32>;
@group(0) @binding(3) var<storage, read> taps: array<Tap>;
@group(0) @binding(4) var<storage, read_write> horizontal: array<vec4<f32>>;
${texturePixel}
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= p.view.x || id.y >= p.source.y) { return; }
  var sum = vec3<f32>(0.0);
  for (var i = offsets[id.x]; i < offsets[id.x + 1u]; i++) {
    let rgb = vec3<f32>(texturePixel(taps[i].index, id.y));
    // The runtime-zero mask forces separate float32 multiply/add rounding;
    // compilers cannot fuse across an observable integer operation.
    let product = bitcast<vec3<f32>>(bitcast<vec3<u32>>(rgb * taps[i].weight) ^ vec3<u32>(p.unused));
    sum = bitcast<vec3<f32>>(bitcast<vec3<u32>>(sum + product) ^ vec3<u32>(p.unused));
  }
  horizontal[id.y * p.view.x + id.x] = vec4<f32>(sum, 0.0);
}
`;
const verticalShader =
  params +
  `
struct Tap { index: u32, weight: f32 }
@group(0) @binding(0) var<storage, read> horizontal: array<vec4<f32>>;
@group(0) @binding(1) var<uniform> p: Params;
@group(0) @binding(2) var<storage, read> offsets: array<u32>;
@group(0) @binding(3) var<storage, read> taps: array<Tap>;
@group(0) @binding(4) var<storage, read_write> pixels: array<vec4<u32>>;
fn roundEven(v: vec3<f32>) -> vec3<u32> {
  let base = vec3<u32>(floor(v));
  let fraction = v - floor(v);
  let up = (fraction > vec3<f32>(0.5)) | ((fraction == vec3<f32>(0.5)) & ((base & vec3<u32>(1u)) != vec3<u32>(0u)));
  return min(base + select(vec3<u32>(0u), vec3<u32>(1u), up), vec3<u32>(255u));
}
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= p.view.x || id.y >= p.view.y) { return; }
  var sum = vec3<f32>(0.0);
  for (var i = offsets[id.y]; i < offsets[id.y + 1u]; i++) {
    let product = bitcast<vec3<f32>>(bitcast<vec3<u32>>(horizontal[taps[i].index * p.view.x + id.x].rgb * taps[i].weight) ^ vec3<u32>(p.unused));
    sum = bitcast<vec3<f32>>(bitcast<vec3<u32>>(sum + product) ^ vec3<u32>(p.unused));
  }
  var rgb = roundEven(sum);
  // Preserve OpenCV's existing half-up rounding for the exact 2x case.
  // Crop dimensions are never snapped or changed to enter this case.
  if (p.fast2 != 0u) { rgb = min(vec3<u32>(floor(sum + 0.5)), vec3<u32>(255u)); }
  pixels[id.y * p.view.x + id.x] = vec4<u32>(rgb, 255u);
}
`;
function linearShader(textureSource: boolean) {
  return (
    params +
    `
${
  textureSource
    ? "@group(0) @binding(0) var image: texture_2d<f32>;"
    : "@group(0) @binding(0) var<storage, read> pixels: array<vec4<u32>>;"
}
@group(0) @binding(1) var<uniform> p: Params;
@group(0) @binding(2) var<storage, read> xs: array<vec4<u32>>;
@group(0) @binding(3) var<storage, read> ys: array<vec4<u32>>;
@group(0) @binding(4) var<storage, read> normalized: array<f32>;
@group(0) @binding(5) var<storage, read_write> output: array<f32>;
${textureSource ? texturePixel : ""}
fn pixel(x: u32, y: u32) -> vec3<u32> {
  ${
    textureSource
      ? "return texturePixel(x, y);"
      : "return pixels[y * p.view.x + x].rgb;"
  }
}
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= p.inputSize.x || id.y >= p.inputSize.y) { return; }
  var rgb = vec3<u32>(114u);
  if (all(id.xy >= p.pad) && all(id.xy < p.pad + p.resized)) {
    let xx = xs[id.x - p.pad.x]; let yy = ys[id.y - p.pad.y];
    let top = pixel(xx.x, yy.x) * xx.z + pixel(xx.y, yy.x) * xx.w;
    let bottom = pixel(xx.x, yy.y) * xx.z + pixel(xx.y, yy.y) * xx.w;
    // Integer arithmetic preserves the CPU's exact 11-bit fixed-point linear
    // interpolation and final 8-bit rounding without float32 precision loss.
    rgb = (top * yy.z + bottom * yy.w + vec3<u32>(2097152u)) >> vec3<u32>(22u);
  }
  let at = id.y * p.inputSize.x + id.x;
  let plane = p.inputSize.x * p.inputSize.y;
  // A 256-value LUT preserves Math.fround(byte / 255) exactly, independently
  // of GPU division/reciprocal accuracy. This writes NCHW directly for ORT.
  output[at] = normalized[rgb.r];
  output[plane + at] = normalized[rgb.g];
  output[plane * 2u + at] = normalized[rgb.b];
}
`
  );
}
interface AreaBuffers {
  offsets: GPUBuffer;
  taps: GPUBuffer;
}

/** Owns GPU resources; callers must not dispose ORT wrappers around inputBuffer. */
export class GpuPreprocessor {
  private texture?: GPUTexture;
  private textureWidth = 0;
  private textureHeight = 0;
  private horizontal?: GPUBuffer;
  private viewPixels?: GPUBuffer;
  private scratchShape = "";
  private input?: GPUBuffer;
  private inputBytes = 0;
  private readonly uniform: GPUBuffer;
  private readonly normalized: GPUBuffer;
  private readonly areaPlans = new Map<string, AreaBuffers>();
  private readonly linearPlans = new Map<string, GPUBuffer>();
  private constructor(
    private readonly device: GPUDevice,
    private readonly hPipeline: GPUComputePipeline,
    private readonly vPipeline: GPUComputePipeline,
    private readonly posePipeline: GPUComputePipeline,
    private readonly bboxPipeline: GPUComputePipeline,
  ) {
    this.uniform = device.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.normalized = this.upload(
      Float32Array.from({ length: 256 }, (_, i) => i / 255),
    );
  }
  static async create(device: GPUDevice) {
    const pipeline = (code: string) =>
      device.createComputePipelineAsync({
        layout: "auto",
        compute: {
          module: device.createShaderModule({ code }),
          entryPoint: "main",
        },
      });
    const [h, v, pose, bbox] = await Promise.all([
      pipeline(horizontalShader),
      pipeline(verticalShader),
      pipeline(linearShader(false)),
      pipeline(linearShader(true)),
    ]);
    return new GpuPreprocessor(device, h, v, pose, bbox);
  }
  private upload(data: Uint32Array | Float32Array) {
    const buffer = this.device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.STORAGE,
      mappedAtCreation: true,
    });
    new Uint8Array(buffer.getMappedRange()).set(
      new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    );
    buffer.unmap();
    return buffer;
  }
  private area(source: number, target: number) {
    const key = `${source}/${target}`;
    let plan = this.areaPlans.get(key);
    if (plan) {
      this.areaPlans.delete(key);
      this.areaPlans.set(key, plan);
      return plan;
    }
    const cpu = areaAxis(source, target);
    const packed = new Uint32Array(cpu.indices.length * 2),
      floats = new Float32Array(packed.buffer);
    for (let i = 0; i < cpu.indices.length; i++) {
      packed[i * 2] = cpu.indices[i];
      floats[i * 2 + 1] = cpu.weights[i];
    }
    plan = { offsets: this.upload(cpu.offsets), taps: this.upload(packed) };
    if (this.areaPlans.size === 32) {
      const oldest = this.areaPlans.keys().next().value!;
      const old = this.areaPlans.get(oldest)!;
      old.offsets.destroy();
      old.taps.destroy();
      this.areaPlans.delete(oldest);
    }
    this.areaPlans.set(key, plan);
    return plan;
  }
  private linear(source: number, target: number) {
    const key = `${source}/${target}`;
    let plan = this.linearPlans.get(key);
    if (plan) {
      this.linearPlans.delete(key);
      this.linearPlans.set(key, plan);
      return plan;
    }
    const cpu = linearAxis(source, target);
    const packed = new Uint32Array(target * 4);
    cpu.forEach((tap, i) => packed.set([tap.a, tap.b, tap.wa, tap.wb], i * 4));
    plan = this.upload(packed);
    if (this.linearPlans.size === 32) {
      const oldest = this.linearPlans.keys().next().value!;
      this.linearPlans.get(oldest)!.destroy();
      this.linearPlans.delete(oldest);
    }
    this.linearPlans.set(key, plan);
    return plan;
  }
  prepare(bitmap: ImageBitmap, t: Transform, viewSize?: number) {
    const { device } = this;
    const width = t.cropWidth,
      height = t.cropHeight;
    if (width !== this.textureWidth || height !== this.textureHeight) {
      this.texture?.destroy();
      this.texture = device.createTexture({
        size: [width, height],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.RENDER_ATTACHMENT,
      });
      this.textureWidth = width;
      this.textureHeight = height;
    }
    device.queue.copyExternalImageToTexture(
      { source: bitmap, origin: [t.cropX, t.cropY], flipY: false },
      { texture: this.texture!, premultipliedAlpha: true, colorSpace: "srgb" },
      [width, height],
    );
    const isPose = viewSize !== undefined;
    const vw = viewSize ?? width,
      vh = viewSize ?? height;
    const rw = isPose ? t.inputWidth : t.resizedWidth,
      rh = isPose ? t.inputHeight : t.resizedHeight;
    const inputBytes = t.inputWidth * t.inputHeight * 3 * 4;
    if (inputBytes !== this.inputBytes) {
      this.input?.destroy();
      this.input = device.createBuffer({
        size: inputBytes,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      });
      this.inputBytes = inputBytes;
    }
    device.queue.writeBuffer(
      this.uniform,
      0,
      new Uint32Array([
        width,
        height,
        vw,
        vh,
        t.inputWidth,
        t.inputHeight,
        rw,
        rh,
        isPose ? 0 : t.padX,
        isPose ? 0 : t.padY,
        width === vw * 2 && height === vh * 2 ? 1 : 0,
        0,
      ]),
    );
    const encoder = device.createCommandEncoder();
    const execute = (
      pipeline: GPUComputePipeline,
      resources: GPUBindingResource[],
      w: number,
      h: number,
    ) => {
      const group = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: resources.map((resource, binding) => ({ binding, resource })),
      });
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, group);
      pass.dispatchWorkgroups(Math.ceil(w / 8), Math.ceil(h / 8));
      pass.end();
    };
    if (isPose) {
      const bytes = vw * height * 16;
      const shape = `${vw}/${vh}/${height}`;
      if (shape !== this.scratchShape) {
        this.horizontal?.destroy();
        this.viewPixels?.destroy();
        this.horizontal = device.createBuffer({
          size: bytes,
          usage: GPUBufferUsage.STORAGE,
        });
        this.viewPixels = device.createBuffer({
          size: vw * vh * 16,
          usage: GPUBufferUsage.STORAGE,
        });
        this.scratchShape = shape;
      }
      const xs = this.area(width, vw),
        ys = this.area(height, vh);
      execute(
        this.hPipeline,
        [
          this.texture!.createView(),
          { buffer: this.uniform },
          { buffer: xs.offsets },
          { buffer: xs.taps },
          { buffer: this.horizontal! },
        ],
        vw,
        height,
      );
      execute(
        this.vPipeline,
        [
          { buffer: this.horizontal! },
          { buffer: this.uniform },
          { buffer: ys.offsets },
          { buffer: ys.taps },
          { buffer: this.viewPixels! },
        ],
        vw,
        vh,
      );
    }
    execute(
      isPose ? this.posePipeline : this.bboxPipeline,
      [
        isPose ? { buffer: this.viewPixels! } : this.texture!.createView(),
        { buffer: this.uniform },
        { buffer: this.linear(vw, rw) },
        { buffer: this.linear(vh, rh) },
        { buffer: this.normalized },
        { buffer: this.input! },
      ],
      t.inputWidth,
      t.inputHeight,
    );
    device.queue.submit([encoder.finish()]);
    return { buffer: this.input!, dims: [1, 3, t.inputHeight, t.inputWidth] };
  }
  dispose() {
    this.texture?.destroy();
    this.horizontal?.destroy();
    this.viewPixels?.destroy();
    this.input?.destroy();
    this.uniform.destroy();
    this.normalized.destroy();
    for (const p of this.areaPlans.values()) {
      p.offsets.destroy();
      p.taps.destroy();
    }
    for (const p of this.linearPlans.values()) p.destroy();
    this.areaPlans.clear();
    this.linearPlans.clear();
  }
}
