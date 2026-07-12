/**
 * SMPL-X 全身 rig 探针(默认 skip,CI 零成本):
 *   BODYPROBE=1 pnpm --filter @cuberoot/client exec vitest run tests/_body_probe.test.ts
 * CPU 蒙皮(applyBoneTransform)对比「原始几何 × 组变换」,定位蒙皮管线偏差。
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as THREE from "three";
import { SmplxBody, type SmplxBodyRigData } from "@/app/[lang]/sim/engine/hands/smplxBody";

describe.skipIf(!process.env.BODYPROBE)("smplx body probe", () => {
  it("run", () => {
    const p = path.resolve(__dirname, "../public/sim/hands/smplx/bodyrig.smplx.json");
    const data = JSON.parse(fs.readFileSync(p, "utf8")) as SmplxBodyRigData;
    const body = new SmplxBody(data, 3692.25);
    body.place(new THREE.Vector3(826, -444, 950), new THREE.Vector3(-826, -444, 950));
    body.updateMatrixWorld(true);
    const mesh = body.mesh;
    const pos = mesh.geometry.getAttribute("position");
    const v = new THREE.Vector3();
    const raw = new THREE.Box3();
    const skinned = new THREE.Box3();
    let maxDev = 0;
    let maxDevIdx = -1;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const w = v.clone().applyMatrix4(mesh.matrixWorld);
      raw.expandByPoint(w);
      const s = mesh.applyBoneTransform(i, v.clone());
      s.applyMatrix4(mesh.matrixWorld);
      skinned.expandByPoint(s);
      const d = s.distanceTo(w);
      if (d > maxDev) { maxDev = d; maxDevIdx = i; }
    }
    const f = (b: THREE.Box3): string =>
      `[${b.min.toArray().map((x) => x.toFixed(0)).join(",")}]..[${b.max.toArray().map((x) => x.toFixed(0)).join(",")}]`;
    const lines = [`raw bbox     ${f(raw)}`, `skinned bbox ${f(skinned)}`, `maxDev ${maxDev.toFixed(1)} at vert ${maxDevIdx}`];
    if (maxDevIdx >= 0) {
      const si = mesh.geometry.getAttribute("skinIndex");
      const sw = mesh.geometry.getAttribute("skinWeight");
      lines.push(`dev vert bones ${[0, 1, 2, 3].map((k) => `${si.getComponent(maxDevIdx, k)}:${sw.getComponent(maxDevIdx, k).toFixed(2)}`).join(" ")}`);
    }
    const out = process.env.BODYPROBE_OUT;
    if (out) fs.writeFileSync(out, lines.join("\n") + "\n");
    console.log(lines.join("\n"));
    expect(true).toBe(true);
  });
});
