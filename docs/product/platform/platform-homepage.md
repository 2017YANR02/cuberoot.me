# 学习空间首页推荐与栏目搜索

状态：`REFERENCE`。2026-11-19 本地实现与审查；CI、生产部署和真实账号操作按对应提交另行核验。

## 推荐合同

- 首页优先展示管理员精选，最多 12 项，按配置顺序及可选开始、结束时间生效。之后按配置顺序补充人气、本周热门、最新课程、讲师、机构和活动；同一内容只出现一次。
- 课程必须已发布，讲师和机构只读取公开名录，活动必须已发布且尚未结束。隐藏、草稿和不可用内容不进入推荐，不读取机构内部工作区资料。
- 人气按有效解锁用户去重；本周热门按北京时间本周新增的有效解锁用户统计。未来、过期、撤销和已反转的权益排除。最新课程按首次发布时间排序；自动讲师与机构使用公开精选资料。
- 轮播支持按钮、键盘和触摸切换；悬停、聚焦、后台标签页时暂停自动切换，并遵循减少动态效果设置。没有推荐时不制造占位排名。
- `/platform/admin/homepage` 编辑精选内容、封面、展示时间与自动栏目顺序。服务端独立验证管理员权限、可公开性和请求幂等性；不依赖前端隐藏入口保护写入。

## 搜索与导航合同

- 页头按当前栏目复用课程、路径、活动、资讯或论坛搜索；页面继续管理 URL 查询和分页，页头只承载输入和筛选。
- 筛选弹层先编辑草稿，应用后更新 URL；关闭、Escape 或点击外部取消草稿。桌面复用共享视口钳制，手机使用底部面板。
- 原主站论坛、机构和讲师页面仍是唯一实现；Platform 通过导航上下文复用，不维护第二份业务页面。

## 维护入口

- [API 与校验](../../../core/apps/api/src/platform/catalog/homepage-routes.ts)：公开 `GET /v1/platform/homepage`、管理员 `GET/PUT /v1/platform/admin/homepage`。
- [共享类型](../../../core/packages/shared/src/platform.ts)、[客户端调用](../../../core/packages/client/lib/platform-homepage.ts)、[轮播](../../../core/packages/client/components/platform/PlatformHomepageCarousel.tsx)、[配置界面](../../../core/packages/client/components/platform/PlatformHomepageAdmin.tsx)。
- [搜索绑定](../../../core/packages/client/lib/platform-navigation-context.ts)、[栏目搜索](../../../core/packages/client/components/platform/PlatformScopedSearch.tsx)、[筛选面板](../../../core/packages/client/components/platform/PlatformSearchFilter.tsx)。
- [0343 迁移](../../../core/apps/api/migrations/0343_platform_homepage_recommendations.sql)维护全局 `platform_homepage_settings` 和课程有效学员统计索引；该配置不包含学员身份或私密资料。
- API、数据表、迁移、组件和 hook 同步登记在 `/dev/api`、`/dev/schema`、`/dev/components`、`/dev/utils`；迁移仅由获准发布后的部署流水线应用。

## 本地验证边界

权限、推荐顺序、时间范围、去重、封面 URL 和配置保存通过现有行为回归验证。迁移及实际查询另用隔离 PGlite（PostgreSQL WASM）验证公开内容过滤、有效权益排名、索引与约束；这不替代生产 PostgreSQL 部署确认。代码审查备份与本地结果保存在 `.local-data/git-publish-backups/20261119T112303Z/`，未写生产业务数据。

浏览器使用独立未登录 Chrome 检查中文、英文、1440px/390px、四种主题组合、轮播切换、筛选边界及 Escape 焦点恢复，未出现页面异常或横向溢出。推荐与课程返回值使用浏览器内 fixture；未操作真实管理员设置、支付或账号数据。
