import { loadCpuFitter, type OpenCvModule } from "../pose-fitter/runtime/wasm-host.mjs";

let engine: Awaited<ReturnType<typeof loadCpuFitter>>;
let fingerprint = "";
let pipelineAssets:Record<string,string>;
self.onmessage = async ({ data }: MessageEvent<
  | { type: "init"; baseUrl: string }
  | { type: "job"; id: number; job: Record<string, unknown> }
>) => {
  try {
    if (data.type === "init") {
      const base = new URL("pose/", data.baseUrl);
      const response = await fetch(new URL("pipeline.json", base), { cache: "no-store" });
      if (!response.ok) throw new Error("The complete CPU pose pipeline is missing. Build it using web/README.md.");
      const manifest = await response.json();
      if (manifest.engine !== "cpu_pipeline_v1") throw new Error("Unsupported pose pipeline version");
      const [binary, geometry, cvBinary, module] = await Promise.all([
        fetch(new URL(manifest.rust, base)), fetch(new URL(manifest.geometry, base)),
        fetch(new URL(manifest.opencvWasm, base)),
        import(/* @vite-ignore */ new URL(manifest.opencvModule, base).href),
      ]);
      if (!binary.ok || !geometry.ok || !cvBinary.ok) throw new Error("CPU pose files are incomplete. Run npm run sync:runtime.");
      const cv = await module.default({ wasmBinary: await cvBinary.arrayBuffer(),
        locateFile: (path: string) => new URL(path.endsWith(".wasm") ? manifest.opencvWasm : path, base).href,
      }) as OpenCvModule;
      const fixture = new TextEncoder().encode(JSON.stringify({ geometry: await geometry.json(), workloads: [], probes: [] }));
      engine = await loadCpuFitter(await binary.arrayBuffer(), fixture, cv);
      fingerprint = manifest.rust;
      pipelineAssets={rust:manifest.rust,geometry:manifest.geometry,opencvWasm:manifest.opencvWasm,opencvModule:manifest.opencvModule};
      self.postMessage({ type: "ready", engine: manifest.engine, fingerprint });
    } else {
      const start = performance.now();
      const result = engine.call("pipeline_job_json", data.job);
      self.postMessage({ type: "result", id: data.id,
        result: { ...result, elapsedMs: performance.now() - start, pipelineVersion: fingerprint,pipelineAssets } });
    }
  } catch (error) {
    const stage = data.type === 'job' ? String(data.job.type ?? 'job') : 'initialization';
    self.postMessage({ type: "error", id: data.type === "job" ? data.id : undefined,
      message: `CPU pose ${stage}: ${error instanceof Error ? error.message : String(error)}` });
  }
};
