# 好友聊天表情包（2026-09-28）

状态：本地实现与验证完成，未发布。微信专属图片集尚未接入。

- 共享 ChatPanel 提供系统 emoji 分类与肤色选择，Unicode 数据来自 MIT 许可的 `@emoji-mart/data`，首次打开时加载；Apple 设备使用系统字体，不分发 Apple 图片。
- 表情包支持 PNG、JPEG、GIF、WebP，单张最多 2 MiB，边长最多 4096；不重编码原文件，保留动画与透明度。上传先收藏并预览，点击发送后才产生消息；图片消息保留未发送文字草稿。
- 账号收藏跨设备读取，最多 100 个；每天最多上传 50 个，上传总量最多 100 MiB。取消收藏不删除已发送图片。
- 图片通过带会话凭据的请求读取，服务端检查上传者、收藏关系或聊天参与关系，禁止公共缓存；浏览器使用临时 Blob URL，卸载时撤销。
- migration `0250_chat_stickers.sql` 增加图片表、收藏表和消息图片 ID；现有文字与幂等重试保留。注销清理收藏及无人持有的图片，其他人的收藏或转发副本保留并去除上传者关联；现有账号合并限制继续生效。
- nginx 的 `/v1/chat/stickers` 上传上限同步为 2 MiB。发布时需包含 API migration、Web 与 nginx，不可只发前端。

## 验证证据

- shared build、app-ui / API / client typecheck 通过；架构边界和账号流程文档守卫通过。
- 聊天组件、状态机、HTTP/文件头校验、账号清理和相关文档/缓存/组件守卫测试通过。
- PostgreSQL 16 临时本地实例：`tests/fixtures/friend_chat_pg.ts` 35 项检查通过，覆盖越权读取、原始 GIF 字节、发送与重试、收藏、拉黑/解除好友、注销后图片保留和清理。测试数据库自动删除，临时服务已停止；未操作生产数据。
- Playwright + 本机 Chrome：真实 `/zh/friends` 页面、隔离的模拟账号/API，验证上传→预览→发送→刷新收藏、文字草稿保留、emoji 插入；390px 和桌面、系统明暗与手动明暗四种组合，未见横向溢出或页面错误。这不代表线上或 iPhone 真机验收。
- 添加依赖后发现 `three-bvh-csg` / `three-mesh-bvh` 的声明解析到了 cubing 的旧版 Three 类型；通过 pnpm packageExtensions 显式绑定匹配版本。锁文件保留其他包的原版本。

## 图片来源与待办

微信专属小黄脸和系统 Unicode emoji 是不同资源。查阅的非官方库 [wechat-emojis](https://github.com/xxk8/wechat-emojis) 明确说明图片归腾讯所有、仅限个人学习和非商业用途；没有将这套图片复制进网站。若需要原版微信表情，仍需确定可用于本站的素材来源。

本轮工作树已有其他改动，分支核对时领先 origin/main 82 个提交、落后 1 个，因此没有将本轮直接推送上线；其他工作保持原状。
