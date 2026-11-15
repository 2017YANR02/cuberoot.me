# /sim 拼图浏览器验收记录

日期：2026-10-17。范围：本地 Chromium 桌面浏览器，默认引擎，动画 → 作图「当前状态」。仅本地提交，未推送或部署。

## 后续界面调整（2026-10-20）

播放设置中的锚定使用固定标签与共享滑块，切换时显示「起点／终点」，沿用原有播放锚定状态及拼图支持限制。

公式集选择器随当前名称宽度调整，右侧搜索按情况名称和公式内容过滤，仍使用原情况索引加载公式与初始状态。播放行的 TPS 靠左、五个播放按钮整体居中、设置齿轮靠右。

动画页移除伴图入口，旧 `img_*` 参数和伴图偏好不再打开动画伴图；作图模式保留状态图与导出。背景和阶段显示调整紧跟画布下方的视角工具，靠左同排；TPS、播放按钮和设置齿轮共用进度条下方一行。播放设置复用设置浮层，向上展开且不改变正文布局。结构研究入口暂停展示，页面不再导入或挂载其面板；相关引擎与研究源码保留。此调整未重新执行下述浏览器验收，原记录仅代表当时版本。

## 已完成范围

- 菜单中的 101 个入口均有基础样例；NxN 选择 2、3、7 阶，共 103 个样例，包含全部 77 个 PG 项目及自定义切割默认配置。
- 每个样例核对加载后的播放进度、从起点前进一步、跳至末尾、切换作图、实际 SVG 下载；最终文件均非空、有图元且通过 XML 解析。表中记录实际使用的公式及 SVG 文件哈希前 12 位。
- PG 样例同时从页面随机打乱取得该拼图的有效记号，再选两步进行验收；这不是全状态或全记号穷举。
- 23 个支持本站 MP4 导出的样例均下载成功：H.264、1920×1080，ffmpeg 每秒抽取两帧后均存在不同解码图像，排除了只有静态片头片尾的情况。其余拼图的录制按钮为禁用。
- PNG 另验证魔表／NxN 展开图的既有路径，以及本轮修复后的 Radio Web、Pyramorphix 两条 PG 路径；Radio Web 文件确认为 2048×2048，并目视检查图片内容，Pyramorphix 确认下载成功。PNG 未逐一重复全部 103 项。
- 类型检查 `pnpm --filter @cuberoot/client typecheck` 通过。定向回归覆盖冷启动／异步重放 9 项、Twisty 外部播放初始化 2 项、视频记号 5 项、截图分流 3 项；未运行全量测试或 Next 构建。

## 本轮发现与修复

| 提交 | 问题与修复 |
| --- | --- |
| `09a39fe2e9` | 引擎未创建时播放按钮提前启用；等待当前引擎就绪。 |
| `9c2a53d637` | cubing.js 初始化默认落到末尾；外部播放通过 timestamp 属性从起点开始。 |
| `86d90b968c` | 播放器未创建时随机打乱无效；同步禁用该入口。 |
| `091fea6866` | 原生 PG 控制区把作图小窗画布挤成 0 高度；小窗隐藏手动控件，动画主视图保留。 |
| `6c14b504d9` | 通用展开器破坏 Square、角转／棱转记号，产生静态 MP4；让原生引擎使用其自己的记号。 |
| `450e1c3ed6` | NxN／镜面异步 setup 未结束时点击被忽略；重放完成前禁用播放和进度控制。 |
| `4e8eccd5c8` | 上游 PG 离屏 PNG 截图等待不返回；PNG 复用当前场景 SVG，再用现有工具栅格化。 |

## 验收样例

视频列的数字为时长（秒）；“不支持”表示按钮已禁用。SVG 哈希对应验收下载文件，不是源码哈希。

