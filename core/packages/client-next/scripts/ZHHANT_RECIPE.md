# zh-Hant 残余转换 Recipe（给执行 agent）

目标：把指定文件里**剩余的简体数据/JSX 三目**转成静态三路繁体，使 `i18n.language === 'zh-Hant'` 时渲染繁体。**只改分配给你的文件**。

## 铁律

1. **繁体一律用转换器，禁手译**：`node scripts/conv.mjs "要转的简体"` 打印台湾正体（s2twp + 項目 override）。多字符直接整段传。CWD 必须在 `packages/client-next`。
2. **统一模式**：把 `<原三目>` 包成
   `i18n.language === 'zh-Hant' ? (<繁体分支>) : (<原三目>)`
   原三目**原样保留**在 `(...)` 里，不要动它。
3. **import**：文件顶部若无 `import i18n from '@/i18n/i18n-client'` 就加一行（注意：组件里的 `const { i18n } = useTranslation()` 是另一回事，可共存；但**顶层只加一个** default import）。
4. **禁** 跑 `typecheck` / `build` / `dev`（lead 统一验）。只编辑 + 用 conv.mjs。
5. 改完报告：改了哪些文件、关了哪几个 pick、**哪些故意没转 + 原因**。

## 各类 pick 的改法

### A. 模块/局部常量 pick：`isZh ? X_ZH : X_EN`（X_ZH 是个 const 数组/对象/字符串）
在 X_ZH 定义紧邻处加繁体兄弟常量（保留类型注解），读取处改三路：
```ts
const X_ZH = [...] ;
const X_ZH_HANT = [...] ;   // 用 conv.mjs 把 X_ZH 里每个中文字面量转繁，结构不变
// 读取处:
i18n.language === 'zh-Hant' ? X_ZH_HANT : (isZh ? X_ZH : X_EN)
```

### B. `as const` 数据的元素字段 pick：`isZh ? rec.fieldZh : rec.fieldEn`（rec 来自 `... as const` 的数组/对象）
**禁直接往 as const 字面量里加字段**（会让 TS 推断出 `never` 报错）。改为加一个 sibling 查表，value 类型**必须带 `| undefined`** 否则 `??` 变死分支又触发 never：
```ts
const FIELD_HANT: Record<string, string | undefined> = { '<key>': '繁体', ... }; // key 用 rec 的稳定字段(id/path/piece)
// 读取处:
i18n.language === 'zh-Hant' ? (FIELD_HANT[rec.<keyfield>] ?? rec.fieldZh) : (isZh ? rec.fieldZh : rec.fieldEn)
```

### C. 局部/匿名 const 的字段 pick（非具名 interface）：`isZh ? r.zh : r.en` / `s.detail.zh`
往**那一个 const** 的每个元素对象注入 `zhHant`（或 `<field>Hant`）字段，值 = conv(原字段初始化器的源文本)（字符串/数组/对象/JSX 都适用，conv 只动中文字形）；若 const 有 inline 类型注解 `{ zh: T }`，同步加 `zhHant?: T`。读取改：
```ts
i18n.language === 'zh-Hant' ? (r.zhHant ?? r.zh) : (isZh ? r.zh : r.en)
```

### D. JSX pick：`isZh ? (<jsx中文>) : (<jsx英文>)`
```tsx
i18n.language === 'zh-Hant' ? (<jsx中文-转繁>) : (isZh ? (<jsx中文>) : (<jsx英文>))
```
**转繁方法**：把中文那支 JSX 的**完整源文本**丢给 conv.mjs —— 因为 conv 只改中文字形，`<TeX src="..."/>`、`<strong>`、`<a>`、所有标签/属性/`{表达式}`/英文都原样不动，输出就是合法 JSX。逐字粘贴转换结果。

### E. prop-threaded 组件（`isZh` 是解构进来的 prop，如 `function Card({ isZh, noteZh, noteEn }) { ... isZh ? noteZh : noteEn ... }`）
1. 组件签名加可选 prop `noteZhHant?: <同 noteZh 类型>`。
2. body 改：`i18n.language === 'zh-Hant' ? (noteZhHant ?? noteZh) : (isZh ? noteZh : noteEn)`。
3. **每个 JSX 调用点** `<Card noteZh="角对角" .../>` 补 `noteZhHant="角對角"`（conv 转那个字面量）。
4. 组件文件加 `import i18n`。

### F. 运行时值（无法静态转）：`isZh ? compNameZh(c.name) : ''`、`isZh ? label : ...`
zh 分支是运行时函数/变量（比赛名、用户标签等），**没有内联中文字面量可转** → **不要改，原样留**，在报告里写明"运行时值，留简"。

## 自检
每处改完目检：`(...)` 里的原三目完整保留；繁体分支用了 conv 输出；没动英文/标签/TeX。
