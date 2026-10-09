'use client';

import { useEffect, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import Cube from '@/components/puzzle-models/nxn/cube';
import { TwistAction } from '@/components/puzzle-models/nxn/twister';
import type CubeGroup from '@/components/puzzle-models/nxn/group';
import { CUBE_FILL } from '@/lib/cube-colors';
import { COLORS } from '@cuberoot/puzzle-render-core/engine/define';
import { sampleTrack, teamVisuallySolved } from './_replay';
import type { CubeAgentRun } from '@cuberoot/shared/cube-agents';

interface Props {
  board: RefObject<HTMLDivElement | null>;
  elapsed: RefObject<number>;
  run: RefObject<CubeAgentRun | null>;
  onReady: () => void;
  onError: () => void;
}

/** One WebGL context for all eight views; geometry and moves come from /sim. */
export default function ReplayCanvas({ board, elapsed, run, onReady, onError }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvas.current || !board.current) return;
    const host = board.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas.current, alpha: true, antialias: true });
    } catch {
      onError();
      return;
    }
    renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio, 2), 2.5));
    renderer.setClearColor(0, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8;

    const groundGeometry = new THREE.PlaneGeometry(1400, 1400);
    const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.15 });
    const originalColors = { ...COLORS };
    // Muted display pigments derived from the site's canonical face palette.
    const faceColors = Object.fromEntries(Object.entries(CUBE_FILL).map(([face, color]) => [
      face, new THREE.Color(color).lerp(new THREE.Color(CUBE_FILL.U), face === 'U' ? 0 : 0.24)
        .lerp(new THREE.Color(COLORS.Core), face === 'U' ? 0 : 0.35).getStyle(),
    ])) as typeof CUBE_FILL;
    const views = [...host.querySelectorAll<HTMLElement>('[data-agent-viewport]')].map((element, index) => {
      const scene = new THREE.Scene();
      const cube = new Cube(2);
      cube.instancedRenderer.setFaceColors(faceColors);
      cube.instancedRenderer.setRawCore(true, faceColors, COLORS.Core, false);
      cube.traverse((object) => {
        if (object instanceof THREE.Mesh) object.castShadow = true;
      });
      scene.add(cube);
      const ground = new THREE.Mesh(groundGeometry, groundMaterial);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -97;
      ground.receiveShadow = true;
      scene.add(ground, new THREE.AmbientLight(0xffffff, 1.5));
      const light = new THREE.DirectionalLight(0xffffff, 2);
      light.position.set(-240, 500, 350);
      light.castShadow = true;
      light.shadow.mapSize.set(512, 512);
      Object.assign(light.shadow.camera, { left: -300, right: 300, top: 300, bottom: -300, near: 1, far: 1200 });
      light.shadow.bias = -0.002;
      light.shadow.normalBias = 1;
      scene.add(light);
      const camera = new THREE.OrthographicCamera(-200, 200, 180, -180, 1, 2000);
      camera.position.set(400, 320, 500);
      camera.lookAt(0, -12, 0);
      return { element, scene, cube, light, camera, team: Math.floor(index / 4), agent: index % 4,
        step: '', active: [] as { group: CubeGroup; angle: number }[] };
    });

    let frame = 0;
    let lastTime = -1;
    let lastLayout = '';
    let lastRun: CubeAgentRun | null = null;
    let lastSize = '';
    let visible = true;
    let lost = false;
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    observer.observe(host);
    const loseContext = (event: Event) => { event.preventDefault(); lost = true; onError(); };
    renderer.domElement.addEventListener('webglcontextlost', loseContext);

    const releaseTurn = (view: typeof views[number]) => {
      for (const { group } of view.active) { group.angle = 0; group.drop(); }
      view.active = [];
    };
    const draw = () => {
      frame = requestAnimationFrame(draw);
      if (!visible || document.hidden || lost) return;
      const bounds = host.getBoundingClientRect();
      const rectangles = views.map((view) => view.element.getBoundingClientRect());
      const layout = rectangles.map((rect) => `${rect.x},${rect.y},${rect.width},${rect.height}`).join(';');
      const time = elapsed.current;
      if (lastTime === time && lastLayout === layout && lastRun === run.current) return;
      lastTime = time;
      lastLayout = layout;
      lastRun = run.current;
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const size = `${bounds.width},${bounds.height}`;
      if (size !== lastSize) { renderer.setSize(bounds.width, bounds.height, false); lastSize = size; }
      renderer.setScissorTest(false);
      renderer.clear();
      renderer.setScissorTest(true);
      views.forEach((view, index) => {
        const team = run.current?.teams[view.team];
        if (team && teamVisuallySolved(run.current, view.team, time) && view.agent !== team.winner) return;
        const sample = sampleTrack(run.current, view.team, view.agent, time);
        if (sample.key !== view.step) {
          releaseTurn(view);
          view.cube.twister.setup(sample.prefix);
          view.step = sample.key;
          if (sample.move) {
            view.active = view.cube.table.convert(new TwistAction(sample.move)).map((turn) => {
              turn.group.drag();
              return { group: turn.group, angle: turn.twist * Math.PI / 2 };
            });
          }
        }
        for (const turn of view.active) turn.group.angle = turn.angle * sample.fraction;
        const rect = rectangles[index];
        const x = rect.left - bounds.left;
        const y = bounds.bottom - rect.bottom;
        const halfHeight = Math.max(168, 150 * rect.height / rect.width);
        view.camera.left = -halfHeight * rect.width / rect.height;
        view.camera.right = -view.camera.left;
        view.camera.top = halfHeight;
        view.camera.bottom = -halfHeight;
        view.camera.updateProjectionMatrix();
        renderer.setViewport(x, y, rect.width, rect.height);
        renderer.setScissor(x, y, rect.width, rect.height);
        renderer.render(view.scene, view.camera);
      });
    };
    draw();
    onReady();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', loseContext);
      for (const view of views) {
        releaseTurn(view);
        view.cube.dispose();
        view.light.shadow.map?.dispose();
      }
      groundGeometry.dispose();
      groundMaterial.dispose();
      Object.assign(COLORS, originalColors);
      renderer.dispose();
    };
  }, [board, elapsed, run, onReady, onError]);

  return <canvas ref={canvas} className="agents-canvas" aria-hidden="true" />;
}
