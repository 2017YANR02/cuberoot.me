// HTML overlay 版的 face-orientation hints — 给 cubing.js TwistyPlayer 用。
// 不能像 sim/cuber/face_hints.ts 那样注入 sprite 到 scene 里(closed shadow
// DOM,renderer 拿不到),只能在 player 容器外面叠一层 absolute DOM。
//
// 投影自家算:订阅 player.experimentalModel.twistySceneModel.orbitCoordinates
// 拿 {lat, lon, dist},手算 view 矩阵 + 透视除法 → host 像素坐标。
//
// fov 默认假设 50°(cubing.js 用 three.js PerspectiveCamera 默认值)。

export type FaceTable = readonly { letter: string; normal: readonly [number, number, number] }[];

interface Orbit { latitude: number; longitude: number; distance: number; }

export interface FaceOverlayOptions {
  /** true = 字母按屏幕方位自动 re-assign:visible 第 1 letter 给最高,剩下按 x asc → 第 2/3。
   *  剩余 letter 落到 back face(隐藏)。pyraminx / skewb 用:整体转后 letter 不跟 piece。 */
  screenSlot?: boolean;
  /** screenSlot mode 下,前几个 slot 算"可见"(剩下当 back 隐藏)。
   *  pyraminx 4 vertex → 默认 3 (slotLetters.length - 1)。
   *  skewb 6 面 → 必须显式 3 (corner-on view 看到 3 面)。 */
  visibleSlotCount?: number;
}

const LABEL_RADIUS = 1.5;
const FADE_MS = 200;
const FOV_DEG = 50;
const BACKFACE_EPS = 0.0;

export default class FaceOverlay {
  private host: HTMLElement;
  private root: HTMLDivElement;
  private labels: { letter: string; n: [number, number, number]; el: HTMLSpanElement }[] = [];
  private orbit: Orbit = { latitude: 35, longitude: 30, distance: 6 };
  private alpha = 0;
  private target = 0;
  private screenSlot: boolean;
  private visibleSlotCount: number;
  /** 按 screenSlot mode 排好的字母序列(默认 = 输入 faces 的 letter 顺序)。 */
  private slotLetters: string[];
  /** Cube state 相对于 default 的累积旋转 quat(w,x,y,z 顺序)。
   *  layout 投影前用这个 quat 旋转每个 face 的 default normal,label 跟着原 piece 走。 */
  private cubeOrientation: [number, number, number, number] = [1, 0, 0, 0];

  constructor(host: HTMLElement, faces: FaceTable, options: FaceOverlayOptions = {}) {
    this.host = host;
    this.screenSlot = options.screenSlot ?? false;
    this.visibleSlotCount = options.visibleSlotCount ?? (faces.length - 1);
    this.slotLetters = faces.map(f => f.letter);
    const cs = window.getComputedStyle(host);
    if (cs.position === 'static') host.style.position = 'relative';
    this.root = document.createElement('div');
    Object.assign(this.root.style, {
      position: 'absolute', inset: '0', pointerEvents: 'none',
      overflow: 'hidden', opacity: '0',
    } as Partial<CSSStyleDeclaration>);
    host.appendChild(this.root);

    for (const f of faces) {
      const el = document.createElement('span');
      el.textContent = f.letter;
      Object.assign(el.style, {
        position: 'absolute',
        left: '0', top: '0',
        font: 'bold 22px system-ui, sans-serif',
        color: '#fff',
        textShadow: '-1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000, 0 0 4px rgba(0,0,0,.6)',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        transform: 'translate(-9999px,-9999px)',
        willChange: 'transform, display',
      } as Partial<CSSStyleDeclaration>);
      this.root.appendChild(el);
      this.labels.push({ letter: f.letter, n: [f.normal[0], f.normal[1], f.normal[2]], el });
    }
  }

  setOrbit(o: Orbit): void {
    this.orbit = o;
    this.layout();
  }

  setCubeOrientation(q: [number, number, number, number]): void {
    this.cubeOrientation = q;
    this.layout();
  }

  show(): void { this.target = 1; }
  hide(): void { this.target = 0; }

  /** dt ms — 跟 face_hints.ts API 对齐。 */
  tick(dt: number): boolean {
    if (this.alpha === this.target) return false;
    const step = dt / FADE_MS;
    this.alpha = this.target > this.alpha
      ? Math.min(this.target, this.alpha + step)
      : Math.max(this.target, this.alpha - step);
    this.root.style.opacity = String(this.alpha);
    return true;
  }

