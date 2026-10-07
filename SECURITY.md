# Security Policy / 安全政策

## Reporting a vulnerability / 报告安全漏洞

Please email [ruiminyan@cuberoot.me](mailto:ruiminyan@cuberoot.me) with the
subject `CubeRoot security report`. Reports in English or Simplified Chinese
are welcome. Do not disclose vulnerability details, credentials, or personal
data in public issues, discussions, or forum posts.

发现安全漏洞，请发邮件至 [ruiminyan@cuberoot.me](mailto:ruiminyan@cuberoot.me)，
标题注明「CubeRoot 安全漏洞报告」。支持中文和英文。请勿在公开 Issue、Discussion
或论坛中披露漏洞细节、凭据或个人数据。

Please include / 请尽量提供：

- Affected URL, component, and app version or commit, if known.
  受影响的网址、组件，以及已知的应用版本或提交号。
- Reproduction steps, expected and actual behavior, and potential impact.
  复现步骤、预期与实际行为，以及可能造成的影响。
- A minimal example or redacted screenshots/logs, using your own test account.
  使用自己测试账号的最小示例，或已脱敏的截图、日志。

Do not include passwords, access tokens, payment credentials, or other users'
data. Use only accounts and data you control; avoid disrupting the service or
accessing, changing, or downloading other users' data. Please coordinate public
disclosure with the maintainer after the issue has been assessed and addressed.

请勿附上密码、访问令牌、支付密钥或其他用户的数据。验证时仅使用自己控制的账号和数据，
避免影响服务运行，或访问、修改、下载其他用户的数据。请在问题完成评估和处理后，
与维护者协调公开披露。

Reports are assessed by impact and reproducibility. Response and fix times vary;
this policy does not promise a fixed response deadline or a monetary reward.
For ordinary bugs and feature requests, use
[GitHub Issues](https://github.com/2017YANR02/cuberoot.me/issues).

维护者将根据影响和可复现性评估报告，响应与修复时间视具体情况而定；本政策不承诺固定
响应时限或奖金。普通功能问题和建议请使用
[GitHub Issues](https://github.com/2017YANR02/cuberoot.me/issues)。

## Supported versions / 维护范围

Security fixes target the current CubeRoot production services, the latest
officially released clients, and actively maintained code on `main`. Older
releases, historical commits, and retired components do not receive separate
security backports; please update to the latest available release. If an issue
in a bundled third-party component affects CubeRoot, report the CubeRoot impact
through the same email channel.

安全修复面向 CubeRoot 当前线上服务、最新正式发布的客户端，以及 `main` 分支中仍在
维护的代码。旧版、历史提交和已退役组件不单独回移安全修复，请升级至最新可用版本。
若集成的第三方组件漏洞影响 CubeRoot，也请通过上述邮箱报告其对 CubeRoot 的影响。
