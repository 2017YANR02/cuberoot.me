# 计时与训练

先按智能魔方、训练迁移或统计任务读对应合同，再定位共享 UI 与领域逻辑；涉及求解运行须另读计算保护。

事实源：core/packages/timer-ui、shared；Web timer；宿主 capability adapter。

开始：[本专题入口](timer-training-migration-tracker.md)。

## 单人计时页的三个区域

自 2026-11-21 起，产品需求、代码评审和布局验收统一使用以下名称。区域按功能命名，旋转屏幕或移动面板后仍沿用原名。

| 区域 | 对应界面与职责 |
| --- | --- |
| **解法区** | 灯泡打开的面板。针对当前打乱提供求解，包含「解法」和「分步解法」。 |
| **计时区** | 显示当前打乱、计时读数和魔方状态，接收开始、停止计时等操作。左下角的成绩摘要是进入复盘区的入口。 |
| **复盘区** | 展示实际计时和还原记录，包括成绩列表、统计、智能魔方的「实时解法」和停表后的复盘。「实时解法」展示用户已经转过的步骤，归入复盘区。 |

**折叠屏布局。** Duo 半展开且折痕横贯屏幕时，下半屏固定为计时区，上半屏始终显示解法区或复盘区。用户通过原有灯泡和成绩摘要入口选择；收起一个区域后，上半屏继续显示另一个。复盘区没有转动记录时仍可显示成绩列表或统计。折痕纵贯屏幕时按左右分区，两种方向都要完整避开系统报告的折痕范围。

## 分主题

- [benchmarks](benchmarks)

## 文档与登记

- [随机状态来源的「难度」(cross-trainer) — 跟踪](cross-trainer-difficulty.md)
- [双底 ZBLL](double-zbll-trainer.md)
- [多智能魔方训练](multi-smart-cube-training.md)
- [Timer 最少步求解优化跟踪](timer-optimal-egg-tracker.md)
- [/timer 智能魔方全覆盖 + 功能补齐](timer-smartcube-plan.md)
- [完整训练器迁入计时器跟踪表](timer-training-migration-tracker.md)
- [训练统计](training-statistics.md)

## 历史依据

按需追溯决策、失败及验收限制；旧待办、状态和授权只适用于记录时点。

- [/timer 设置审计（2026-10-16）](history/timer-settings-audit-2026-10-16.md)
