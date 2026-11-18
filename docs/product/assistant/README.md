# 聊天助手

先读回答与工具设计，再查质量跟踪和对应实验；基准分数必须绑定版本、语料及环境，历史线上验收不能证明后来的候选版本。

事实源：core/apps/api 中 assistant 路由、工具和检索；共享协议；benchmarks 固定案例。

开始：[本专题入口](assistant-design.md)。

## 分主题

- [benchmarks](benchmarks)

## 文档与登记

- [回答朗读与百炼语音配置](assistant-speech.md)

- [聊天助手的回答与工具设计](assistant-design.md)
- [聊天助手质量改进跟踪](assistant-quality-tracker.md)
- [AI 二阶魔方实验](cube-agents.md)
- [Assistant on-demand analysis](site-assistant-analysis.md)
- [站内问答响应时间目标](site-assistant-performance.md)
- [AI 高频问题与性能验收题库](site-assistant-questions.md)
- [Agent 分层上下文真实模型对照（2026-11-15）](benchmarks/assistant-context-evaluation-2026-11-15.md)
- [Agent 约束、百科核验与耗时优化复测（2026-11-15）](benchmarks/assistant-context-followup-2026-11-15.md)
- [Agent 缩写展开与首次答案复测（2026-11-15）](benchmarks/assistant-context-expansion-latency-2026-11-15.md)
- [百科核验与详细计划耗时复测（2026-11-15）](benchmarks/assistant-glossary-plan-latency-2026-11-15.md)
- [复杂计划与百科来源边界复测（2026-11-15）](benchmarks/assistant-plan-source-contracts-2026-11-15.md)
- [Agent 语义、来源范围与子项时长复测（2026-11-16 UTC）](benchmarks/assistant-semantic-duration-2026-11-16.md)
- [Agent 剩余语义问题与两项退步复测（2026-11-15）](benchmarks/assistant-semantic-eight-2026-11-15.md)
- [Agent 十条剩余问题与七条退步复测（2026-11-15）](benchmarks/assistant-ten-issues-2026-11-15.md)
- [CubeRoot site assistant](site-assistant-tracker.md)

## 历史依据

按需追溯决策、失败及验收限制；旧待办、状态和授权只适用于记录时点。

- [助手 RAG 与上下文记忆优化：本地实施记录](history/assistant-rag-memory-optimization-2026-11-12.md)
- [魔方根助手：真实模型优化前后对照](history/assistant-real-model-evaluation-2026-11-12.md)
- [助手回归修复与长尾优化复测](history/assistant-regression-evaluation-2026-11-12.md)
- [助手首次转动、DNF 与响应成本修复](history/assistant-trigger-dnf-evaluation-2026-11-12.md)
- [Web Agent 进度与耗时测量](history/assistant-web-progress-2026-11-12.md)
- [AI 高频问题实测记录（2026-09-28）](history/site-assistant-benchmark-2026-09-28.md)
- [DeepSeek 高频问题实测（2026-09-28）](history/site-assistant-benchmark-deepseek-2026-09-28.md)
