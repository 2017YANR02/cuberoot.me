import { paddedPixels, posePixels, resizeLinear } from "./preprocess";
import type * as Ort from "onnxruntime-web";
import { wasmThreadCount } from "./runtime-config";
let ort: typeof import("onnxruntime-web");
import {
  decode,
  decodeCube,
  letterbox,
  rgbaToChw,
  RoiTracker,
  roiTransform,
} from "./detector";
import type {
  FrameResult,
  StageTimings,
  FrameProfile,
  ModelManifest,
  ModelVariant,
  Transform,
  WorkerRequest,
  WorkerResponse,
} from "./detector";

const scope = self as unknown as {
  onmessage: (event: MessageEvent<WorkerRequest>) => void;
  postMessage: (message: WorkerResponse) => void;
};
interface Stage {
  identity:{file:string;size:number;bytes:number;sha256:string};
  session: Ort.InferenceSession;
  variant: ModelVariant;
  canvas: OffscreenCanvas;
  context: OffscreenCanvasRenderingContext2D;
  gpu?: import("./gpu-preprocess").GpuPreprocessor;
  gpuBuffer?: GPUBuffer;
  gpuTensor?: Ort.Tensor;
  gpuShape?: string;
}
let pose: Stage | undefined;
let bbox: Stage | undefined;
let manifest: ModelManifest;
let backend: "webgpu" | "wasm" = "webgpu";
let preprocessing: "cpu" | "gpu" = "cpu";
let frameWidth = 0,
  frameHeight = 0;
const tracker = new RoiTracker();
const send = (message: WorkerResponse) => scope.postMessage(message);

async function download(
  url: string,
  expectedBytes: number,
  stage: string,
): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(
      `Model download failed (${response.status}). Add the detector files described in web/README.md.`,
    );
  if (!response.body) return new Uint8Array(await response.arrayBuffer());
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  const total = Number(response.headers.get("content-length")) || expectedBytes;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    send({ type: "progress", fraction: Math.min(1, received / total), stage });
  }
  const result = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

async function loadStage(
  baseUrl: string,
  variant: ModelVariant,
  label: string,
): Promise<Stage> {
  const bytes = await download(
    new URL(`models/${variant.file}`, baseUrl).href,
    variant.bytes,
    label,
  );
  const digest=crypto.subtle.digest('SHA-256',bytes.buffer as ArrayBuffer);
  const session = await ort.InferenceSession.create(bytes, {
    executionProviders: [backend],
    graphOptimizationLevel: "all",
  });
  const canvas = new OffscreenCanvas(variant.size, variant.size);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context)
    throw new Error(
      "This browser does not support offscreen image processing.",
    );
  const input = new ort.Tensor(
    "float32",
    new Float32Array(3 * variant.size ** 2),
    [1, 3, variant.size, variant.size],
  );
  try {
    // Warm the CPU kernels before reporting per-frame times, matching the
    // benchmark's steady-state comparison rather than exposing initial JIT cost.
    for (let pass = 0; pass < (backend === "wasm" ? 3 : 1); pass++) {
      const outputs = await session.run({ [variant.inputName]: input });
      Object.values(outputs).forEach((tensor) => tensor.dispose());
    }
  } finally {
    input.dispose();
  }
  const gpu =
    preprocessing === "gpu"
      ? await (
          await import("./gpu-preprocess")
        ).GpuPreprocessor.create(await ort.env.webgpu.device)
      : undefined;
  const identity={file:variant.file,size:variant.size,bytes:bytes.length,
    sha256:[...new Uint8Array(await digest)].map(v=>v.toString(16).padStart(2,'0')).join('')};
  return { session, variant, canvas, context, gpu,identity };
}