  dispose(): void {
    this.root.remove();
    this.labels.length = 0;
  }

  /** 主投影:lat/lon/dist → eye → view 矩阵 → 每个 normal 投到 host 像素。 */
  private layout(): void {
    const rect = this.host.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    if (w <= 0 || h <= 0) return;

    const { latitude: lat, longitude: lon, distance: d } = this.orbit;
    const phi = (90 - lat) * Math.PI / 180;
    const theta = lon * Math.PI / 180;

    // eye(Y-up,跟 cubing.js setCameraFromOrbitCoordinates 一致)
    const sP = Math.sin(phi), cP = Math.cos(phi);
    const sT = Math.sin(theta), cT = Math.cos(theta);
    const ex = d * sP * sT;
    const ey = d * cP;
    const ez = d * sP * cT;

    // lookAt: f = normalize(origin - eye), r = normalize(f × up), u = r × f
    const fx0 = -ex, fy0 = -ey, fz0 = -ez;
    const fLen = Math.hypot(fx0, fy0, fz0) || 1;
    const fx = fx0 / fLen, fy = fy0 / fLen, fz = fz0 / fLen;
    // up = [0,1,0]
    let rx = fy * 0 - fz * 1;
    let ry = fz * 0 - fx * 0;
    let rz = fx * 1 - fy * 0;
    const rLen = Math.hypot(rx, ry, rz) || 1;
    rx /= rLen; ry /= rLen; rz /= rLen;
    const ux = ry * fz - rz * fy;
    const uy = rz * fx - rx * fz;
    const uz = rx * fy - ry * fx;

    // 视图变换: world point p → view = ( (p-eye)·r, (p-eye)·u, -(p-eye)·f )
    // (camera 朝 -z; (p-eye)·f 是沿 forward 的距离,前方 > 0;view z 设负号 → 前方 z<0)

    const aspect = w / h;
    const fovRad = FOV_DEG * Math.PI / 180;
    const fScale = 1 / Math.tan(fovRad / 2);

    // 第一遍:投影所有 vertex,记录屏幕坐标 + visibility
    // screenSlot mode (pyraminx) 把 normal 当 vertex(尖角),tetrahedron 所有
    // vertex 都是表面点不会被自身挡 → visibility 只看 vzCam(在镜头前方)。
    // 默认 mode (skewb/megaminx) normal 是 face center,需 visDot > 0 表示
    // face 朝向镜头(背面被 cube body 挡)。
    const eyeLen = Math.hypot(ex, ey, ez) || 1;
    // cubeOrientation 旋转每个 default normal 到 world(label 跟原 piece)
    // screenSlot mode 下 letter 会被屏幕方位重 assign,所以 piece-follow 不影响显示。
    const [qw, qx, qy, qz] = this.cubeOrientation;
    const rotateByOrientation = (v: [number, number, number]): [number, number, number] => {
      const ix = qw * v[0] + qy * v[2] - qz * v[1];
      const iy = qw * v[1] + qz * v[0] - qx * v[2];
      const iz = qw * v[2] + qx * v[1] - qy * v[0];
      const iw = -qx * v[0] - qy * v[1] - qz * v[2];
      return [
        ix * qw + iw * -qx + iy * -qz - iz * -qy,
        iy * qw + iw * -qy + iz * -qx - ix * -qz,
        iz * qw + iw * -qz + ix * -qy - iy * -qx,
      ];
    };
    type LabelEntry = { letter: string; n: [number, number, number]; el: HTMLSpanElement };
    type ProjEntry = { lab: LabelEntry; sx: number; sy: number; visible: boolean };
    const projected: ProjEntry[] = this.labels.map((lab) => {
      const [nx, ny, nz] = rotateByOrientation(lab.n);
      const px = nx * LABEL_RADIUS, py = ny * LABEL_RADIUS, pz = nz * LABEL_RADIUS;
      const vx0 = px - ex, vy0 = py - ey, vz0 = pz - ez;
      const vx = vx0 * rx + vy0 * ry + vz0 * rz;
      const vy = vx0 * ux + vy0 * uy + vz0 * uz;
      const vzCam = -(vx0 * fx + vy0 * fy + vz0 * fz);
      const visDot = (nx * ex + ny * ey + nz * ez) / eyeLen;
      const visible = this.screenSlot
        ? vzCam < 0
        : visDot > BACKFACE_EPS && vzCam < 0;
      let sx = -9999, sy = -9999;
      if (visible) {
        const ndcX = (vx * fScale / aspect) / -vzCam;
        const ndcY = (vy * fScale) / -vzCam;
        sx = (ndcX * 0.5 + 0.5) * w;
        sy = (1 - (ndcY * 0.5 + 0.5)) * h;
      }
      return { lab, sx, sy, visible };
    });

    // screenSlot mode:字母按屏幕方位 re-assign。
    //   pyraminx 4 vertex,我们预留 3 slot 给 U/L/R(最近镜头的 3 个),
    //   最远 1 个 = B(隐藏)。即使 4 vertex 都在镜头前方(vzCam<0),
    //   也强制选 vzCam 最大(最远)那个为 B 不显示。
    //   3 visible 中:屏幕 y 最小 = U,剩下按 x asc = L, R。
    // 默认 mode:每个 label 用自家原 letter,visible 显示在自身投影位置。
    let letterPerEntry: (string | null)[];
    const finalVisible: boolean[] = projected.map(p => p.visible);
    if (this.screenSlot) {
      // 按 vzCam (camera 空间 z,负值=前方,越负越近) 取最近 3 个当 U/L/R
      // tracked indices with their vzCam (compute z again, faster: keep from above)
      // 不过我们没存 vzCam,这里 cheap:用 sy 做近似(顶 vertex y 小,底 vertex y 大),
      // 改用 visibility + 限 3 名:取 visible 列表里 vzCam 最负的 3 个(离镜头近)。
      const visibleWithZ = projected.map((p, i) => {
        const [nx, ny, nz] = rotateByOrientation(p.lab.n);
        const px = nx * LABEL_RADIUS - ex, py = ny * LABEL_RADIUS - ey, pz = nz * LABEL_RADIUS - ez;
        const vzCam = -(px * fx + py * fy + pz * fz);
        return { p, i, vzCam };
      });
      // vzCam = -forward_distance (negative when in front)。最负 = forward 最远。
      // sort by vzCam DESC → 最近镜头在前,最远在最后(应隐藏为 B)
      visibleWithZ.sort((a, b) => b.vzCam - a.vzCam);
      // 前 nVisSlot 个 = 最近 → 屏幕"顶/左/右"3 slot;剩下 = 背面隐藏
      const nVisSlot = this.visibleSlotCount; // 3 for pyraminx (4-1), 3 for skewb (显式传)
      const slotted = visibleWithZ.slice(0, nVisSlot);
      const backIdx = visibleWithZ.slice(nVisSlot).map(x => x.i);
      // 给 backIdx 强制 hide
      for (const i of backIdx) finalVisible[i] = false;
      // 在 slotted 内部按屏幕 y asc → U,剩下按 x asc → L/R
      const slottedSorted = [...slotted].sort((a, b) => a.p.sy - b.p.sy);
      const assigned: (string | null)[] = new Array(projected.length).fill(null);
      if (slottedSorted[0]) assigned[slottedSorted[0].i] = this.slotLetters[0] ?? '';
      if (slottedSorted.length > 1) {
        const rest = slottedSorted.slice(1).sort((a, b) => a.p.sx - b.p.sx);
        if (rest[0]) assigned[rest[0].i] = this.slotLetters[1] ?? '';
        if (rest[1]) assigned[rest[1].i] = this.slotLetters[2] ?? '';
      }
      // B vertex 拿剩下 letter
      for (const i of backIdx) assigned[i] = this.slotLetters[nVisSlot] ?? '';
      letterPerEntry = assigned;
    } else {
      letterPerEntry = projected.map(p => p.lab.letter);
    }

    for (let i = 0; i < projected.length; i++) {
      const p = projected[i];
      const letter = letterPerEntry[i] ?? p.lab.letter;
      if (p.lab.el.textContent !== letter) p.lab.el.textContent = letter;
      if (!finalVisible[i]) { p.lab.el.style.display = 'none'; continue; }
      p.lab.el.style.display = '';
      p.lab.el.style.transform = `translate(${p.sx.toFixed(1)}px, ${p.sy.toFixed(1)}px) translate(-50%, -50%)`;
    }
  }
}
