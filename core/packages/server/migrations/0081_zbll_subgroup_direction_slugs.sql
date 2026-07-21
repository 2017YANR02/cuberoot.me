-- ZBLL 子组 slug:数字制(U1..U6)→ 方向制(UR/UL/UB/UF/UD/UU 等),取自各子组内 case 的
-- ollcp 前缀方向。URL 从 /alg/3x3/zbll/u1 变成语义化的 /alg/3x3/zbll/ur;旧数字 URL / ?scope=
-- 靠 client lib/alg_zbll_subgroups.ts 的别名表继续兼容,展示层 S/AS→S+/S- 走 lib/alg_case_display.ts。
--
-- 幂等:CASE 只认旧的数字制值,已经是方向制的行(以及非 zbll)走 ELSE 原样保留 —— 重复执行 0 变更。
-- 生产库此前已手动跑过一次(UPDATE 472),本文件补齐版本库 / ledger,并覆盖任何仍是旧格式的库
-- (本地 pg13、从旧源重新导入的实例)。H 组高对称只有 4 个方向,其余每组 6 个,合计 40 个子组。
UPDATE alg_cases SET subgroup = CASE subgroup
  WHEN 'U/U1' THEN 'U/UR'  WHEN 'U/U2' THEN 'U/UL'  WHEN 'U/U3' THEN 'U/UB'
  WHEN 'U/U4' THEN 'U/UF'  WHEN 'U/U5' THEN 'U/UD'  WHEN 'U/U6' THEN 'U/UU'
  WHEN 'T/T1' THEN 'T/TR'  WHEN 'T/T2' THEN 'T/TL'  WHEN 'T/T3' THEN 'T/TB'
  WHEN 'T/T4' THEN 'T/TF'  WHEN 'T/T5' THEN 'T/TD'  WHEN 'T/T6' THEN 'T/TU'
  WHEN 'L/L1' THEN 'L/LL'  WHEN 'L/L2' THEN 'L/LR'  WHEN 'L/L3' THEN 'L/LF'
  WHEN 'L/L4' THEN 'L/LB'  WHEN 'L/L5' THEN 'L/LD'  WHEN 'L/L6' THEN 'L/LU'
  WHEN 'H/H1' THEN 'H/HB'  WHEN 'H/H2' THEN 'H/HL'  WHEN 'H/H3' THEN 'H/HD'  WHEN 'H/H4' THEN 'H/HU'
  WHEN 'S/S1' THEN 'S/SB'  WHEN 'S/S2' THEN 'S/SF'  WHEN 'S/S3' THEN 'S/SL'
  WHEN 'S/S4' THEN 'S/SR'  WHEN 'S/S5' THEN 'S/SD'  WHEN 'S/S6' THEN 'S/SU'
  WHEN 'AS/AS1' THEN 'AS/ASF'  WHEN 'AS/AS2' THEN 'AS/ASB'  WHEN 'AS/AS3' THEN 'AS/ASR'
  WHEN 'AS/AS4' THEN 'AS/ASL'  WHEN 'AS/AS5' THEN 'AS/ASD'  WHEN 'AS/AS6' THEN 'AS/ASU'
  WHEN 'Pi/Pi 1' THEN 'Pi/PiF'  WHEN 'Pi/Pi 2' THEN 'Pi/PiB'  WHEN 'Pi/Pi 3' THEN 'Pi/PiR'
  WHEN 'Pi/Pi 4' THEN 'Pi/PiL'  WHEN 'Pi/Pi 5' THEN 'Pi/PiD'  WHEN 'Pi/Pi 6' THEN 'Pi/PiU'
  ELSE subgroup
END
WHERE puzzle = '3x3' AND set_slug = 'zbll';
