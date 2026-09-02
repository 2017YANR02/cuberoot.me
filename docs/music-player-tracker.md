# 音乐播放器跟踪表

状态：`ACTIVE`。最后更新：2026-09-02。

## 目标

把现有全站悬浮节拍器扩展为统一音频中心，同时新增完整的 `/music` 音乐页面。用户既能继续使用节拍器，也能浏览曲库、查看封面和同步歌词，并在跨页面导航后继续播放当前歌曲。

本跟踪表是范围、媒体处理、部署和验收的执行入口。运行源码、部署 workflow、nginx 配置和最终媒体清单仍分别是各自事实源。

## 当前结论

- 页面入口固定为英文 `/music`、简体中文 `/zh/music`，继续遵守站点 Pattern B 路由。
- 首页音乐卡片登记到 `core/packages/shared/src/site_directory.ts`，视觉映射登记到 `core/packages/client/lib/landing-sections.tsx`；搜索卡片由现有目录自动派生，不另建一份清单。
- 全站入口复用根布局中的 `DeskPet` 和现有 Music 图标，直接把 `FloatingMetronome` 扩展为音乐/节拍器双模式音频中心，保留拖动、收起、位置记忆和窄屏钳位。
- 节拍器继续使用 `core/packages/client/lib/metronome.ts`，不把歌曲队列、播放进度或歌词状态塞进节拍器引擎。音乐使用独立的 `HTMLAudioElement` transport；页面与悬浮播放器共享同一实例和状态。
- 第一阶段是公开只读曲库：静态媒体清单、音频、封面和歌词，不新增 Hono 路由、PostgreSQL 表或登录要求。账号云同步、后台上传、权限曲目和服务端统计不在第一阶段。
- 生产音频不得进入 Git、`core/packages/client/public`、`tools/` 或 `stats/`。大媒体通过独立静态媒体目录发布，由客户端用现有 `staticUrl()` 生成 URL。
- `E:\Music` 永远只读。转码只从该源读取，输出到 `Z:` 的专用 staging；禁止在 `E:` 写 sidecar、改名、移动、删除或原地更新 metadata。
- 不整仓移植第三方播放器。只复用经确认的视觉、交互或小型独立模块，保留 CubeRoot 的 Next 路由、主题、i18n、状态和部署边界。

## 当前事实与空间快照

- 根布局中的 `DeskPet` 已让悬浮节拍器跨页面存活，并处理显式语言状态、用户手势启动音频和桌宠节拍反馈。
- Timer 依赖现有节拍器 hold 契约；音乐功能不能改变其节奏、精度或训练行为。
- `core/packages/client/public` 会进入 Next standalone 发布包；当前静态域及同步 workflow 只明确覆盖 `tools/` 和 `stats/`，尚无音乐媒体发布路径。
- 仓库已实现专业播放器状态模型、`MusicManifest v1`、本机可恢复媒体准备脚本和原子发布脚本；静态媒体尚未实际发布，浏览器格式矩阵与 8 首模糊曲目仍待人工复核。
- 2026-09-02 只读检查时，`E:` 可用约 27.3 GiB，`Z:` 可用约 34.4 GiB。此数值会变化，每个批次必须重新检查，不能把本快照当作配额。
- GitHub 对标已完成；当前只参考 Feishin、YesPlayMusic 和 Apple Music Like Lyrics 的产品分层，没有复制第三方源码或安装播放器依赖。
- 已只读盘点 `E:\Music`：521 个条目中 488 个媒体文件；321 个音频可直接复制，128 个视频可无重编码抽取音轨，39 个旧格式需转 AAC-LC 192 kbps，另有 26 个封面/歌词 sidecar 和 7 个跳过文档。
- 486 个唯一媒体的最终引用音频为 5.009 GiB；2026-09-02 全量完成并复核时 `Z:` 可用 29.354 GiB。源清单位于 `Z:\cuberoot-music-staging\inventory\source-manifest.jsonl`。
- 6 首嵌入封面与 3 张同目录唯一 `Cover.jpg`/`Folder.jpg` 共形成 8 个去重封面资产、61 个曲目封面绑定；15 份 LRC 形成 15 个歌词资产、16 个精确曲目绑定。仍有 8 张无法精确绑定的图片留在人工队列。

