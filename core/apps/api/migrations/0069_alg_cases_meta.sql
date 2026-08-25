-- 0069_alg_cases_meta.sql
-- 1LLL 迁移(docs/1lll-migration.md Phase 3):给 case 挂富元数据。
--
-- 站长自编的那张 1LLL 表每个 case 带 OLLCP 名 / 数字号 / 6 套打乱 / 步数 / 四套最优解 /
-- 镜像·逆·镜像逆的编号 / 叠加类型 / 对称性 / 生成元 —— 全部塞进这一列,免得给 alg_cases
-- 加十几个只有一个 set 用得上的列。只有从表里导入的 case 才有,其余 NULL。
--
-- shape 见 shared/src/alg.ts 的 AlgCaseMeta。

ALTER TABLE alg_cases ADD COLUMN meta JSONB;
