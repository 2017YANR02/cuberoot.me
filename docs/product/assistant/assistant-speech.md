# 回答朗读

本地实现，尚未部署或完成真实百炼音频验收。入口为回答工具栏的「朗读」。

## 调用与播放

`POST /v1/site-assistant/speech` 复用聊天的账号与 WCA 资格校验。请求携带 messageId（优先）或旧 requestId、清洗后的预期回答、语言及分段序号。服务端只读取本人已完成的持久回答；旧问答从监控的 answer 与 response 组合恢复，已清理的历史记录不可合成。服务端复用 shared 的 `assistantAnswerText` / `assistantSpokenText`，逐字比较预期朗读内容，拒绝内容已变更或任意文本代传。

第一版使用百炼 HTTP 非流式语音合成，每段约 500 字符，整条回答不超过 30,000 UTF-16 码元。首段完成后开始播放，后续段按顺序请求；没有实现 SSE 音频流或预取，因此段间可能有等待。服务端下载 MP3 后返回 Base64，浏览器使用私有 Blob URL 播放并及时释放。

点击停止、播放另一条、切换回答或卸载组件会取消请求与播放；浏览器禁止自动播放、服务未配置或合成失败时，显示「使用浏览器朗读」，由用户点击后启用原有系统语音，不自动重播全文。停止本地请求不能保证供应商已执行的合成不收费。

## 配置

在 API 运行环境配置（模板见 `core/apps/api/.env.example`）：

- `SITE_ASSISTANT_TTS_ENABLED=1` 开启，默认关闭。
- `SITE_ASSISTANT_TTS_BASE_URL`：北京业务空间 HTTPS origin，例如 `https://ws-业务空间ID.cn-beijing.maas.aliyuncs.com`，不含 API 路径。
- `SITE_ASSISTANT_TTS_API_KEY`：可独立配置；留空复用 `SITE_ASSISTANT_API_KEY`，须具有同地域的语音模型权限。
- `SITE_ASSISTANT_TTS_MODEL` 默认 `qwen-audio-3.1-tts-flash`。
- `SITE_ASSISTANT_TTS_VOICE` 默认 `longanhuan_v3.1`，需与所选模型匹配。

供应商地址仅允许北京 workspace；音频仅允许北京 OSS HTTPS 地址，禁止重定向。按实际供应商返回域名验收，不能为绕过失败开放任意下载地址。官方依据：[非实时语音合成](https://help.aliyun.com/zh/model-studio/non-realtime-tts-user-guide)、[HTTP API](https://help.aliyun.com/zh/model-studio/qwen-audio-tts-http-api)。

## 缓存与用量边界

音频内存缓存按账号、地域、模型、音色、语言和分段文本哈希隔离；内容变化后重新生成，相同分段可复用。缓存最长 10 分钟、最多 128 段/32 MiB；响应一律 private, no-store，不提供公开音频链接。每次请求重新验证归属和回答内容，缓存不能绕过鉴权。

每账号每分钟最多 30 次请求；每进程每账号每天最多请求合成 30,000 UTF-16 码元（UTC 日界，失败也计数），同一账号最多 1 次在途合成，全进程最多 4 次。单段请求与下载共享 45 秒期限，音频上限 4 MiB。限流与日用量是进程内保护，重启会重置，多进程不共享，不能视为持久账单硬限额；正式启用时应配合百炼账户预算。

`assistant_tts` 结构化日志记录模型、输入码元数、耗时和成功状态，不记录文本、密钥或音频地址。该记录不等于供应商的计费字符数或实付金额，尚未并入助手数据库费用报表。

## 验证

服务端测试覆盖鉴权、回答归属/内容变化、分段、缓存隔离、下载地址和并发取消；客户端测试覆盖按序播放、停止后不续播、Blob 释放、播放失败和手动回退。真实凭据、目标业务空间及浏览器音质/首音延迟需在启用前完成实测；本地测试不能替代该验收。
