# 拍照查公式

入口：英文 `/alg/photo`，中文 `/zh/alg/photo`；三阶公式库和全站工具搜索提供入口。原 `/dev/cube-photo` 保留同一组件，方便继续实拍测试。

## 两个执行入口，共用计算内核

- 独立页面在浏览器中读取、缩图、识别、推导和模拟验解，计算放在 Worker。只从既有公式 API 读取公开公式数据，不上传照片。
- AI 对话先保存私有图片，再把图片交给支持视觉的模型理解提问。模型通过 `lookup_cube_photo` 传入当前/历史消息的 `imageRef`，服务端 Worker 解码图片并运行同一套计算。模型不能向工具传任意 URL 或自行猜测的色块。
- `@cuberoot/shared/cube-photo/*` 是识别、状态恢复、类别选择、公式匹配与验证的单一实现；浏览器和 Node 仅适配解码、Worker 与公式数据加载。

三种分类固定如下，各类别最多一条公式，均独立从照片状态出发：

| 识别状态 | 返回类别 |
| --- | --- |
| 顶层十字未完成 | OLLCP、1LLL、OLL |
| 顶层十字完成、顶面未完成 | ZBLL、OLL、COLL |
| 顶面完成 | PLL |

已复原时不列公式；只差 AUF 时返回 AUF。请求指定类别时只查询适用类别。公式来自现有 PG 公式库，保留库中排序，模拟验证阶段目标与前两层；输出包含持方 U/F/R、前后 AUF、完整动作串和规范 case 链接，不临时生成替代公式。

## 识别与校正

使用标准配色，假设前两层已复原；手遮挡下两层不影响所需观测。必须拍到完整顶面及两个相邻侧面的顶层。下两层边界只是透视推算，不声称验证了遮挡部分。当前检测适用于顶面在上、适度倾斜的三面视图。

边界使用 RGB 梯度、直线候选、透视网格评分；相邻方向组允许重叠，减少缩图微小差异使收敛边界落入不同组的漏检。长边归一到 640 像素，两端使用相同区域平均缩图。颜色置信门槛、魔方合法性和前两层约束分别检查；合法状态不等于照片一定识别正确。

未找到网格、颜色不确定、状态不合法或有歧义时，不给公式。页面保留角点、颜色和持方校正。聊天结果提供 `/alg/photo?attachment=<id>`：所有者登录后读取原私有图片，随后在本地重新识别和校正。当前校正结果不会自动回写旧聊天答案。

## 聊天与图片数据

- `POST /v1/site-assistant/attachments` 保存经前端重编码、去除元数据的图片，返回 UUID 引用。数据库按账号、会话和内容哈希去重。
- `GET/DELETE /v1/site-assistant/attachments/:id` 都限制所有者；读取 `no-store`，删除为软删除。引用在调用模型和扣问答额度之前校验。
- 每图最多 768 KiB；每账号累计图片数据上限 100 MiB（含软删除数据）。不建立公开图片 URL，不使用文章图片存储。图片本身保存在服务端；聊天记录继续沿用现有页面会话/置顶持久化规则，并未新增云端会话同步。
- 工具结果不携带图片字节。`cube-photo` 卡片直接渲染经过验证的公式，模型只简述确定的阶段与结果；保留当前及历史图片引用。明确的魔方图片公式查询若被模型直接回答，会要求其通过原生工具选取图片和类别；取得工具结果前不展示那段草稿。复制、文本分享与 PDF 导出保留公式和 case 链接，不导出私有图片引用。
- 独立页面和聊天卡片都复用 `PhotoAlgorithmCards`；case 链接使用计时器已有 `ReconCaseLink` → `AlgCaseView embedded`，保留完整页链接、遮罩/Escape 关闭及外层标题。

## 服务端构建与资源边界

Node Worker 每进程最多并发 2 个任务，单任务 20 秒截止、128 MiB V8 old-generation 限额；解码限 1600 万像素，随后缩小计算。取消或超时终止 Worker。原生解码内存不包含在 V8 限额内，因此仍限制输入像素、并发和 Sharp 缓存。

`pnpm --filter @cuberoot/server build:cube-photo` 构建 `dist/photo-runtime/worker.mjs`，同时收集当前平台的 Sharp 及原生依赖。`build:bundle` 和普通 server test 命令会先执行此步骤。部署 workflow 在 Linux 构建并随主 bundle 原子发布整个 `photo-runtime`；不能把 Mac 的原生产物上传到 Linux。

数据库变更是 `0308_assistant_private_attachments.sql`，随现有发布流程应用；不手工修改生产表。尚未发布时，开发页面的独立工具可运行，走线上 API 的聊天尚不能使用新附件和工具能力。

## 本轮验证

- 两张维护者实拍图自动恢复到预期状态：第一张返回 OLLCP13 6 / 1LLL J+R2 / OLL 13；橙色侧面图返回 ZBLL UB3 / OLL 23 / COLL U2。私人原图不提交仓库。
- 浏览器验证橙色实拍识别、公式链接、嵌入 case、关闭返回和标题保持。
- 自动回归覆盖三分支完整像素链路、透视/遮挡/压缩、颜色校正、AUF、非法与歧义状态、图片所有权、历史图片工具调用、公式原文复制/导出、嵌入窗口和独立发布目录加载原生依赖。
- 使用生成的 PLL 图实际调用已配置视觉模型，验证主动选择工具、读取公开公式库和返回 T 公式；这不等于已完成线上发布验收。
- PG13 事务内验证附件迁移、去重与所有者查询后回滚；shared 构建、两端类型检查、API bundle 和架构/路由契约检查通过。

针对性检查（在 `core/`）：

```sh
pnpm --filter @cuberoot/shared build
pnpm --filter @cuberoot/server build:cube-photo
pnpm --filter @cuberoot/server exec vitest run tests/site_assistant_cube_photo.test.ts tests/site_assistant_attachments.test.ts tests/site_assistant_model.test.ts
pnpm --filter @cuberoot/client exec vitest run tests/cube-photo.test.ts tests/cube-photo-state.test.ts tests/cube-photo-chat.test.ts
```
