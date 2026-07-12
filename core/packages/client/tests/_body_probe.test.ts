/**
 * SMPL-X onepiece 全身傀儡探针(默认 skip,CI 零成本):
 *   BODYPROBE=1 pnpm --filter @cuberoot/client exec vitest run tests/_body_probe.test.ts
 * ① CPU 蒙皮(applyBoneTransform)对比「原始几何 × 组变换」定位蒙皮管线偏差;
 * ② syncHands 重合性:傀儡手区(末节骨主导顶点)CPU 蒙皮后应与活手对应区域
 *    世界包络重合(H_j = Lfac·G_j·K_j 常量代数的落地检验)。
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as THREE from "three";
import { SmplxBody, type SmplxOnePieceData } from "@/app/[lang]/sim/engine/hands/smplxBody";
import { buildManoHand, type ManoHandData } from "@/app/[lang]/sim/engine/hands/handModelMano";

describe.skipIf(!process.env.BODYPROBE)("smplx onepiece body probe", () => {
  it("run", () => {
    const root = path.resolve(__dirname, "../public/sim/hands");
    const data = JSON.parse(fs.readFileSync(path.join(root, "smplx/onepiece.smplx.json"), "utf8")) as SmplxOnePieceData;
    const skin = new THREE.MeshPhysicalMaterial({ vertexColors: true });
    const right = buildManoHand(JSON.parse(fs.readFileSync(path.join(root, "mano/right.mano.json"), "utf8")) as ManoHandData, -1, skin);
    const left = buildManoHand(JSON.parse(fs.readFileSync(path.join(root, "mano/left.mano.json"), "utf8")) as ManoHandData, 1, skin);
    const body = new SmplxBody(data, { R: right, L: left });
    body.place(new THREE.Vector3(826, -444, 950), new THREE.Vector3(-826, -444, 950));
    body.updateMatrixWorld(true);
    body.syncHands();
    body.updateMatrixWorld(true);
    body.mesh.skeleton.update();

    const mesh = body.mesh;
    const pos = mesh.geometry.getAttribute("position");
    const si = mesh.geometry.getAttribute("skinIndex");
    const sw = mesh.geometry.getAttribute("skinWeight");
    const v = new THREE.Vector3();
    const raw = new THREE.Box3();
    const skinned = new THREE.Box3();
    // 手区判定:右手末节列(named 布局 right_index1=40 → distal=42 等)
    const distalCols = new Set([42, 45, 48, 51, 54]);
    const puppetTip = new THREE.Box3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const w = v.clone().applyMatrix4(mesh.matrixWorld);
      raw.expandByPoint(w);
      const s = mesh.applyBoneTransform(i, v.clone());
      s.applyMatrix4(mesh.matrixWorld);
      skinned.expandByPoint(s);
      let dom = 0, bw = -1;
      for (let k = 0; k < 4; k++) {
        const wt = sw.getComponent(i, k);
        if (wt > bw) { bw = wt; dom = si.getComponent(i, k); }
      }
      if (distalCols.has(dom)) puppetTip.expandByPoint(s);
    }
    // 活手对应包络:右手末节/端点骨主导皮肤顶点(活手 group 无父级 = 世界系)
    right.group.updateMatrixWorld(true);
    const lm = right.meshes[0] as THREE.SkinnedMesh;
    lm.skeleton.update();
    const lpos = lm.geometry.getAttribute("position");
    const lsi = lm.geometry.getAttribute("skinIndex");
    const lsw = lm.geometry.getAttribute("skinWeight");
    const names = lm.skeleton.bones.map((b) => b.name);
    const liveTip = new THREE.Box3();
    for (let i = 0; i < lpos.count; i++) {
      let dom = 0, bw = -1;
      for (let k = 0; k < 4; k++) {
        const wt = lsw.getComponent(i, k);
        if (wt > bw) { bw = wt; dom = lsi.getComponent(i, k); }
      }
      const nm = names[dom] ?? "";
      if (!/phalanx-distal$/.test(nm)) continue;
      const s = lm.applyBoneTransform(i, v.fromBufferAttribute(lpos, i).clone());
      s.applyMatrix4(lm.matrixWorld);
      liveTip.expandByPoint(s);
    }
    const f = (b: THREE.Box3): string =>
      `[${b.min.toArray().map((x) => x.toFixed(0)).join(",")}]..[${b.max.toArray().map((x) => x.toFixed(0)).join(",")}]`;
    const dMin = puppetTip.min.distanceTo(liveTip.min);
    const dMax = puppetTip.max.distanceTo(liveTip.max);
    const lines = [
      `raw bbox      ${f(raw)}`,
      `skinned bbox  ${f(skinned)}`,
      `puppet distal ${f(puppetTip)}`,
      `live   distal ${f(liveTip)}`,
      `distal bbox corner dev ${dMin.toFixed(2)} / ${dMax.toFixed(2)} (rig units)`,
    ];
    const out = process.env.BODYPROBE_OUT;
    if (out) fs.writeFileSync(out, lines.join("\n") + "\n");
    console.log(lines.join("\n"));
    // 傀儡末节包络与活手末节包络重合(容差 = posedirs/细分邻域差,毫米级;
    // rig 单位 ~3.7/mm → 8 rig units ≈ 2mm)
    expect(dMin).toBeLessThan(8);
    expect(dMax).toBeLessThan(8);
  });
});
