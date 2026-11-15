# 会员与支付

先读[会员契约](MEMBERSHIP.md)，再按场景进入网站准入、微信续费、Google Play 内购或共享结算文档。源码、商户配置、测试付款与公开开放分别核对，历史状态不用于恢复线上开关。

| 任务 | 入口 |
| --- | --- |
| 权益、订单、支付通道与保留决策 | [会员契约](MEMBERSHIP.md) |
| 会员功能准入及支付后返回 | [入口与回跳](membership-feature-entry.md) |
| 微信网页支付 | [网页支付](wechat-web-payment.md) |
| 微信签约、扣款及取消 | [自动续费](wechat-renewal-integration.md) |
| 佣金提现 | [自动提现跟踪](wechat-automatic-payout-tracker.md) |
| Google Play 订阅 | [配置与验收](../../compliance/google-play-billing-setup.md) |
| 验签及结算实现 | [共享支付与原子结算](../../architecture/shared-foundation-payments.md) |
| 早期选型与资格限制 | [6 月设计及接入](history/membership-and-payment-2026-06.md)、[8 月跨端方案](history/membership-plan-2026-08.md) |

修改前读取 API 路由、payment 模块、迁移及对应测试；本地验证使用隔离数据。真实购买、退款、商户开关和收款账户按当次授权处理。接口存在、模板审核通过、客户端安装或本地测试通过不能互相替代。
