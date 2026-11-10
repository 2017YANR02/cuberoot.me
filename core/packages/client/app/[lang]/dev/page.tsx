'use client';

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { ArrowUpRight, Code2, Cpu, Globe, Network, Palette, Settings2, type LucideIcon } from 'lucide-react';
import Link from '@/components/AppLink';
import BackHome from '@/components/BackHome';
import MoreToggle from '@/components/MoreToggle';
import { useT } from '@/hooks/useT';
import { tr, type Msg } from '@/i18n/tr';
import { CUBE_POSES, cubeRotationTransform, dragCubeRotation, nearestCubeFace, rotationFromMatrix, rotationFromPose, type CubeFace, type CubeRotation } from './_cube-orbit';
import './code_index.css';

interface Entry {
  href: string;
  name: Msg;
  description: Msg;
}

interface Face {
  id: CubeFace;
  name: Msg;
  icon: LucideIcon;
  entries: Entry[];
}

// One catalog supplies both the focused face and the unfolded navigation.
const FACES: Face[] = [
  {
    id: 'system', name: { zh: '系统', en: 'System' }, icon: Network,
    entries: [
      { href: '/dev/architecture', name: { zh: '架构', en: 'Architecture' }, description: { zh: 'Web、客户端、服务与共享能力之间的关系', en: 'How the web, clients, services and shared capabilities fit together' } },
      { href: '/dev/infrastructure', name: { zh: '基础设施', en: 'Infrastructure' }, description: { zh: '生产环境、请求路径、发布、监控与恢复', en: 'Production systems, request routing, releases, monitoring and recovery' } },
      { href: '/dev/dns-routing', name: { zh: '域名与路由', en: 'DNS & routing' }, description: { zh: '同一个网址为何连接不同服务器', en: 'Why one address can connect to different servers' } },
      { href: '/dev/auth', name: { zh: '账号全流程', en: 'Account lifecycle' }, description: { zh: '跨端登录、绑定、合并与注销', en: 'Sign-in, linking, merging and deletion across platforms' } },
    ],
  },
  {
    id: 'compute', name: { zh: '计算', en: 'Compute' }, icon: Cpu,
    entries: [
      { href: '/dev/algorithms', name: { zh: '算法', en: 'Algorithms' }, description: { zh: '状态空间搜索、剪枝表与核心算法', en: 'State-space search, pruning tables and core algorithms' } },
      { href: '/dev/solvers', name: { zh: '求解器', en: 'Solvers' }, description: { zh: '原生分析器与浏览器 WASM 求解器', en: 'Native analyzers and browser WASM solvers' } },
      { href: '/dev/llm', name: { zh: '大模型', en: 'Language models' }, description: { zh: 'CubeRoot 与大语言模型协作的历史', en: 'The history of CubeRoot’s collaboration with language models' } },
    ],
  },
  {
    id: 'design', name: { zh: '设计', en: 'Design' }, icon: Palette,
    entries: [
      { href: '/dev/continuous-corners', name: { zh: '连续圆角', en: 'Continuous corners' }, description: { zh: '路径重建、贝塞尔数学与误差测量', en: 'Path reconstruction, Bézier mathematics and error measurements' } },
      { href: '/dev/components', name: { zh: '组件库', en: 'Components' }, description: { zh: '可复用 UI 组件、实时预览与使用示例', en: 'Reusable UI components, live previews and usage examples' } },
      { href: '/dev/tokens', name: { zh: '设计令牌', en: 'Design tokens' }, description: { zh: '全站配色、状态与亮暗主题的统一来源', en: 'The source of site colors, states and light and dark themes' } },
      { href: '/dev/fonts', name: { zh: '字体', en: 'Fonts' }, description: { zh: '字体样张、字重、用途与许可', en: 'Type specimens, weights, uses and licenses' } },
    ],
  },
  {
    id: 'build', name: { zh: '开发', en: 'Build' }, icon: Code2,
    entries: [
      { href: '/dev/stack', name: { zh: '技术栈', en: 'Stack' }, description: { zh: 'CubeRoot 使用的软件与工具', en: 'The software and tools used by CubeRoot' } },
      { href: '/dev/language', name: { zh: '语言', en: 'Languages' }, description: { zh: '编程语言的历史、特性与生态', en: 'Programming languages: history, features and ecosystems' } },
      { href: '/dev/utils', name: { zh: '速查', en: 'Hooks & utils' }, description: { zh: '共享 React Hooks 与工具函数', en: 'Shared React hooks and utility functions' } },
      { href: '/dev/api', name: { zh: 'API', en: 'API' }, description: { zh: '按业务域组织的接口参考', en: 'Endpoint reference organized by domain' } },
      { href: '/dev/schema', name: { zh: '数据模型', en: 'Database schema' }, description: { zh: 'PostgreSQL 数据表、关键列与迁移', en: 'PostgreSQL tables, key columns and migrations' } },
    ],
  },
  {
    id: 'operations', name: { zh: '运维', en: 'Operations' }, icon: Settings2,
    entries: [
      { href: '/dev/ops', name: { zh: '运维手册', en: 'Runbook' }, description: { zh: '数据库、构建、部署和备份命令', en: 'Commands for databases, builds, deployment and backups' } },
      { href: '/dev/guards', name: { zh: '约束守卫', en: 'Guards' }, description: { zh: '写入拦截与 CI 棘轮', en: 'Write-time checks and CI ratchets' } },
      { href: '/dev/dead-code', name: { zh: '死代码守卫', en: 'Dead code' }, description: { zh: '未使用文件、依赖与导出的治理', en: 'Checks for unused files, dependencies and exports' } },
      { href: '/dev/expenses', name: { zh: '支出与设备', en: 'Expenses' }, description: { zh: '设备、工位、人员与服务订阅的投入', en: 'Investment in equipment, workspaces, staffing and subscriptions' } },
      { href: '/dev/traffic-incident-2026-09', name: { zh: '9 月流量事件', en: 'Traffic incident' }, description: { zh: '2026 年 9 月的流量排查与处置记录', en: 'Investigation and response to the September 2026 traffic incident' } },
      { href: '/admin/team', name: { zh: 'Workspace', en: 'Workspace' }, description: { zh: '项目、工作记录与团队协作', en: 'Projects, work updates and team collaboration' } },
    ],
  },
  {
    id: 'ecosystem', name: { zh: '生态', en: 'Ecosystem' }, icon: Globe,
    entries: [
      { href: '/dev/wca-export', name: { zh: 'WST 数据导出', en: 'WST export' }, description: { zh: 'WCA 数据快照与离线统计来源', en: 'WCA database snapshots and the source of offline statistics' } },
      { href: '/dev/wcif', name: { zh: 'WCIF', en: 'WCIF' }, description: { zh: 'WCA 比赛数据交换格式', en: 'The WCA Competition Interchange Format' } },
      { href: '/dev/wca-rest-api', name: { zh: 'WCA REST API', en: 'WCA REST API' }, description: { zh: '非官方静态 JSON 数据接口', en: 'Unofficial static JSON data endpoints' } },
      { href: '/dev/wca-site', name: { zh: 'WCA 官网', en: 'WCA website' }, description: { zh: '官方成绩来源与网站技术档案', en: 'The official results source and a technical profile of the website' } },
      { href: '/dev/cubingchina', name: { zh: '粗饼网', en: 'CubingChina' }, description: { zh: '中国赛事平台的技术侧写', en: 'A technical profile of the Chinese competition platform' } },
    ],
  },
];

