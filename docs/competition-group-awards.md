# 比赛分组获奖

首期本地实现：比赛页「领奖台」中的分组获奖，以及 WCA 选手主页 `?tab=group-awards`。只统计已收录的数据，不合并进 WCA 官方奖牌、锦标赛领奖台、PR 或总排名。

## 数据与刷新

- 粗饼公开接口 `/competitions/:alias/live/podiums` 提供组内名次，不使用数组下标重排名；`group` 区分年龄、女子、新人，正式项目领奖台没有 `group`，不收录。
- 同时读取比赛配置 `podiums` 和 `/live/rounds`，保存该比赛的完整组别配置、评奖轮次、原始成绩、上游选手 ID、报名编号、WCA ID、来源及抓取时间。轮次未结束时标记暂定，不计入个人金银铜汇总。
- `competition_group_awards` 保存每场独立 JSONB 快照和 WCA ID 索引。单语句原子替换，支持名次修订、撤销、空名单；网络或解析失败保留上次快照并返回 stale。与 WCA 正式成绩的数据源切换无关。
- `GET /v1/group-awards/competitions/:id?v=1&cubingSlug=…` 按需收录，数据库缓存五分钟；页面可见时五分钟刷新一次。已知粗饼 alias 优先，缺失时使用既有 WCA ID 转 alias 工具；无法确认的比赛不猜测匹配。
- `GET /v1/group-awards/persons/:wcaId?v=1` 聚合已保存记录。当前不全量回填历史比赛，也不因打开个人主页扫描全部参赛历史。新增数据需要先访问对应比赛页。无 WCA ID 的新人仅留在本场；不按姓名自动合并。
- 当前支持粗饼已核实的 age/female/newcomer 分类；遇到新结构拒绝替换快照，需先更新适配器。公开比赛记录不随 CubeRoot 账号注销删除。

## 本地预览

使用本地 PostgreSQL，应用 `core/apps/api/migrations/0303_competition_group_awards.sql`。本轮验证容器为 `cuberoot-group-awards-pg`，端口 5543，库 `cuberoot_db`，用户 `postgres`，本地测试密码 `dev`。容器仅绑定 127.0.0.1。

在 `core/` 运行独立预览 API（不启动完整服务的后台任务）：

```sh
DB_HOST=127.0.0.1 DB_PORT=5543 DB_USER=postgres DB_PASS=dev DB_NAME=cuberoot_db PORT=3041 pnpm --filter @cuberoot/server exec tsx watch scripts/dev-group-awards.ts
```

前端仅将分组获奖域指向本地，其余 API 沿用现有开发代理；使用独立构建目录，保留其他开发服务：

```sh
LOCAL_DOMAINS=group-awards LOCAL_API_PORT=3041 NEXT_DEV_DIST_DIR=.tmp/group-awards-next pnpm --filter @cuberoot/client exec next dev --hostname 127.0.0.1 --port 3037
```

- 比赛：`http://127.0.0.1:3037/zh/wca/comp/JiangmenOpen2026?view=podium#group-award-333-0-age-30-0`
- 个人：`http://127.0.0.1:3037/zh/wca/persons/2017YANR02?tab=group-awards`

江门公开接口核对：11 组、33 条；O30 平均依次 9.52、10.35、10.37，季军 WCA ID 为 2017YANR02，最好单次 9.02。测试 fixture 仅保留公开获奖字段，不包含上游操作员信息。