async function runStage(
  stage: Stage,
  bitmap: ImageBitmap,
  t: Transform,
  preserveAlpha = false,
) {
  const gpu = preserveAlpha ? undefined : stage.gpu;
  const profile: StageTimings = {
    preprocessing: gpu ? "gpu" : "cpu",
    gpuSubmitMs: 0,
    pixelReadMs: 0,
    resizeMs: 0,
    tensorMs: 0,
    inferenceMs: 0,
    copyCleanupMs: 0,
  };
  let mark = performance.now();
  const { variant } = stage;
  let input: Ort.Tensor;
  if (gpu) {
    const prepared = gpu.prepare(
      bitmap,
      t,
      stage === pose ? manifest.viewSize : undefined,
    );
    profile.gpuSubmitMs = performance.now() - mark;
    mark = performance.now();
    const shape = prepared.dims.join(",");
    if (stage.gpuBuffer !== prepared.buffer || stage.gpuShape !== shape) {
      stage.gpuBuffer = prepared.buffer;
      stage.gpuShape = shape;
      stage.gpuTensor = ort.Tensor.fromGpuBuffer(prepared.buffer, {
        dataType: "float32",
        dims: prepared.dims,
      });
    }
    input = stage.gpuTensor!;
    profile.tensorMs = performance.now() - mark;
  } else {
    const { context, canvas } = stage;
    // Crop at native pixel resolution. Resizing is explicit and tested against
    // the renderer's OpenCV kernels, rather than browser-dependent drawImage scaling.
    canvas.width = t.cropWidth;
    canvas.height = t.cropHeight;
    context.drawImage(
      bitmap,
      t.cropX,
      t.cropY,
      t.cropWidth,
      t.cropHeight,
      0,
      0,
      t.cropWidth,
      t.cropHeight,
    );
    const source = context.getImageData(0, 0, t.cropWidth, t.cropHeight).data;
    profile.pixelReadMs = performance.now() - mark;
    mark = performance.now();
    const pixels =
      stage === pose
        ? posePixels(
            source,
            t.cropWidth,
            t.cropHeight,
            manifest.viewSize,
            variant.size,
          )
        : paddedPixels(
            resizeLinear(
              source,
              t.cropWidth,
              t.cropHeight,
              t.resizedWidth,
              t.resizedHeight,
            ),
            t.resizedWidth,
            t.resizedHeight,
            t.inputWidth,
            t.inputHeight,
            t.padX,
            t.padY,
          );
    profile.resizeMs = performance.now() - mark;
    mark = performance.now();
    input = new ort.Tensor("float32", rgbaToChw(pixels), [
      1,
      3,
      t.inputHeight,
      t.inputWidth,
    ]);
    profile.tensorMs = performance.now() - mark;
  }
  let outputs: Ort.InferenceSession.ReturnType | undefined;
  let resultData: Float32Array;
  let dims: readonly number[];
  try {
    mark = performance.now();
    outputs = await stage.session.run({ [variant.inputName]: input });
    profile.inferenceMs = performance.now() - mark;
    mark = performance.now();
    const tensor = outputs[variant.outputName];
    resultData = (tensor.data as Float32Array).slice();
    dims = tensor.dims;
    profile.copyCleanupMs = performance.now() - mark;
  } finally {
    mark = performance.now();
    // The preprocessor owns GPU buffers; ORT wrappers must not dispose them.
    if (!gpu) input.dispose();
    if (outputs) Object.values(outputs).forEach((tensor) => tensor.dispose());
    profile.copyCleanupMs += performance.now() - mark;
  }
  return { data: resultData!, dims: dims!, ms: profile.inferenceMs, profile };
}

