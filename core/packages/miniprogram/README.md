# CubeRoot 微信小程序

微信小程序外壳。计时器和内容页通过 `web-view` 直接复用现有网站，登录和后续微信专属能力保留原生实现。

```powershell
$env:WECHAT_MINI_APP_ID='小程序 AppID'
pnpm --filter @cuberoot/miniprogram build
```

然后用微信开发者工具导入本目录。未设置 AppID 时会生成游客项目配置，可先预览页面。

后端登录还需配置 `WECHAT_MINI_APP_ID`、`WECHAT_MINI_APP_SECRET`；小程序后台需配置 request 合法域名和业务域名。
