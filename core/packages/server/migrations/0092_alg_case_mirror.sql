-- 0092_alg_case_mirror.sql — alg_cases 的镜像伙伴指针(issue #40 T5,方案见 docs/issue-40-alg-mirror-plan.md §5.3)
--
-- 一个 case 的「镜像 case」= 把它左右镜过去、再把最后一槽转回 FR 得到的那个 case。
-- 这层关系是**对合**:互指;自镜像 case 指自己(f2l 有 3 个、zbls 有 9 个、cls 有 3 个)。
--
-- 为什么要存而不是每次现算:算一次要拿 KPuzzle 跑 setup + 24 个转体 + 4 个 AUF 找指纹,
-- 前端每开一个 case 页都算一遍不现实;而这层关系只在 case 增删时才变,存成一列最省。
-- (LSLL 那 58 万 case **不进这张表** —— 它的镜像是 canonical key 上的 σ,纯前端现算,
--  见 lib/lsll/mirror.ts。)
--
-- 建链判据是**状态指纹**不是名字:实测 f2l 的 ± 命名与状态判据 38/38 全对,zbls 只有
-- 32/296 对得上 —— 名字不能信。计划脚本 packages/client/scripts/mirror-link-plan.mts(只算不写)。
--
-- ON DELETE SET NULL:伙伴被删时把指针清掉,不连坐删对方。

ALTER TABLE alg_cases ADD COLUMN mirror_case_id BIGINT REFERENCES alg_cases(id) ON DELETE SET NULL;

-- 反查「谁指着我」用;NULL 占绝大多数(纯 LL 集全都不适用),走部分索引。
CREATE INDEX idx_alg_cases_mirror ON alg_cases(mirror_case_id) WHERE mirror_case_id IS NOT NULL;
