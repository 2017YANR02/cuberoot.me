# Frame Count 数帧工具

> 路径：`core/packages/client/src/pages/frame-count/`

## 概述

专为魔方速拧比赛设计的本地视频数帧工具，参照 [ReconViewer](https://github.com/Borg-7/ReconViewer) 风格。  
**全本地运行，视频文件不会上传到任何服务器。**

## 文件结构

```
frame-count/
├── FrameCountPage.tsx   # 主组件（全部业务逻辑）
├── frame-count.css      # 专用样式
└── README.md            # 本文件
```

## 功能模式

### 普通模式（Split Mark）
用于普通数帧场景：

1. 导航到起点帧 → 按 `M` 添加 mark
2. 导航到终点帧 → 按 `M` 添加 mark
3. 右侧面板自动显示相邻 mark 的帧差和时间差
4. Total 行显示首尾 mark 的总差值

支持一个 Solve 内添加多个 mark（split timing）。

### WCA 违规检测模式（Sliding）
用于判断选手是否存在 sliding 等违规行为，位于底部 **WCA tab**：

| 字段 | 类型 | 说明 |
|------|------|------|
| Solve Time | 手动输入 | 选手的还原时间（秒） |
| Frames | 自动计算 | WCA 公式算出的帧数 |
| End Frame | 手动输入 / `] Mark` | 魔方停止移动的帧 |
| Start Frame | 自动计算 | `End Frame - Frames`，应为手放开魔方的帧 |

**WCA 帧数公式**（来源：WCA 官方规则）：
```
Frames = ROUNDUP((ROUNDDOWN(time, 2) + 0.009) × fps) + 1
```

## 关键技术实现

### 精确 FPS 检测
使用 **MediaInfo.js (WASM)** 解析视频容器元数据，而非浏览器播放采样。

- WASM 文件位于：`core/packages/client/public/MediaInfoModule.wasm`
- 优先使用 `FrameRate_Num / FrameRate_Den` 获得精确分数帧率（如 120000/1001 = 119.88）
- 回退到 `FrameRate` 浮点值

```typescript
// 函数签名
async function detectFpsFromFile(file: File): Promise<number | null>
```

### 帧同步
- 优先使用 `requestVideoFrameCallback`（精确）
- 回退到 `timeupdate` 事件（兼容性）

### Marks 排序
marks 数组始终按帧号升序排列（`addMark` 和 `updateMark` 后自动 `.sort()`），确保帧差永远为正数。

## 数据模型

```typescript
interface Mark {
  frame: number;        // 帧号
}

interface Solve {
  name: string;         // "Solve 1", "Solve 2", ...
  marks: Mark[];        // 始终按 frame 升序排列
}
```

状态说明：

| 状态 | 说明 |
|------|------|
| `solves` | 所有 Solve 的数组 |
| `activeSolveIdx` | 当前选中的 Solve 索引 |
| `selectedMarkIdx` | 当前选中的 Mark 索引（用于 Remove/Update） |
| `videoFps` | 当前 FPS，可手动覆盖 |
| `fpsAutoDetected` | 是否由 MediaInfo 自动检测 |
| `wcaEndFrame` | WCA 模式的 End Frame |
| `imageTransform` | 图像变换（旋转/翻转） |
| `cropRect` | 裁切区域（百分比） |

## 快捷键

| 按键 | 功能 |
|------|------|
| `M` | 添加 Split Mark（当前帧） |
| `+` / `=` | 新建 Solve |
| `A` / `,` | 后退 1 帧 |
| `D` / `.` | 前进 1 帧 |
| `Q` | 后退 10 帧 |
| `E` | 前进 10 帧 |
| `K` | 播放 / 暂停 |
| `L` | 前进 1 秒 |
| `C` | 复制当前帧号 |
| `Shift + 滚轮` | 逐帧步进 |

## UI 布局

```
┌─ Header ──────────────────────────────────────────────────────────┐
│ ← Back            Frame Count               ⌨ Shortcuts          │
├───────────────────────────────────────────────────────────────────┤
│  fc-video-col（左）           │  fc-solve-col（右 300px）          │
│                               │  [Solve 1 ▼] [+] [−]             │
│  fc-video-zone                │  ─────────────────────────────    │
│  ├─ <video>                   │  marks 列表（帧号、时间、帧差）    │
│  ├─ fc-video-overlay          │  ─────────────────────────────    │
│  └─ fc-crop-overlay           │  [Add] [Remove] [Update]          │
│                               │                                   │
│  fc-controls-wrap             │                                   │
│  ├─ fc-progress-bar           │                                   │
│  └─ fc-controls               │                                   │
├───────────────────────────────────────────────────────────────────┤
│  fc-bottom-panel                                                  │
│  [Setup] [Image] [WCA]                                            │
│  Setup: FPS + Crop  │  Image: 旋转/翻转  │  WCA: 违规检测          │
└───────────────────────────────────────────────────────────────────┘
```

## CSS 关键 class 速查

| Class | 说明 |
|-------|------|
| `.frame-count-page` | 页面根元素 |
| `.fc-main` | CSS Grid 主体（视频 + Solve 面板） |
| `.fc-video-col` | 左侧视频列 |
| `.fc-solve-col` | 右侧 Solve 列（固定 300px） |
| `.fc-video-zone` | 视频容器（`overflow: hidden`，用于裁切缩放） |
| `.fc-video-overlay` | 视频右下角帧号叠加层 |
| `.fc-marks-list` | Mark 列表滚动容器 |
| `.fc-mark-row` | 单个 mark 行（`.selected` 高亮） |
| `.fc-mark-diff` | 帧差/时间差（金色高亮） |
| `.fc-wca-grid` | WCA tab 内的 2 列 grid 布局 |
| `.fc-tab-btn.active` | 激活状态的按钮 |
| `.fc-tab-btn.reset` | 重置按钮（红色） |

## 裁切与缩放逻辑

裁切使用 `clip-path: inset(top% right% bottom% left%)`。  
Apply Crop 后（`!cropMode && cropRect`），自动计算 scale 使裁切区域填充容器：

```typescript
const scale = Math.min(100 / visibleW, 100 / visibleH);
const tx = 50 - centerX; // 将裁切中心对齐容器中心
const ty = 50 - centerY;
transform: `scale(${scale}) translate(${tx}%, ${ty}%)`;
```

## 已知限制

- B站/YouTube 视频无法直接加载（CORS + DRM），建议用 `yt-dlp` 下载后上传本地文件
- `requestVideoFrameCallback` 在部分旧浏览器不可用，会回退到 `timeupdate`（精度略低）
- 移动端布局为单列，Solve 面板显示在视频上方

## 依赖

| 依赖 | 用途 |
|------|------|
| `mediainfo.js` | 解析视频容器元数据获取精确 FPS |
| `react-router-dom` | 路由（`Link` to `/`） |

> `MediaInfoModule.wasm` 需手动放置于 `public/` 目录，Vite 通过 `locateFile: () => '/MediaInfoModule.wasm'` 定位。
