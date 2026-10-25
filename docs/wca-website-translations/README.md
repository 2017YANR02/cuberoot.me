# WCA 官网中英素材

`snapshot.json` 从 WCA 官网仓库同一提交的 `config/locales/en.yml` 与 `zh-CN.yml` 提取，保留精确字符串、locale key、来源提交和文件 SHA-256。范围为用户指定的信息、成绩菜单及其页面的可对齐文字，20 栏目、405 条；导航含统计、隐私、免责声明，但没有将这些页面正文、外链 PDF 或动态数据伪称双语覆盖。速拧历史与翻译者在该语言文件中仅有标题。

正文来源：World Cube Association 及中文翻译贡献者。上游许可证见固定提交的 LICENSE，公开 Markdown 链接到该许可证及两份源文件。选择、对齐和展示转换由 CubeRoot 完成。HTML 展示标记转换不改词句；插值变量保留。不能将相同 key 自动视为语义已审校，已知 officers / directors 混译及 WAPC / WAC 不一致列在参考页。

离线重导出（仓库 `core/`）：

```sh
node packages/client/scripts/wca-website-bilingual.mts
```

输出 `packages/client/public/regulation/wca-website-bilingual.md`。`/regulation/translation` 读取同一文件展开显示；人工维护的术语参考不被生成器覆盖。

更新时固定同一 upstream commit，下载两份语言文件并核对哈希，用 YAML 1.1 兼容解析器（本轮 js-yaml）读取后，按 snapshot.sections 中的 prefix 与 key 选取两边同名字符串。英文新增键要显式审核是否纳入，缺中文写 null，不用英文充数。复核组织名称、模板变量、数字、版本和覆盖范围，更新 snapshot 和人工疑点说明后重导出；不改变历史公告的组织缩写。该素材不随规则条款同步自动更新。