| 拼图 ID／阶数 | 公式 | 末步 | SVG 图元 | SVG SHA-256 前缀 | MP4 秒／不同采样帧 |
| --- | --- | ---: | ---: | --- | --- |
| pyraminx | `R U` | 2 | 2808 | `291780ef3350` | 5.5 / 11 |
| skewb | `R U` | 2 | 2819 | `fbd75a1ca944` | 5.5 / 11 |
| megaminx | `R U` | 2 | 8645 | `46eff0a937f1` | 5.5 / 11 |
| kilominx | `R U` | 2 | 321 | `a81b47ec2c18` | 不支持 |
| ivy | `R L` | 2 | 2652 | `efd5292ad12b` | 5.5 / 11 |
| dino | `UFR UFL` | 2 | 2336 | `483f194f247b` | 5.5 / 11 |
| redi | `R F` | 2 | 4337 | `0fc66593c0a2` | 5.5 / 11 |
| rex | `UFR UFL` | 2 | 6935 | `bda2e5aa506c` | 5.5 / 11 |
| heli | `UF UR` | 2 | 2682 | `a39dbcd074a1` | 5.5 / 11 |
| gear | `R U` | 2 | 99109 | `3652e1bae598` | 5.5 / 11 |
| mirror | `R U` | 2 | 4689 | `2a6e9e55d0b3` | 5.5 / 11 |
| mirror2 | `R U` | 2 | 2378 | `619f28e93df5` | 5.5 / 11 |
| sphere | `R U` | 2 | 10470 | `cabf4b5242ef` | 5.5 / 11 |
| sq2 | `(1,0) /` | 2 | 4559 | `be0a6e0972f5` | 5.5 / 11 |
| sq4 | `(1,0) /` | 2 | 5890 | `856064dbd48d` | 5.5 / 11 |
| pyraminx_duo | `R U` | 2 | 1297 | `270f2a41c89e` | 5.5 / 11 |
| ghost | `U29° D35° R U` | 4 | 1458 | `5aeda3998724` | 9.5 / 19 |
| magic | `F F` | 2 | 57 | `e929b22e7bb0` | 5.5 / 11 |
| mmagic | `F F` | 2 | 1292 | `9001f082ac99` | 5.5 / 11 |
| littlechop | `DL' DR` | 2 | 6 | `b593ec07e17c` | 不支持 |
| curvycopter | `2FL UL` | 2 | 31 | `b0b9bc786dda` | 不支持 |
| compycube | `DLB' UFR'` | 2 | 22 | `84aeced4f2e6` | 不支持 |
| masterskewb | `2DFL DLB'` | 2 | 21 | `aa50e365d9b1` | 不支持 |
| professorskewb | `2UBL' 2DFL'` | 2 | 40 | `1907f57aeb4e` | 不支持 |
| pyramorphix | `RD' DL'` | 2 | 8 | `877cc9dbac71` | 不支持 |
| mastermorphix | `2LF DF` | 2 | 32 | `7012d1b3c492` | 不支持 |
| masterpyramorphix | `DL' LF'` | 2 | 35 | `3c4832a2e69e` | 不支持 |
| tetraminx | `L R'` | 2 | 22 | `ab60bdb6d934` | 不支持 |
| masterpyraminx | `BR R'` | 2 | 38 | `07812beeb83b` | 不支持 |
| mastertetraminx | `2L F` | 2 | 41 | `4c300681368e` | 不支持 |
| professorpyraminx | `L' F'` | 2 | 55 | `f31fa4ae2d25` | 不支持 |
| professortetraminx | `F' R` | 2 | 57 | `bb9a49134cdf` | 不支持 |
| royalpyraminx | `R 3D'` | 2 | 80 | `8b78f17e25f5` | 不支持 |
| royaltetraminx | `3L 2BL'` | 2 | 84 | `c3bba335e633` | 不支持 |
| emperorpyraminx | `3D' 3L'` | 2 | 109 | `d7fde5b19d3c` | 不支持 |
| emperortetraminx | `3L U` | 2 | 106 | `b5f674914621` | 不支持 |
| jingpyraminx | `BL L` | 2 | 31 | `6a683da49e90` | 不支持 |
| masterfto | `2F' L'` | 2 | 59 | `116c158166cb` | 不支持 |
| skewbdiamond | `BR BL'` | 2 | 21 | `49be62926a49` | 不支持 |
| christophersjewel | `2DBRRF' 2DBRRF'` | 2 | 26 | `7650aabd1db5` | 不支持 |
| octastar | `FL BRBB` | 2 | 21 | `5017a2a4cc24` | 不支持 |
| petaminx | `B 3FL` | 2 | 3200 | `4d0feb6b0ac0` | 不支持 |
| examinx | `5DL 6R` | 2 | 4822 | `11f2517accf3` | 不支持 |
| zetaminx | `F' 6DR'` | 2 | 6744 | `c78eb9ec13e6` | 不支持 |
| yottaminx | `3FL 2L'` | 2 | 8984 | `cfea6c684b78` | 不支持 |
| pentultimate | `FL' F'` | 2 | 43 | `78ea217cab4e` | 不支持 |
| masterpentultimate | `DR' 2U'` | 2 | 154 | `04fbed55ceda` | 不支持 |
| elitepentultimate | `DR F` | 2 | 487 | `d3599a3fed7c` | 不支持 |
| starminx | `2ULF DBFE'` | 2 | 57 | `7c5b67bd5251` | 不支持 |
| starminx2 | `DL' 2BL'` | 2 | 66 | `a4e865a639f5` | 不支持 |
| pyraminxcrystal | `D' BL` | 2 | 70 | `faaa0752ea4e` | 不支持 |
| chopasaurus | `FAC' UBLL'` | 2 | 93 | `c9fc37e1d923` | 不支持 |
| bigchop | `UF IBL'` | 2 | 34 | `a1a79ceb8e61` | 不支持 |
| radiochop | `M' D` | 2 | 253 | `d35bc2bf4d06` | 不支持 |
| astrominx | `FUQPL' 2FUQPL` | 2 | 88 | `256ef597f0ac` | 不支持 |
| astrominxbigchop | `EI KO'` | 2 | 247 | `0cd0e06113ff` | 不支持 |
| redicosahedron | `2FREGU' 2NALPO'` | 2 | 98 | `283cd118935a` | 不支持 |
| redicosahedroncenters | `2HIERC' BKMJS'` | 2 | 159 | `08f234e2a568` | 不支持 |
| icosaminx | `FLACR 2UGJMQ'` | 2 | 154 | `9126c72c9533` | 不支持 |
| eitansstar | `F' 2F` | 2 | 208 | `a457543bf26f` | 不支持 |
| cube2dino | `2DBR DRF'` | 2 | 8 | `ab43ea39a319` | 不支持 |
| cube2littlechop | `BR FL'` | 2 | 5 | `fcf0ddf02b19` | 不支持 |
| dinolittlechop | `2DRF' BL` | 2 | 10 | `a7cfe2da94f1` | 不支持 |
| cube2dinolittlechop | `DF' U'` | 2 | 13 | `d37213ee4719` | 不支持 |
| megaminxchopasaurus | `D_FR_FL' U_L_F'` | 2 | 92 | `680fa68b4608` | 不支持 |
| starminxcombo | `D_FR_FL' L` | 2 | 59 | `f4865ac1ab72` | 不支持 |
| superz | `L DLB'` | 2 | 13 | `4531573b9852` | 不支持 |
| cube3dino | `R DRF'` | 2 | 16 | `deb2edc129c8` | 不支持 |
| dogic | `FLACRw' FUQPL'` | 2 | 43 | `44882fd37b47` | 不支持 |
| octahedron4 | `DBLBBBR' UBBBLLw'` | 2 | 16 | `32d51c9cd36e` | 不支持 |
| dinoskewb | `DRF' DFLw'` | 2 | 17 | `38d27d203a5d` | 不支持 |
| lattice | `UFR ULFw'` | 2 | 13 | `1b6efef1b2f3` | 不支持 |
| hyperx | `L DRF'` | 2 | 28 | `4340927a280b` | 不支持 |
| latticex | `D URB` | 2 | 11 | `f229fa7b8667` | 不支持 |
| masterbrilic | `DL' 1-2L` | 2 | 339 | `42526ea0da82` | 不支持 |
| masterftov2 | `U' 1-2R` | 2 | 197 | `989ad03862d7` | 不支持 |
| quadx | `UR UBw` | 2 | 23 | `d1019138d310` | 不支持 |
| dinoocta | `BL' 1-2B'` | 2 | 43 | `d16ffd2d326d` | 不支持 |
| fto5 | `B' 1-2U'` | 2 | 92 | `245cce39ee65` | 不支持 |
| fto6 | `U 1-2B'` | 2 | 128 | `2a01e35954a4` | 不支持 |
| eto | `BLD FLw` | 2 | 80 | `fc615fe6eb2f` | 不支持 |
| radiocrystal | `A' Ew'` | 2 | 270 | `e494b60112bc` | 不支持 |
| cube3skewb | `U' UBL'` | 2 | 107 | `349190dc17f2` | 不支持 |
| heliskewb | `DBR' DF'` | 2 | 10 | `147e37a18a50` | 不支持 |
| comboctahedron | `D D_BL_B_BR` | 2 | 26 | `4f5121c05ca4` | 不支持 |
| circoradiolarian | `P' Cw'` | 2 | 337 | `7b12958b5832` | 不支持 |
| icosababyface | `UGJMQ' BKMJSw'` | 2 | 17 | `9ee7f1c3dbe7` | 不支持 |
| cube2heli | `BL B'` | 2 | 10 | `9b89e4ac4c33` | 不支持 |
| cube3heli | `L UB` | 2 | 145 | `7c69bdfff5d3` | 不支持 |
| radiojewel | `O' Iw'` | 2 | 309 | `bc46b0651717` | 不支持 |
| radioweb | `G Rw` | 2 | 886 | `d7d8889acdd2` | 不支持 |
| catscradle | `L Gw` | 2 | 499 | `f4117efd91c2` | 不支持 |
| trajbersoctahedron | `DBRRF UBBBLL` | 2 | 45 | `876f3804fd9a` | 不支持 |
| gigaminx | `DL 3BR` | 2 | 573 | `b903fdac7dc6` | 不支持 |
| teraminx | `2R F'` | 2 | 1753 | `b33b4d2df166` | 不支持 |
| icosamate | `BKMJS' OKBDN` | 2 | 42 | `30409f57b0a5` | 不支持 |
| custom | `L' B` | 2 | 17 | `7b8757dedf23` | 不支持 |
| sq1 | `(1,0) /` | 2 | 5774 | `c975f9f5140d` | 5.5 / 11 |
| 2 | `R U` | 2 | 2299 | `978310f9b3ee` | 5.5 / 11 |
| 3 | `R U` | 2 | 3621 | `802550222607` | 5.5 / 11 |
| 7 | `Rw U 3Rw'` | 3 | 16583 | `ca4b3daff462` | 7.5 / 15 |
| fto | `R U` | 2 | 3674 | `ce046d81fd75` | 5.5 / 11 |
| clock | `UR1+ DR2+ y2 U3-` | 4 | 342 | `10033329b7a7` | 不支持 |

## 验收边界与待办

- 未包含每个拼图的所有记号、全部手势／拖拽、全部渲染器组合、键盘无障碍、所有尺寸与高阶极限、性能和长期资源占用。MP4 帧变化能证明有动画，不替代逐帧几何正确性检查。
- 自定义切割仅检查默认配置；NxN 未穷举全部阶数。
- Trajber’s Octahedron、Gigaminx、Teraminx、Icosamate 首次打开时自动化定位超时，复查通过；不能据此宣布冷加载性能已验收。
- 本轮没有 iPhone 真机证据；设备暂不可用，触摸和系统键盘验收继续保留。
- 当前结论只覆盖本地源码与上述浏览器样例，不代表线上部署、原生客户端或全部报告建议已完成。
