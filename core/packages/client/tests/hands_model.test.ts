/**
 * /sim 手部模型 — 指骨网格挂点回归。
 * 锁死「骨段网格跨 [0,len] 挂在当前关节系」:v1 曾把网格塞进下一关节组(它再被
 * 挪到 x=len),骨段渲染在 [len,1.5len] —— 掌指关节到第一节之间一段真空(用户
 * 两次报「手指与手心断开/被分割」的真凶),而关节链数学一直正确、指尖接触不露馅。
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildHand } from '@/app/[lang]/sim/engine/hands/handModel';

describe('buildHand 指骨网格挂点', () => {
  it('伸直手指时,三段胶囊网格中心依次位于 l1/2、l1+l2/2、l1+l2+l3/2(root 系)', () => {
    const skin = new THREE.MeshStandardMaterial();
    const nail = new THREE.MeshStandardMaterial();
    const hand = buildHand(1, skin, nail);
    for (const name of ['index', 'middle', 'ring', 'pinky', 'thumb'] as const) {
      const f = hand.fingers[name];
      // 伸直:三关节全部归零(root 关节含拇指对掌基座,直接置 identity 即
      // 「root 系下伸直」,基座只是整链刚体旋转,不影响链内相对位置)。
      f.root.quaternion.identity();
      f.mid.rotation.set(0, 0, 0);
      f.tip.rotation.set(0, 0, 0);
      f.root.updateMatrixWorld(true);
      const [l1, l2, l3] = f.segLens;
      const expected = [l1 / 2, l1 + l2 / 2, l1 + l2 + l3 / 2];
      const centers: number[] = [];
      const rootInv = f.root.matrixWorld.clone().invert();
      f.root.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry.type === 'CapsuleGeometry') {
          const p = new THREE.Vector3().setFromMatrixPosition((o as THREE.Mesh).matrixWorld).applyMatrix4(rootInv);
          centers.push(p.x);
          // 骨段轴线上,无侧向偏移
          expect(Math.abs(p.y)).toBeLessThan(1e-6);
          expect(Math.abs(p.z)).toBeLessThan(1e-6);
        }
      });
      expect(centers.length).toBe(3);
      centers.sort((a, b) => a - b);
      for (let i = 0; i < 3; i++) {
        expect(Math.abs(centers[i] - expected[i])).toBeLessThan(1e-6);
      }
      // 相邻段首尾相接:关节原点间距 = 骨长(链条不散)
      const rootW = new THREE.Vector3().setFromMatrixPosition(f.root.matrixWorld);
      const midW = new THREE.Vector3().setFromMatrixPosition(f.mid.matrixWorld);
      const tipW = new THREE.Vector3().setFromMatrixPosition(f.tip.matrixWorld);
      expect(Math.abs(rootW.distanceTo(midW) - l1)).toBeLessThan(1e-6);
      expect(Math.abs(midW.distanceTo(tipW) - l2)).toBeLessThan(1e-6);
    }
  });
});
