'use client';

/**
 * 批量求解器使用指南 — 内容取自上游《Batch Solver Documentation》(docx)与 README,
 * 重组成「一句话 + 四步上手 + 字段速查 + 打乱语法 + 经典配方」的直观结构。
 */
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';

export default function UsageGuide() {
  const t = useT();
  return (
    <section className="bsv-guide">
      <h2>{t('使用指南', 'How to use')}</h2>
      <p className="bsv-guide-lead">
        {t(
          '一句话:告诉它「解到什么程度算完成」(唯一朝向与等价)、「要解哪些状态」(打乱)、「允许用哪些步、搜多深」(步组 + 建表/搜索),它就为每个 case 枚举所有解并按手速排序。',
          'In one sentence: tell it what counts as solved (unique orientations & equivalences), which states to solve (scramble), and which moves / how deep to search (subgroups + prune/search) — it enumerates every solution for every case and ranks them by speed.',
        )}
      </p>

      <h3>{t('一、四步上手', '1. Four steps')}</h3>
      <ol className="bsv-guide-list">
        <li>{t('选谜题。内置 3x3 / 2x2 / 4x4 / Skewb / Pyraminx / Megaminx / FTO;「自定义」可给任何满足「步集固定且动作一致」的谜题写置换定义。', 'Pick a puzzle. 3x3 / 2x2 / 4x4 / Skewb / Pyraminx / Megaminx / FTO are built in; “Custom” accepts a permutation definition for any puzzle with a fixed, consistent move set.')}</li>
        <li>{t('描述目标:留空 = 完全还原;{UF UR UB UL} = 花括号内的块互相等价(排列不计);行首 1: = 该行块的朝向不计。例:OLL = 顶层块排列全等价、只看朝向。', 'Describe the goal: empty = fully solved; {UF UR UB UL} = pieces inside braces are interchangeable (permutation ignored); a leading “1:” ignores orientation for that line. E.g. OLL = top pieces interchangeable, orientation only.')}</li>
        <li>{t('在「打乱」里给出所有要解的状态(语法见下),这是整个工具最强的部分。', 'List the states to solve in Scramble (syntax below) — the most powerful part of the tool.')}</li>
        <li>{t('每行步组 = 一轮搜索:限定允许的步(留空 = 全部),填建表 + 搜索深度,点「开始搜索」。', 'Each subgroup row = one search pass: restrict allowed moves (empty = all), set prune + search depths, hit Start.')}</li>
      </ol>

      <h3>{t('二、打乱语法', '2. Scramble syntax')}</h3>
      <ul className="bsv-guide-list">
        <li><strong>{t('裸步', 'Plain moves')}</strong>{t(':直接执行。', ': applied as-is.')}</li>
        <li><strong>[A, B]</strong>{t(':分叉,每个分支各生成一个 case。[Sune, 反Sune] = 两个 case。', ': branches — one case per entry. [Sune, Antisune] = two cases.')}</li>
        <li><strong>&lt;A, B, U&gt;</strong>{t(':生成元,任意组合反复执行并自动去重,一次展开整套 case。<Sune, U> = 全部 OCLL;<T perm, U perm, U> = 全部 PLL。', ': generators — all combinations, deduplicated, expanding a whole set at once. <Sune, U> = all OCLL; <T perm, U perm, U> = full PLL.')}</li>
        <li><strong>{t('组合', 'Combos')}</strong>{t(':从左到右依次作用。先 <OLL 生成元> 再接 R U R\' U\' 就是 VLS;<PLL 生成元> 接 [三条 OLL] 就是 TUL ZBLL。', ': applied left to right. <OLL generators> followed by R U R\' U\' gives VLS; <PLL generators> followed by [three OLLs] gives TUL ZBLL.')}</li>
        <li><strong>#</strong>{t(':末尾加 #51+(从第 51 个起)、#26,33(只这两个)、#2-21,25-40(区间),补漏、续跑用。统计里的「失败」可一键复制成这个格式。', ': append #51+ (from case 51), #26,33 (only these), #2-21,25-40 (ranges) to re-run part of a set. The “failed” counter copies exactly this format.')}</li>
      </ul>

      <h3>{t('三、字段速查', '3. Field reference')}</h3>
      <ul className="bsv-guide-list">
        <li><strong>{t('建表 Prune', 'Prune')}</strong>{t(':先把距还原 ≤n 步的所有状态连解存进内存;也可写 300k / 5m 按状态数自动选深度。', ': precompute every state within n moves of solved (with its solution); or write 300k / 5m to auto-pick the depth by state count.')}</li>
        <li><strong>{t('搜索 Search', 'Search')}</strong>{t(':在打乱态上枚举 ≤n 步的所有序列去撞表;= 同建表深度,+ / ++ 是建表 +1/+2,- 同理。能找到的最长解 = 建表 + 搜索。', ': try every sequence up to n moves from the scrambled state into the table; “=” equals prune depth, “+”/“++” = prune+1/+2, “-” likewise. Longest findable solution = prune + search.')}</li>
        <li><strong>{t('整层预转', 'Pre-adjust')}</strong>{t(':搜索前可先转的面(通常 U,即 AUF);多个必须两两可交换(如 PBL 用 U D),且每个步组都得包含它。', ': faces you may turn before solving (usually U, i.e. AUF); multiple must commute (PBL: U D), and every subgroup must contain them.')}</li>
        <li><strong>{t('整层后转', 'Post-adjust')}</strong>{t(':目标的「对称面」——目标绕它转仍算同一 case。多数公式集与预转相同;解 U 层对角两角是 U2;解 1x2x2 块则留空。', ': the goal\'s symmetry — turning the finished state by it is still the same case. Usually equals pre-adjust; two diagonal U corners → U2; a 1x2x2 block → empty.')}</li>
        <li><strong>{t('case 排序', 'Case sorting')}</strong>{t(':控制 case 出现顺序。「朝向(按位置)」最常用,如按 UFR UFL UBL UBR 排 = 按 CO 分组;多条规则依次当 tiebreaker。', ': controls case order. “Orientation at” is the common one — UFR UFL UBL UBR sorts by CO; extra rows break ties.')}</li>
        <li><strong>{t('指标', 'Metrics')}</strong>{t(':MCC = 3x3 手速模拟(越低越快,算法详见 ', ': MCC = simulated 3x3 execution speed (lower = faster, see ')}<AppLink href="/scramble/mcc">{t('MCC 页', 'the MCC page')}</AppLink>{t(',非 3x3 步名会显示 –);STM = 步数;SQTM = 90° 计数(R2 算 2);ESQ = 每步自定义权重之和。次指标追加显示在解末尾并作平手 tiebreaker。', '; non-3x3 move names show “–”); STM = move count; SQTM = quarter turns (R2 counts 2); ESQ = custom per-move weights. The secondary metric is appended to each solution and breaks ties.')}</li>
        <li><strong>{t('ESQ 权重语法', 'ESQ weight syntax')}</strong>{t(':每行「步名或通配: 权重」;R_ 匹配 R/R2/R\',_2 匹配所有 180°,__ 匹配全部,精确名优先。「生成 ESQ」还会改变生成深度的含义:填 _2: 2 就是按 SQTM 深度生成。', ': one “move-or-wildcard: weight” per line; R_ matches R/R2/R\', _2 all half turns, __ everything, most-specific wins. A Generation ESQ additionally redefines depth: “_2: 2” generates by SQTM.')}</li>
      </ul>

      <h3>{t('四、自定义谜题定义', '4. Custom puzzle definitions')}</h3>
      <p className="bsv-guide-note">
        {t(
          '每行「步名: (循环) (循环)…」,循环写块名序列,+1/-1 表示扭转;块名的大写字母个数 = 该块的朝向数(如 UFR 三向、UF 两向);// 后是注释。点开内置谜题的「置换定义」就是现成范本。',
          'One move per line: “Name: (cycle) (cycle)…”, each cycle lists piece names, +1/-1 marks twist; the number of CAPITAL letters in a piece name = its orientation count (UFR has 3, UF has 2); // starts a comment. Open a built-in puzzle\'s definition for live examples.',
        )}
      </p>

      <h3>{t('五、产出', '5. Output')}</h3>
      <p className="bsv-guide-note">
        {t(
          '每个 case 一列:图(悬停显示 case 号)+ 按指标排好的解。搜完可导出 CSV 进 Excel / Google Sheets;失败的 case 点统计里的红字一键复制 # 列表,粘回打乱末尾重跑。',
          'One column per case: image (hover for its number) + ranked solutions. Export CSV for Excel / Google Sheets when done; click the red “failed” counter to copy a #list and paste it onto Scramble to re-run just those.',
        )}
      </p>
    </section>
  );
}
