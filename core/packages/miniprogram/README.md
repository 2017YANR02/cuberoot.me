# CubeRoot 微信小程序

原生微信小程序外壳。计时状态机、打乱和统计复用 `@cuberoot/shared/timer`，长尾内容通过 `web-view` 打开网站。

```powershell
$env:WECHAT_MINI_APP_ID='小程序 AppID'
pnpm --filter @cuberoot/miniprogram build
```

然后用微信开发者工具导入本目录。未设置 AppID 时会生成游客项目配置，可先预览页面。

后端登录还需配置 `WECHAT_MINI_APP_ID`、`WECHAT_MINI_APP_SECRET`；小程序后台需配置 request 合法域名和业务域名。