const ENTRY_COUNT = FACES.reduce((count, face) => count + face.entries.length, 0);
// Deliberately scattered, but stable across SSR, language switches and dragging.
// Reserve the center for the category and the top-right sticker for its number.
const STICKER_SLOTS = [[0, 5, 6, 7], [1, 3, 6, 8], [0, 3, 5, 8], [1, 5, 6, 8], [0, 3, 7, 8], [1, 3, 5, 6]];

interface CubeDrag {
  id: number;
  startX: number;
  startY: number;
  start: CubeRotation;
  current: CubeRotation;
  moved: boolean;
}

function EntryLinks({ entries, detailed = false }: { entries: Entry[]; detailed?: boolean }) {
  return <div className={`dev-cube-links${detailed ? ' dev-cube-links-detailed' : ''}`}>
    {entries.map(entry => <Link key={entry.href} href={entry.href} prefetch={false} className="dev-cube-link">
        <span><span className="dev-cube-link-name">{tr(entry.name)}</span>
          {detailed && <span className="dev-cube-link-description">{tr(entry.description)}</span>}
        </span>
        <ArrowUpRight size={16} aria-hidden="true" />
      </Link>)}
  </div>;
}

export default function DevIndexPage() {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState(0);
  const [rotation, setRotation] = useState<CubeRotation>(() => rotationFromPose(CUBE_POSES.system));
  const [dragging, setDragging] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const rotorRef = useRef<HTMLDivElement>(null);
  const dragButtonRef = useRef<HTMLButtonElement>(null);
  const pointer = useRef<CubeDrag | null>(null);
  const frame = useRef(0);
  const suppressClick = useRef(false);
  const active = FACES[selected];

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const stopPointer = () => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    const drag = pointer.current;
    pointer.current = null;
    setDragging(false);
    if (drag && dragButtonRef.current?.hasPointerCapture(drag.id)) {
      dragButtonRef.current.releasePointerCapture(drag.id);
    }
    return drag;
  };

  const selectFace = (face: CubeFace) => {
    stopPointer();
    setSelected(FACES.findIndex(item => item.id === face));
    setRotation(rotationFromPose(CUBE_POSES[face]));
  };

  const finishDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = pointer.current;
    if (!drag || drag.id !== event.pointerId) return;
    suppressClick.current = drag.moved;
    selectFace(nearestCubeFace(drag.current, active.id));
  };

  const beginDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !event.isPrimary || expanded || pointer.current) return;
    // Catch an in-flight snap at its displayed pose rather than jumping to its
    // target when the user grabs the cube again before the transition finishes.
    const matrix = new DOMMatrixReadOnly(getComputedStyle(rotorRef.current!).transform);
    const start = rotationFromMatrix(matrix);
    suppressClick.current = false;
    pointer.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, start, current: start, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    setRotation(start);
    setDragging(true);
  };

  const moveDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = pointer.current;
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    drag.moved ||= Math.hypot(dx, dy) > 5;
    if (!drag.moved) return;
    drag.current = dragCubeRotation(drag.start, dx, dy);
    if (!frame.current) frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      if (pointer.current) setRotation(pointer.current.current);
    });
  };

  // Faces remain mounted in both views. CSS interpolates their actual geometry,
  // including an interrupted/reversed transition, without snapshots or timers.
  const toggle = () => {
    if (pointer.current) selectFace(nearestCubeFace(pointer.current.current, active.id));
    toggleRef.current?.focus({ preventScroll: true });
    setExpanded(value => !value);
  };

  return (
    <div className="code-index" data-expanded={expanded} data-dragging={dragging} style={{
      '--cube-rotation': cubeRotationTransform(rotation),
      '--cube-entry-count': active.entries.length,
    } as CSSProperties}>
      <div className="code-index-wrap">
        <header className="code-index-head">
          <div className="code-index-topbar">
            <BackHome />
            <Link href="/" className="code-index-brand">CubeRoot</Link>
          </div>
          <div className="code-index-heading">
            <div className="code-index-title-row">
              <h1><span>/</span>dev<span className="code-index-cursor" aria-hidden="true">_</span></h1>
              <span className="code-index-count">{ENTRY_COUNT} {t('个入口', 'entries')}</span>
            </div>
            <MoreToggle ref={toggleRef} expanded={expanded} onToggle={toggle}
              aria-controls="dev-cube-scene" className="dev-cube-toggle">
              {expanded ? t('收回魔方', 'Fold into cube') : t('展开全部', 'Unfold all')}
            </MoreToggle>
          </div>
        </header>

        <main id="dev-cube-scene" className="dev-cube-scene" aria-label={t('开发导航', 'Developer navigation')}>
          <div className="dev-cube-rotor" ref={rotorRef}>
            {FACES.map((face, index) => (
              <section key={face.id} className="dev-cube-face" data-face={face.id}
                data-active={index === selected} inert={!expanded} aria-hidden={!expanded}
                aria-labelledby={`dev-face-${face.id}`}>
                <div className="dev-cube-surface" data-site-surface="panel">
                  <div className="dev-cube-stickers" aria-hidden="true">
                    {Array.from({ length: 9 }, (_, cell) => {
                      const slot = STICKER_SLOTS[index].indexOf(cell);
                      const entry = slot >= 0 && slot < Math.min(face.entries.length, 4)
                        ? face.entries[(slot + index) % face.entries.length] : null;
                      return <span key={cell}>
                        {cell === 4 && <face.icon className="dev-cube-category-icon" strokeWidth={1.25} aria-hidden="true" />}
                        {entry && <span className="dev-cube-sticker-label">{tr(entry.name)}</span>}
                      </span>;
                    })}
                  </div>
                  <span className="dev-cube-index" aria-hidden="true">0{index + 1}</span>
                  <h2 id={`dev-face-${face.id}`}>{tr(face.name)}</h2>
                  <div className="dev-cube-face-links"><EntryLinks entries={face.entries} /></div>
                </div>
              </section>
            ))}
          </div>

          <button ref={dragButtonRef} type="button" className="dev-cube-open"
            onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={finishDrag}
            onPointerCancel={finishDrag} onLostPointerCapture={finishDrag}
            onClick={event => {
              if (event.detail === 0 || !suppressClick.current) toggle();
              suppressClick.current = false;
            }}
            onKeyDown={event => {
              const delta = { ArrowLeft: [-200, 0], ArrowRight: [200, 0], ArrowUp: [0, -200], ArrowDown: [0, 200] }[event.key];
              if (delta) {
                event.preventDefault();
                const next = dragCubeRotation(rotation, delta[0], delta[1]);
                selectFace(nearestCubeFace(next, active.id));
              } else if (event.key === 'Escape' || event.key === 'Home') {
                event.preventDefault();
                selectFace(event.key === 'Home' ? 'system' : active.id);
              }
            }}
            inert={expanded} aria-hidden={expanded}
            aria-label={t('拖动或用方向键旋转，松手吸附分类；单击展开', 'Drag or use arrow keys to rotate and snap to a category; click to unfold')} />

          <nav className="dev-cube-categories" aria-label={t('分类', 'Categories')} inert={expanded} aria-hidden={expanded}>
            {FACES.map((face, index) => <button type="button" key={face.id}
              aria-pressed={selected === index} aria-controls="dev-cube-focus"
              onClick={() => selectFace(face.id)}>{tr(face.name)}</button>)}
          </nav>

          <div id="dev-cube-focus" className="dev-cube-focus" inert={expanded} aria-hidden={expanded}>
            <h2 className="dev-cube-focus-title">{tr(active.name)}</h2>
            <div className="dev-cube-focus-content" aria-live="polite">
              <EntryLinks entries={active.entries} detailed />
            </div>
          </div>
        </main>
        <footer className="code-index-foot" aria-hidden="true">CUBEROOT <span>/</span> DEV</footer>
      </div>
    </div>
  );
}