## 产品范围

第一阶段覆盖：

- `/music` 曲库首页：搜索、分类筛选、歌曲列表和当前播放队列。
- 专业播放控制：播放/暂停、上一首/下一首、进度、音量、循环、单曲循环和随机播放。
- 当前歌曲封面、标题、艺术家、专辑、年份、类型和时长。
- 同步歌词滚动、当前行高亮、点击歌词跳转；无歌词时显示明确空状态。
- 根级悬浮音频中心，在音乐与节拍器之间切换；跨页面保持音乐状态。
- Media Session 元数据及系统级播放/暂停、上一首、下一首和拖动进度支持。
- 英文和简体中文、桌面和小于 480px 的窄屏、键盘和触摸操作。

第一阶段不覆盖：

- 用户上传、在线转码、购买、订阅、DRM 或付费权限。
- 账号云歌单、跨设备同步、评论、关注、推荐算法和社交动态。
- 第三方音乐平台抓取、在线搜索或绕过来源限制。
- 无损与有损双份常驻、多个码率自适应流、HLS/DASH 和视频播放。
- 自动生成不存在的歌词、曲名、艺术家或专辑信息。

## 页面与全站播放架构

### `/music` 页面

当前最小文件边界：

| 文件 | 责任 |
| --- | --- |
| `core/packages/client/app/[lang]/music/page.tsx` | 页面入口和页面级状态组合 |
| `core/packages/client/app/[lang]/music/layout.tsx` | `pageMetadata('music')` |
| `core/packages/client/app/[lang]/music/music.css` | 仅音乐页布局和响应式样式 |
| `core/packages/client/lib/music-player.ts` | 唯一浏览器 transport、队列和播放状态 |
| `core/packages/client/components/FloatingMetronome.tsx` | 音乐/节拍器共享的根级悬浮音频中心 |

组件只有在页面和根级浮层之间存在真实复用时才放进全局 `components/` 或 `lib/`。页面专属组件留在路由目录，禁止为了可能的后续需求提前拆包。

### DeskPet 与节拍器边界

- `DeskPet` 继续拥有根级开关、懒加载和显式 `lang` 传递；不要在根布局外再挂第二个播放器。
- 现有 Music 图标改为音频中心入口，避免新增一个与节拍器职责重叠的按钮。
- 共享悬浮外壳负责拖动、收起、视口钳位和位置持久化；节拍器面板与音乐迷你播放器作为两个模式渲染。
- `metronome.ts` 的 WebAudio 调度、订阅和 Timer hold API 保持独立且向后兼容。
- 音乐开始播放时默认暂停正在响的节拍器；用户切回节拍器并主动播放时暂停歌曲。该互斥必须在单一音频协调层完成，不能由两个 UI 互相调用 DOM。
- 浏览器首次发声必须来自用户手势；恢复页面状态不能绕过自动播放限制。
- 音乐 transport 只在客户端创建一次，页面卸载不销毁；页面和浮层都通过同一外部 store 订阅。

### 首页卡片和 metadata

- 首页卡片的名称、说明、href 和分组只登记到 `core/packages/shared/src/site_directory.ts`。
- `core/packages/client/lib/landing-sections.tsx` 只增加图标等视觉映射；`LandingClient` 和搜索组件不手写第二张音乐卡片。
- 默认把音乐放入普通内容分组，避免直接破坏现有首屏固定网格。若产品决定进入首屏，必须先单独验收桌面 5+4 与移动 3×3 的新布局。
- `core/packages/client/lib/page-meta.ts` 增加 `music` 的双语标题和描述，路由目录建立 server `layout.tsx`。
- 所有内部跳转使用 `AppLink` 或现有真链接，不用按钮加脚本跳转。

## 曲库清单契约

