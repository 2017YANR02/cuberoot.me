# CubeRoot 文档入口

这里按任务导航。跨模块合同放在本目录；模块自己的实现、命令和平台适配放在模块 README / docs；历史决策留在对应主题的 `history/`。当前实现以源码和配置核对，发布、设备与外部审核以各自证据核对。

## Agent 接手流程

1. 读取根 [AGENTS.md](../AGENTS.md)，检查 Git 状态；按任务加载其指向的贡献规则、目录内 AGENTS 与相关 skill。不要从历史记录推断新的执行授权。
2. 从下表进入一个专题。先读当前合同和跟踪表，再定位模块 README、manifest、源码、schema、migration 或 workflow；跨端任务必须继续读共享层与每个受影响宿主的边界。
3. 遇到“为什么这样设计”、替代关系或旧例外，再读专题 `history/`。保留决策的日期、适用条件、失败证据与尚未验收项，不把旧待办重新当成现行计划。
4. 修改前确认唯一维护位置；修改后按受影响路径做必要构建、检查和实际验收。源码存在、本地通过、已提交、已推送、已部署、真机通过、平台审核通过分别报告。
5. 同步当前合同/进度与必要历史依据；文件移动同时修复 Markdown、AGENTS、skill、源码、脚本、测试和 CI 引用。按[文档维护流程](contributing/documentation.md)校验后，再按当次授权提交或发布。

## 按任务进入

| 任务 | 阅读入口与下一步 |
| --- | --- |
| 开发环境、协作、验证与发布规则 | [贡献与工作流程](contributing/README.md) → 对应规则；新环境从 local-setup 开始 |
| 模块归属、共享契约、架构迁移 | [架构](architecture/README.md) → 当前跟踪表 → manifest / 边界守卫 |
| 五端 App 与计时一致性 | [App](product/apps/README.md) → 单一来源/三栏合同 → parity 与 inventory → 共享层及宿主 |
| 微信 / 抖音小程序 | [模块手册](../core/apps/miniprogram/docs/README.md) → 实现/原生计时/审核 → 构建及平台验收 |
| 会员、付款、权益与订阅 | [会员与支付](product/payments/README.md) → 具体渠道合同 → API / 服务商证据 |
| 备案、主体、认证和商店上架 | [合规](compliance/README.md) → 对应平台；App 和小程序当前进度仍在各自跟踪表 |
| 助手、工作台、复盘、赛事和社区产品 | [产品目录](product/README.md) → 对应专题 → 实现与验收记录 |
| WCA 数据、公式、翻译、统计与生成物 | [数据](data/README.md) → owner / 原始输入 / 生成与发布链；求解先读计算保护 |
| 故障、部署、监控、通知和远程接入 | [运维](operations/README.md) → 当前 workflow / ops；事故在主题历史中 |
| 排版、主题、素材、玻璃和 Space | [设计](design/README.md) → 共享组件/来源 → 浏览器或资产验证 |
| 文档归属、合并、迁移和引用修复 | [文档维护](contributing/documentation.md) → [路径对照](contributing/documentation-migrations.json) |

## 目录边界

```text
docs/
  contributing/   有效工作规则、开发环境、文档维护
  architecture/   跨模块边界、共享契约、迁移跟踪
  product/        产品合同、当前进度、验收及主题历史
  compliance/     备案、认证、商店与渠道申请
  data/           数据管道、生成物、原稿/审校证据、求解统计
  operations/     运维手册、监控与事件历史
  design/         视觉合同、素材和场景设计
core/apps/<app>/
  README.md       模块职责、源码入口和本模块命令
  docs/           确有需要的平台手册；不复制跨端合同
core/packages/<package>/README.md
                  共享包公开出口、消费者与验证入口
```

`core/docs/` 已撤销，原资料归入产品主题或小程序模块。`research/reconer/`、`solver/`、`ops/`、`core/jobs/`、`core/scripts/` 保留就近文档与独立入口；进入研究/求解目录先读其专属规则。`tools/`、`vendor/` 等第三方文档保持原结构，产品 URL `/docs` 和 `/documentation` 也不属于本次目录迁移。

## 如何判断资料用途

| 类型 | 用法 |
| --- | --- |
| AGENTS / contributing / skill | 当前工作指令；按任务加载，不能用实现现状覆盖授权和保护要求 |
| 当前合同、REFERENCE | 描述职责、接口与维护方式；实现变化时同步 |
| ACTIVE / 当前跟踪 | 记录下一步和独立验收边界；与源码冲突时先核对事实再修文档 |
| COMPLETED / HISTORICAL / history | 保留当时的决策和证据；不代表后续版本已经通过，也不作为当前待办 |
| RETIRED | 退役模块；保留历史，不继续构建、测试或开发，恢复须另有授权 |

专题索引负责导航，正文负责合同，跟踪表负责进度，源码/schema/workflow 负责实现事实。平台状态以最近一次明确证据为准，不能仅凭代码和日期推算审核通过。
