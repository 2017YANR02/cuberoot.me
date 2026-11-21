import{a as A,l as G}from"./inference.worker-DOLaQPiC.js";const x=`
struct Params {
  source: vec2<u32>, view: vec2<u32>, inputSize: vec2<u32>,
  resized: vec2<u32>, pad: vec2<u32>, fast2: u32, unused: u32,
}
`,w=`
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
`,_=x+`
struct Tap { index: u32, weight: f32 }
@group(0) @binding(0) var image: texture_2d<f32>;
@group(0) @binding(1) var<uniform> p: Params;
@group(0) @binding(2) var<storage, read> offsets: array<u32>;
@group(0) @binding(3) var<storage, read> taps: array<Tap>;
@group(0) @binding(4) var<storage, read_write> horizontal: array<vec4<f32>>;
${w}
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
`,S=x+`
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
`;function P(h){return x+`
${h?"@group(0) @binding(0) var image: texture_2d<f32>;":"@group(0) @binding(0) var<storage, read> pixels: array<vec4<u32>>;"}
@group(0) @binding(1) var<uniform> p: Params;
@group(0) @binding(2) var<storage, read> xs: array<vec4<u32>>;
@group(0) @binding(3) var<storage, read> ys: array<vec4<u32>>;
@group(0) @binding(4) var<storage, read> normalized: array<f32>;
@group(0) @binding(5) var<storage, read_write> output: array<f32>;
${h?w:""}
fn pixel(x: u32, y: u32) -> vec3<u32> {
  ${h?"return texturePixel(x, y);":"return pixels[y * p.view.x + x].rgb;"}
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
`}class z{constructor(i,e,u,t,n){this.device=i,this.hPipeline=e,this.vPipeline=u,this.posePipeline=t,this.bboxPipeline=n,this.uniform=i.createBuffer({size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.normalized=this.upload(Float32Array.from({length:256},(r,a)=>a/255))}texture;textureWidth=0;textureHeight=0;horizontal;viewPixels;scratchShape="";input;inputBytes=0;uniform;normalized;areaPlans=new Map;linearPlans=new Map;static async create(i){const e=a=>i.createComputePipelineAsync({layout:"auto",compute:{module:i.createShaderModule({code:a}),entryPoint:"main"}}),[u,t,n,r]=await Promise.all([e(_),e(S),e(P(!1)),e(P(!0))]);return new z(i,u,t,n,r)}upload(i){const e=this.device.createBuffer({size:i.byteLength,usage:GPUBufferUsage.STORAGE,mappedAtCreation:!0});return new Uint8Array(e.getMappedRange()).set(new Uint8Array(i.buffer,i.byteOffset,i.byteLength)),e.unmap(),e}area(i,e){const u=`${i}/${e}`;let t=this.areaPlans.get(u);if(t)return this.areaPlans.delete(u),this.areaPlans.set(u,t),t;const n=A(i,e),r=new Uint32Array(n.indices.length*2),a=new Float32Array(r.buffer);for(let s=0;s<n.indices.length;s++)r[s*2]=n.indices[s],a[s*2+1]=n.weights[s];if(t={offsets:this.upload(n.offsets),taps:this.upload(r)},this.areaPlans.size===32){const s=this.areaPlans.keys().next().value,o=this.areaPlans.get(s);o.offsets.destroy(),o.taps.destroy(),this.areaPlans.delete(s)}return this.areaPlans.set(u,t),t}linear(i,e){const u=`${i}/${e}`;let t=this.linearPlans.get(u);if(t)return this.linearPlans.delete(u),this.linearPlans.set(u,t),t;const n=G(i,e),r=new Uint32Array(e*4);if(n.forEach((a,s)=>r.set([a.a,a.b,a.wa,a.wb],s*4)),t=this.upload(r),this.linearPlans.size===32){const a=this.linearPlans.keys().next().value;this.linearPlans.get(a).destroy(),this.linearPlans.delete(a)}return this.linearPlans.set(u,t),t}prepare(i,e,u){const{device:t}=this,n=e.cropWidth,r=e.cropHeight;(n!==this.textureWidth||r!==this.textureHeight)&&(this.texture?.destroy(),this.texture=t.createTexture({size:[n,r],format:"rgba8unorm",usage:GPUTextureUsage.COPY_DST|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.RENDER_ATTACHMENT}),this.textureWidth=n,this.textureHeight=r),t.queue.copyExternalImageToTexture({source:i,origin:[e.cropX,e.cropY],flipY:!1},{texture:this.texture,premultipliedAlpha:!0,colorSpace:"srgb"},[n,r]);const a=u!==void 0,s=u??n,o=u??r,b=a?e.inputWidth:e.resizedWidth,y=a?e.inputHeight:e.resizedHeight,g=e.inputWidth*e.inputHeight*3*4;g!==this.inputBytes&&(this.input?.destroy(),this.input=t.createBuffer({size:g,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),this.inputBytes=g),t.queue.writeBuffer(this.uniform,0,new Uint32Array([n,r,s,o,e.inputWidth,e.inputHeight,b,y,a?0:e.padX,a?0:e.padY,n===s*2&&r===o*2?1:0,0]));const m=t.createCommandEncoder(),v=(p,l,c,f)=>{const U=t.createBindGroup({layout:p.getBindGroupLayout(0),entries:l.map((T,B)=>({binding:B,resource:T}))}),d=m.beginComputePass();d.setPipeline(p),d.setBindGroup(0,U),d.dispatchWorkgroups(Math.ceil(c/8),Math.ceil(f/8)),d.end()};if(a){const p=s*r*16,l=`${s}/${o}/${r}`;l!==this.scratchShape&&(this.horizontal?.destroy(),this.viewPixels?.destroy(),this.horizontal=t.createBuffer({size:p,usage:GPUBufferUsage.STORAGE}),this.viewPixels=t.createBuffer({size:s*o*16,usage:GPUBufferUsage.STORAGE}),this.scratchShape=l);const c=this.area(n,s),f=this.area(r,o);v(this.hPipeline,[this.texture.createView(),{buffer:this.uniform},{buffer:c.offsets},{buffer:c.taps},{buffer:this.horizontal}],s,r),v(this.vPipeline,[{buffer:this.horizontal},{buffer:this.uniform},{buffer:f.offsets},{buffer:f.taps},{buffer:this.viewPixels}],s,o)}return v(a?this.posePipeline:this.bboxPipeline,[a?{buffer:this.viewPixels}:this.texture.createView(),{buffer:this.uniform},{buffer:this.linear(s,b)},{buffer:this.linear(o,y)},{buffer:this.normalized},{buffer:this.input}],e.inputWidth,e.inputHeight),t.queue.submit([m.finish()]),{buffer:this.input,dims:[1,3,e.inputHeight,e.inputWidth]}}dispose(){this.texture?.destroy(),this.horizontal?.destroy(),this.viewPixels?.destroy(),this.input?.destroy(),this.uniform.destroy(),this.normalized.destroy();for(const i of this.areaPlans.values())i.offsets.destroy(),i.taps.destroy();for(const i of this.linearPlans.values())i.destroy();this.areaPlans.clear(),this.linearPlans.clear()}}export{z as GpuPreprocessor};