公开清单不暴露 `E:\Music` 原始绝对路径、Windows 用户名或其他本机信息。逻辑 track ID 是规范源内容的完整 SHA-256；488 个媒体源归并为 486 个唯一内容。音频、封面和歌词文件名分别使用实际输出字节的完整 SHA-256，因此转码规则变化不会冒用旧资产 URL。内容哈希只证明字节相同，不代表已完成声学近重复判断。

已实现的最小版本化结构：

```ts
type MusicCatalogV1 = {
  version: 1
  tracks: MusicTrackV1[]
}

type MusicTrackV1 = {
  id: string
  title: string
  artist: string
  album?: string
  genre?: string
  duration?: number
  src: string
  cover?: string
  lyrics?: string
}
```

入口校验并拒绝：旧版本、缺少稳定 ID、重复 ID、空标题、空播放 URL、负时长和指向 Windows 本机盘符的 URL。缺封面、歌词或 metadata 是合法状态，UI 使用明确的统一占位，不伪造数据。

## `E:\Music` 盘点、分类与转码

### 只读边界

- 盘点命令只读 `E:\Music`，不得生成日志、封面、歌词、缓存、校验文件或临时文件到源目录。
- 不删除、不移动、不重命名、不覆盖源文件；视频也只读取音轨。
- 盘点报告、哈希索引和人工分类覆盖表写入 `Z:\cuberoot-music-staging\`，不写仓库和 `E:`。
- 先盘点扩展名、数量、总字节、预计输出、重复内容、可解析 metadata、嵌入封面和歌词，再开始任何转码。

### 分类规则

当前分类优先级为：嵌入 genre → 明确批准的顶层目录 → 经人工核对的精确 artist/metadata 规则 → `unclassified`。`TTPod` 不作为分类依据，未知曲目不猜成流行。稳定 slug 为 `piano-classical`、`jazz`、`film-tv-soundtrack`、`electronic`、`pop-rock`、`bgm-assets`、`sound-effects`、`ambient-instrumental` 和 `unclassified`；UI 单独提供双语标签。独立人工覆盖事实源尚待实现。

- 统一大小写、空白、全半角标点和多艺术家分隔，不擅自翻译专有名词。
- 同源内容哈希只产一个逻辑曲目；不同源哈希即使同标题也保留全部版本，不能只按标题删除。
- 分类清单记录 `categorySource`；后续人工覆盖表必须成为更高优先级事实源，重新扫描不得覆盖人工结论。
- 源绝对路径只存在于本机私有盘点表；公开清单仅保留内容 ID 和发布 URL。

### 转码输出

- 每个源只生成一份浏览器主播放文件，第一阶段不同时常驻 MP3、AAC、Opus 和无损副本。
- 当前规则为：兼容音频原字节复制；视频仅抽取音轨；APE、WMA 和 MKV Opus 转 AAC-LC/M4A 192 kbps。目标浏览器矩阵仍需实测，未完成前 D 不得标记完成。
- 视频直接从 `E:` 读取音轨并写最终编码文件；禁止先把原视频复制到 `Z:`，禁止产生中间 WAV。
- 源标签只读提取，不重写复制直通文件；封面、歌词和分类作为独立内容哈希资产/清单字段管理。响度规范化与标签重写不在本批实现范围。
- 转码保留原采样率上限并禁止升采样；无法解码、无音轨、时长异常或输出校验失败的文件进入失败清单，不发布半成品。

### staging 与磁盘硬门槛

- staging 根目录固定为 `Z:\cuberoot-music-staging\`；内容哈希资产进入共享 `library/`，每批回执独立写入 `inventory/batches/`，同时只运行一个批次。
- 每批预计最终输出上限为 1 GiB；批次估算增加 15% 后必须小于批次开始时 `Z:` 可用空间减 20 GiB 的结果。任一条件不满足立即停止，不静默换盘。
- 峰值预算包含音频、封面、歌词、清单、转码临时文件和失败残留；预检按源文件估算并增加 15% 余量。
- `E:` 可用空间不计入预算，因为源盘不得承接输出或临时文件。
- 每首先写 `.part`，再用 ffprobe 校验恰好一个音频流、没有视频流且时长合理；通过后计算实际输出 SHA-256 并原子改名。全量独立复核再次验证 486/486 输出。
- 可重复运行脚本为 `scripts/music/prepare-music.ps1`。默认输出 `Z:\cuberoot-music-staging\library`，私有源清单、续跑索引、sidecar 绑定、人工队列和批次回执位于相邻 `inventory/`；`-WhatIf` 只规划，`-Pilot` 只跑固定 9 文件样本，普通调用每次最多处理一个批次。
- staging 清理必须在发布回读和清单校验后单独执行，遵守仓库的回收站规则；不得以清理 staging 为由触碰 `E:\Music`。

## 封面与歌词

封面来源优先级：嵌入封面 → 同目录唯一 `Cover.jpg` → 同目录唯一 `Folder.jpg` → 人工覆盖 → CubeRoot 统一占位。当前只原样复制并按实际字节哈希去重，不使用随机相机名、`Small` 或模糊匹配，也不声称已完成方向、色彩空间或尺寸规范化。

当前歌词只处理同目录 LRC：去除明确 artist 分隔前缀和曲目序号后，与 metadata title 或文件名做 Unicode 规范化精确匹配；同一 LRC 可绑定同标题的多编码版本。禁止跨目录或模糊猜配。VTT/SRT、内嵌字幕和普通文本歌词仍是后续范围。

- 同步歌词必须验证时间戳单调、非负且不明显超过歌曲时长。
- SRT/ASS 等来源转换为浏览器消费格式时保留原文，不自动润色或翻译。
- 无时间戳文本按普通歌词显示，不模拟逐行同步。
- 无歌词时显示双语空状态；不得从不明来源自动抓取歌词。
- 页面歌词文本与控件文案是两类数据：歌词保持原语言，应用 UI 只支持英文和简体中文。

## 静态媒体发布契约

计划在静态媒体源增加独立 `/music/` 命名空间，并与站内 `/music` 页面区分域名。不得借用 `tools/`、`stats/`，也不得把生产曲库复制进 Next `public`。

- 内容哈希音频、封面和歌词：`Cache-Control: public, max-age=31536000, immutable`。
- 曲库 manifest：浏览器缓存不超过 1 小时，推荐短 `max-age` 加较长 `s-maxage`；空清单、生成中和错误响应使用 `no-store`。
- 音频必须正确返回 MIME、`Content-Length`、`Accept-Ranges: bytes`，合法范围请求返回 `206` 和正确 `Content-Range`。
- 支持 `GET`、`HEAD` 和必要的 `OPTIONS`；CORS 只开放播放和清单读取所需方法与响应头。
- 禁目录列表、源路径泄露和临时扩展名访问；只发布清单引用的已验收文件。
- 发布采用版本目录或原子清单切换：先上传内容哈希资产，全部回读成功后再切换 manifest，避免清单先引用不存在的媒体。
- `staticUrl('/music/...')` 是客户端 URL 入口；不得硬编码静态域 origin。

第一阶段不需要后端代理音频。若以后引入权限曲目，必须另立 API、鉴权、Range 转发、缓存和带宽方案，不能复用当前公开静态 URL 假装有权限控制。

## UI、i18n、移动端与无障碍

- 页面采用音乐软件的信息层级：曲库/筛选、歌曲列表、当前播放详情与歌词、持续可见的播放控制。视觉继续使用站点主题 token，不复制上游全局 reset 或硬编码颜色。
- UI 文案只提供英文和简体中文，使用 `tr`、`T`、`useT` 或成对 locale JSON；禁止内联语言三元和单语裸文案。
- 根级播放器在 `I18nProvider` 外时复用 `DeskPet` 的显式语言契约，不能自行推断路径或建立第二套语言状态。
- 小于 480px 时歌曲列表、歌词和队列可以切换或使用底部面板，不能把桌面三栏硬压缩；控件适配触摸与安全区。
- 按钮使用真实 `<button>`，页面跳转使用真链接；拖动条有可访问名称、当前值和键盘步进。
- 播放、暂停、上一首、下一首、音量、循环和随机状态可由屏幕阅读器识别，不只依赖图标或颜色。
- 列表项和歌词行支持键盘焦点；快捷键不得拦截输入框、搜索框或屏幕阅读器常用按键。
- 封面具有与歌曲信息一致的替代文本；装饰性占位图使用空替代文本。
- 动画遵守 `prefers-reduced-motion`；歌词滚动不强制抢走用户手动阅读位置。
- 网络错误、解码失败、无歌词、空曲库和不可用曲目都有双语状态；单首失败不能中断整个队列。

## 上游、许可证与致谢

2026-09-02 通过各项目官方 GitHub 仓库和 API 核对的快照：

| 项目 | Stars | 许可证 | 固定基线 | 结论 |
| --- | ---: | --- | --- | --- |
| [LX Music Desktop](https://github.com/lyswhut/lx-music-desktop) | 53,272 | Apache-2.0 | `9c364b482e5621a1d38b50e8610d2fb974457e6e` | Electron/Vue 桌面应用；不适合移入 Next，只参考播放器信息层级 |
| [YesPlayMusic](https://github.com/qier222/YesPlayMusic) | 33,244 | MIT | `df075cca247eab7bf8686155cb8cc9a1f4c7e271` | Vue/Electron/PWA 且绑定第三方音乐服务；只作视觉参考 |
| [MusicFree](https://github.com/maotoumao/musicfree) | 26,527 | AGPL-3.0 | `d118b18b3d0c904400f7eea7bf99c0ceec6c1aee` | Android/Harmony 客户端，README 另有非商业请求；排除 |
| [Navidrome](https://github.com/navidrome/navidrome) | 23,302 | GPL-3.0 | `cb045b8ef3959f0ee225d65857b665dfc1508df4` | 成熟自托管音乐服务；以后需要账号和多端曲库时再评估，不进第一阶段 |
| [Koel](https://github.com/koel/koel) | 17,240 | MIT | `41cab99feeaf59b139699403fdfd41f0a280fb39` | Laravel/Vue 全栈音乐服务；运行时边界过重，排除 |
| [Feishin](https://github.com/jeffvli/feishin) | 9,724 | GPL-3.0 | `22649ef563895cc1c2443637d8d625689c2d6307` | 当前最好的 Web 播放器 UX 参考，支持同步歌词；不复制 GPL 源码和服务端适配 |
| [Black Candy](https://github.com/blackcandy-org/blackcandy) | 4,408 | MIT | `6c36030c60c6de223058e7beeca92582b173efaf` | Rails 自托管服务；不适合现有静态媒体边界，排除 |
| [Apple Music Like Lyrics](https://github.com/amll-dev/applemusic-like-lyrics) | 2,124 | AGPL-3.0 | `58ccd3ffae7ec4e9a6d1cdb0dd88ac8c767f68a8` | 逐词歌词最强候选，但 `react-full` 官方标记未完成且依赖重；当前排除 |

结论：第一阶段不复制任何候选源码、不安装播放器依赖，使用浏览器原生 `HTMLAudioElement`、Media Session 和项目内最小 LRC 解析器。Feishin 只提供 UX 参考；以后真需要多端服务端时优先单独评估 Navidrome；只有明确接受 AGPL 且需要逐词歌词时，才隔离验证 Apple Music Like Lyrics 的 `core + react`，不采用 `react-full`。

当前采用状态：`NO THIRD-PARTY CODE`，因此不新增 Credits。将来实际采用时只在 `core/packages/client/app/[lang]/about/credits_data.json` 登记一次；若 vendored 生成物进入仓库，再同步登记 `docs/generated-artifacts.json`。

## 测试矩阵

### 数据与播放器

- 清单 schema：合法数据、空曲库、重复 ID、坏 URL、非法时长、未知格式和旧版本拒绝。
- 分类：多艺术家、同名不同版本、缺 metadata、Unicode、大小写、人工覆盖和内容哈希去重。
- 歌词：LRC/VTT/普通文本、重复时间戳、超时长、无歌词和点击跳转。
- transport：播放/暂停、seek、音量、静音、上一首/下一首、队尾、循环、单曲循环、随机和失败跳过。
- 生命周期：从 `/music` 导航到其他页面后继续播放；页面和悬浮面板状态一致；刷新后的恢复不违反自动播放限制。
- 协调：歌曲与节拍器互斥，Timer hold 行为与改造前一致。

### 浏览器与网络

- 1440px 和 390px 实测页面、悬浮面板、队列、歌词和安全区，无横向溢出或遮挡。
- 英文和简体中文、浅色和深色主题均验证；长标题、长艺术家名和无封面不破版。
- 鼠标、键盘、触摸和屏幕阅读器语义可用；播放控件满足可见焦点和 reduced motion。
- Chromium、Safari/WebKit 和 Firefox 当前支持版本能播放选定唯一格式。
- 普通 GET、HEAD、首段 Range、中段 Range、尾段 Range、非法 Range 和跨域预检均按契约响应。
- 首次加载只获取清单和当前所需封面，不预取整个曲库或未播放音频。

### 转码与发布

- 对音频、视频、损坏文件、无音轨视频、重复内容、嵌入封面和多字幕流各建立小型 fixture。
- 每批记录源文件数、去重数、成功数、失败数、输入字节、输出字节、峰值空间、编码规范和工具版本。
- 发布后随机抽样不足以代替全集机器校验；manifest 中每个 URL 都要做存在性、字节数和 MIME 核对。
- 线上抽查实际 `206`、缓存头、CORS、播放和拖动，不以部署 workflow 绿色代替媒体可用性。

## 实施批次

| 批次 | 内容 | 状态 |
| --- | --- | --- |
| A | 建立跟踪表并加入文档索引 | `COMPLETED` |
| B | 完成 GitHub 上游调查，记录固定基线、许可证、采用与排除范围 | `COMPLETED` |
| C | 只读盘点 `E:\Music`，确定去重、分类覆盖、格式矩阵和精确空间预算 | `COMPLETED` |
| D | 冻结曲库 schema、转码规范、封面/歌词规则和 `Z:` 批次工具 | `IN PROGRESS` |
| E | 建立静态 `/music/` 媒体发布、原子 manifest、Range/CORS/cache 契约 | `IN PROGRESS` |
| F | 实现唯一音乐 transport、Media Session 及与节拍器的互斥协调 | `COMPLETED` |
| G | 实现 `/music` 页面、双语 metadata、首页卡片和搜索收录 | `COMPLETED` |
| H | 把 DeskPet 节拍器面板扩展为音乐/节拍器悬浮音频中心 | `COMPLETED` |
| I | 完成曲库转码、分类、封面和歌词清单，分批发布并回读验证 | `IN PROGRESS` |
| J | 完成数据、播放器、网络、桌面、窄屏、主题、i18n 和无障碍验收 | `PENDING` |
| K | 登记 Credits、生成物、最终证据和发布/回滚说明 | `PENDING` |

## 发布门槛

以下条件全部满足才可把状态改为 `COMPLETED`：

- 上游、固定 commit、许可证、复用范围和 Credits 已记录，没有来源不明的第三方代码或示例媒体。
- `E:\Music` 全程只读，有完整盘点与批次报告；`Z:` 每批遵守 1 GiB 输出上限，批次估算增加 15% 后仍须保留至少 20 GiB。
- `/music` 与 `/zh/music` metadata、首页卡片、搜索和真链接正常；没有重复目录事实源。
- 页面与悬浮播放器共享唯一 transport，跨页不中断；音乐与节拍器互斥，Timer 行为无回归。
- manifest 全集校验通过，所有发布 URL、MIME、字节数、封面和歌词引用有效。
- 静态媒体支持正确 Range、CORS 和缓存，清单可以原子回滚到上一版本。
- 桌面和窄屏、英文和简体中文、浅色和深色、键盘和触摸均有实测证据。
- 聚焦测试、客户端 typecheck、metadata/i18n/组件复用守卫通过；媒体发布后的线上播放和拖动已验证。
- 没有把生产音频、视频或大封面提交进 Git、Next `public`、`tools` 或 `stats`。

## 验收记录

- 2026-09-02：创建本跟踪表并登记文档索引；未修改播放器源码，未读取或改动 `E:\Music` 内容，未创建 `Z:` staging，未转码、上传、部署或提交。
- 2026-09-02：完成 8 个开源候选调查与 `E:\Music` 只读盘点；实现 `/music`、首页卡片、唯一浏览器 transport、同步 LRC、Media Session 及音乐/节拍器悬浮音频中心。媒体脚本以 9 个跨格式样本试跑成功并验证幂等，输出约 54.53 MiB；共享构建、客户端 typecheck、29 个聚焦测试及 1440px/390px Chromium 视觉验收通过。该阶段内容哈希去重、人工分类、全量转码和静态发布尚未完成，后续进展见下列记录。
- 2026-09-02：`scripts/music/prepare-music.ps1` 以 6 个普通批次处理 486 个唯一源，批次曲目数为 63、57、93、138、104、31，最大预计输出 1023.0 MiB；动作合计 copy 321、remux-audio 126、transcode-aac 39。所有批次保持并发 4、ffmpeg 每进程 2 线程、20 GiB 保留门槛与 15% 预估余量，失败 0。
- 2026-09-02：独立重算 486 个引用音频的输出 SHA-256 并逐首 ffprobe，486/486 通过，均为一个音频流、零视频流、正时长，最大清单时长差 0.512 秒；输出为 MP3 211、M4A/AAC 177、FLAC 71、WAV 27，共 5.009 GiB，486 个输出哈希全部不同。
- 2026-09-02：初次分类为钢琴与古典 133、爵士 50、影视原声 36、电子 25、流行与摇滚 56、BGM 与素材 39、音效 3、轻音乐与纯音乐 10、未分类 134；来源为 embedded-genre 64、explicit-top-directory 121、metadata-keywords 167、none 134。136 首缺艺术家时输出空字符串，未知艺术家字面值为 0。
- 2026-09-02：封面引用 61 首/8 个资产，其中 3 个同目录唯一 album cover 覆盖 55 首；歌词引用 16 首/15 个 LRC，其中 1 份精确绑定两种编码。8 张未精确匹配图片保留在人工队列，活动 `.part` 为 0。旧 Pilot 的 9 个未引用音频仍保留在 staging，但不进入 manifest，也不得发布。
- 2026-09-02：488 个媒体源中有 2 组字节完全相同的重复内容，共 4 个源文件、2 个冗余副本；486 个唯一内容保守识别出 12 组同目录同规范化标题候选（24 首），其中 10 组/20 首为不同扩展名编码，另 2 组/4 首为相同扩展名。未做声学指纹，不删除任何版本。
- 2026-09-02：再次读取 `E:\Music` 全部 521 个文件，路径、大小、mtime 与 521/521 SHA-256 均和原盘点一致，共 14.077 GiB；源盘未发生变化。零转码 replay 后 4 个稳定清单/索引文件与 520 个 library 文件的集合和哈希变化均为 0。最终 `Z:` 可用 29.354 GiB，未上传、未发布、未清理。
- 2026-09-02：逐首复核初次未分类曲目后，以保守的 artist/title/path 规则归类 126 首；最终为钢琴与古典 154、爵士 50、影视原声 56、电子 46、流行与摇滚 111、BGM 与素材 43、音效 3、轻音乐与纯音乐 15、未分类 8。来源为 embedded-genre 64、explicit-top-directory 121、metadata-keywords 293、none 8；剩余项继续进入人工队列，不按猜测归类。
- 2026-09-02：分类 replay 处理 486 首，重新转码 0、失败 0、人工复核 8；发布脚本只验证模式通过 486 首及 509 个唯一资产，共 5.01 GiB，manifest SHA-256 为 `960cd43f578e40b22d21018d1b0b93098818d45e191878f43e0bfba131775e07`，未连接远端或上传。