scope.onmessage = async ({ data }) => {
  try {
    if (data.type === "init") {
      manifest = data.manifest;
      backend = data.backend;
      preprocessing =
        data.preprocessing ?? (backend === "webgpu" ? "gpu" : "cpu");
      if (backend !== "webgpu" && preprocessing === "gpu")
        throw new Error("GPU preprocessing requires the WebGPU backend.");
      // Load only one runtime per worker. The CPU-only build avoids the WebGPU
      // Asyncify runtime and uses the dedicated SIMD/pthread WASM binary.
      ort =
        backend === "wasm"
          ? await import("onnxruntime-web/wasm")
          : await import("onnxruntime-web/webgpu");
      const variant = manifest.variants.find((item) => item.size === data.size);
      if (!variant)
        throw new Error("This pose input size has not been exported.");
      ort.env.wasm.wasmPaths = new URL("runtime/", data.baseUrl).href;
      ort.env.wasm.numThreads = wasmThreadCount(
        backend,
        self.crossOriginIsolated,
        navigator.hardwareConcurrency,
      );
      bbox = await loadStage(data.baseUrl, manifest.bbox, "Cube detector");
      pose = await loadStage(data.baseUrl, variant, "Pose detector");
      tracker.reset();
      send({
        type: "ready",
        threads: ort.env.wasm.numThreads ?? 1,
        isolated: self.crossOriginIsolated,
        preprocessing,
        models:{pose:pose.identity,bbox:bbox.identity},
      });
      return;
    }
    if (!pose || !bbox) throw new Error("The detectors are still loading.");
    const inputCrop = data.crop ? {...data.crop, sourceWidth: data.bitmap.width, sourceHeight: data.bitmap.height} : undefined;
    if (data.crop) {
      const original = data.bitmap;
      data.bitmap = await createImageBitmap(original, data.crop.x, data.crop.y, data.crop.width, data.crop.height);
      original.close();
    }
    const start = performance.now();
    const profile: FrameProfile = {
      bbox: null,
      pose: null,
      bboxDecodeMs: 0,
      poseDecodeMs: 0,
      trackingDecodeMs: 0,
      roiUpdateMs: 0,
      nonInferenceMs: 0,
      otherMs: 0,
    };
    const { bitmap, settings } = data;
    const width = bitmap.width,
      height = bitmap.height;
    if (data.resetTracking || width !== frameWidth || height !== frameHeight)
      tracker.reset();
    frameWidth = width;
    frameHeight = height;
    let roiSource: FrameResult["roiSource"] = tracker.roi ? "tracker" : "none";
    let bboxMs: number | null = null;
    // The full-frame detector runs only to acquire/reacquire, never on a healthy tracked frame.
    if (!tracker.roi) {
      const t = letterbox(
        width,
        height,
        bbox.variant.size,
        false,
        manifest.bbox.rect ? manifest.bbox.stride : 0,
      );
      const output = await runStage(bbox, bitmap, t, data.preserveAlpha);
      bboxMs = output.ms;
      profile.bbox = output.profile;
      const decodeStart = performance.now();
      const cube = decodeCube(
        output.data,
        output.dims,
        t,
        settings.bboxThreshold,
      );
      if (cube) {
        tracker.initialize(cube, width, height, settings.roiPadding);
        roiSource = "detector";
      }
      profile.bboxDecodeMs = performance.now() - decodeStart;
    }
    const roi = tracker.roi
      ? ([...tracker.roi] as [number, number, number, number])
      : null;
    const cube = tracker.cube;
    const transform = roi
      ? roiTransform(width, height, pose.variant.size, roi)
      : letterbox(width, height, pose.variant.size, false);
    let detections: FrameResult["detections"] = [];
    let poseMs: number | null = null;
    let trackingLost = false;
    if (roi) {
      const output = await runStage(
        pose,
        bitmap,
        transform,
        data.preserveAlpha,
      );
      poseMs = output.ms;
      profile.pose = output.profile;
      let postStart = performance.now();
      detections = decode(
        output.data,
        output.dims,
        transform,
        manifest,
        settings,
      );
      profile.poseDecodeMs = performance.now() - postStart;
      postStart = performance.now();
      // Renderer tracking has its own presence filter, separate from display filtering.
      const trackingPoints = decode(
        output.data,
        output.dims,
        transform,
        manifest,
        { ...settings, presenceThreshold: manifest.tracking.presenceThreshold },
      );
      profile.trackingDecodeMs = performance.now() - postStart;
      postStart = performance.now();
      tracker.observe(
        trackingPoints,
        width,
        height,
        manifest.tracking.gain,
        manifest.tracking.padding,
      );
      profile.roiUpdateMs = performance.now() - postStart;
      trackingLost = tracker.roi === null;
    }
    const totalMs = performance.now() - start;
    profile.nonInferenceMs = totalMs - (bboxMs ?? 0) - (poseMs ?? 0);
    const stageOverhead = [profile.bbox, profile.pose].reduce(
      (sum, t) =>
        sum +
        (t
          ? t.pixelReadMs +
            t.resizeMs +
            t.tensorMs +
            t.copyCleanupMs +
            (t.gpuSubmitMs ?? 0)
          : 0),
      0,
    );
    profile.otherMs = Math.max(
      0,
      profile.nonInferenceMs -
        stageOverhead -
        profile.bboxDecodeMs -
        profile.poseDecodeMs -
        profile.trackingDecodeMs -
        profile.roiUpdateMs,
    );
    send({
      type: "result",
      result: {
        inputCrop,
        detectorHashes:{pose:pose.identity.sha256,bbox:bbox.identity.sha256},
        detections,
        transform,
        cube,
        roi,
        roiSource,
        trackingLost,
        bboxMs,
        poseMs,
        inferenceMs: (bboxMs ?? 0) + (poseMs ?? 0),
        totalMs,
        profile,
      },
    });
  } catch (error) {
    send({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    if (data.type === "frame") data.bitmap.close();
  }
};
