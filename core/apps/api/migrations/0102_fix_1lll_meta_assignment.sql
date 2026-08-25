-- 0102_fix_1lll_meta_assignment.sql — 8 张 1lll case 的 meta 挂错了行(生成脚本:
-- packages/alg-build/fix_1lll_meta_assignment.mjs,推导与证据写在该文件头)。
--
-- phase0 的 row→case 是状态轨道 join,但有 7 行「一条对的公式都没有」(docs/1lll-sheet-issues.md §2),
-- 只能靠组内消去 + CP 约束 + 多数派投票落位,下面这 8 张落错 —— 表现为 12 张 case 页顶上的
-- 「逆」「镜像」缩略图指错人,外加这 8 张的 OLLCP 名 / 角换 / 最优步数 / 出现概率全是别人的。
--
-- 站长那张表本身是对的:改完之后 Mirror / Inv / IM 三列在状态判据下残差为零,
-- CP 标签在每个 (朝向类, 角置换类) 里唯一。守卫:packages/alg-build/verify_meta_pointers.mjs。
--
-- 搬 meta 时 `gen` 保留原值(它是本 case 首条公式的转动集合,跟着 case 不跟着行),
-- 每条打乱按新态重过一遍轨道判据,验不过的已在下面的 JSON 里剔除。

-- 1lll/1LLL 7 7: 3496/N+U3 → 3491/N+U9,逆 3280→3419,镜 3568→3563,丢弃 scramble
UPDATE alg_cases SET meta = '{"cp":"N+U","im":3347,"no":3491,"gen":"FRU","inv":3419,"oll":"N+","sym":{"cn":"1"},"type":"OO","docNo":"3205","oldNo":"896","ollcp":"N+U9","mirror":3563,"subset":"1LLL","optimal":{"htm":{"len":12,"scramble":"F R U R'' U'' F'' L U F U'' F'' L''"},"qtm":{"len":12,"scramble":"F R U R'' U'' F'' L U F U'' F'' L''"},"stm":{"len":12,"scramble":"z F U F D'' R F'' L'' F M'' S'' U'' L''"},"sqtm":{"len":12,"scramble":"z F U F D'' R F'' L'' F M'' S'' U'' L''"}}}'::jsonb WHERE puzzle = '3x3' AND set_slug = '1lll' AND name = '1LLL 7 7';
-- 1lll/1LLL 7 12: 3491/N+U9 → 3496/N+U3,逆 3419→3280,镜 3563→3568,丢弃 scramble optimal.qtm
UPDATE alg_cases SET meta = '{"cp":"N+U","im":3208,"no":3496,"gen":"BfRU","inv":3280,"oll":"N+","sym":{"cn":"1"},"type":"OO","docNo":"3199","oldNo":"906","ollcp":"N+U3","mirror":3568,"subset":"1LLL","optimal":{"htm":{"len":11,"scramble":"F R U R2 F R F2 U F U2 F''"},"qtm":{"len":12},"stm":{"len":10,"scramble":"x'' R F2 D F D2 L D L2 F M''"},"sqtm":{"len":13,"scramble":"x'' R F2 D F D2 L D L2 F M''"}}}'::jsonb WHERE puzzle = '3x3' AND set_slug = '1lll' AND name = '1LLL 7 12';
-- 1lll/1LLL 17 26: 698/DLRB → 686/DLFB,逆 566→578,镜 686→698,丢弃 scramble optimal.stm optimal.htm
UPDATE alg_cases SET meta = '{"cp":"DLF","im":566,"no":686,"gen":"FRrU","inv":578,"oll":"DL","sym":{"cn":"1"},"docNo":"1155","oldNo":"1640","ollcp":"DLFB","mirror":698,"subset":"1LLL","optimal":{"htm":{"len":13},"qtm":{"len":16,"scramble":"F U'' L'' U R U'' L B U'' B'' R'' F'' U L'' U L"},"stm":{"len":13},"sqtm":{"len":15,"scramble":"M2 B L F L'' B'' M'' U L F2 L'' U M''"}}}'::jsonb WHERE puzzle = '3x3' AND set_slug = '1lll' AND name = '1LLL 17 26';
-- 1lll/1LLL 17 38: 701/DLR6 → 698/DLRB,逆 568→566,镜 689→686
UPDATE alg_cases SET meta = '{"cp":"DLR","im":578,"no":698,"gen":"FRU","inv":566,"oll":"DL","sym":{"cn":"1"},"docNo":"1179","oldNo":"1663","ollcp":"DLRB","mirror":686,"subset":"1LLL","optimal":{"htm":{"len":13},"qtm":{"len":16,"scramble":"F'' U R U'' L'' U R'' B'' U B L F U'' R U'' R''"},"stm":{"len":13},"sqtm":{"len":15,"scramble":"M U'' R'' F'' U'' F2 U F R F U'' F'' U'' M''"}}}'::jsonb WHERE puzzle = '3x3' AND set_slug = '1lll' AND name = '1LLL 17 38';
-- 1lll/1LLL 17 41: 686/DLFB → 701/DLR6,逆 578→568,镜 698→689
UPDATE alg_cases SET meta = '{"cp":"DLR","im":580,"no":701,"gen":"DFLU","inv":568,"oll":"DL","sym":{"cn":"1","selfInv":true,"selfMirror":true},"docNo":"1174","oldNo":"1669","ollcp":"DLR6","mirror":689,"subset":"1LLL","optimal":{"htm":{"len":13,"scramble":"R'' U'' L F L2 B'' U'' B U'' L R'' F2 R2"},"qtm":{"len":14,"scramble":"R'' L F R L'' U'' L F D F D'' L'' U'' F''"},"stm":{"len":12,"scramble":"S'' U S U'' F R D R D'' F'' U'' R''"},"sqtm":{"len":12,"scramble":"S'' U S U'' F R D R D'' F'' U'' R''"}},"scramble":"(R2'' F R F'') (R U2'' R2'' F R F'') (R U'' R'' U'' R)"}'::jsonb WHERE puzzle = '3x3' AND set_slug = '1lll' AND name = '1LLL 17 41';
-- 1lll/1LLL 19 50: 578/DTRA → 566/DTLA,逆 686→698,镜 566→578,丢弃 scramble optimal.stm optimal.htm
UPDATE alg_cases SET meta = '{"cp":"DTL","im":686,"no":566,"gen":"FRU","inv":698,"oll":"DT","sym":{"cn":"1"},"docNo":"1094","oldNo":"1820","ollcp":"DTLA","mirror":578,"subset":"1LLL","optimal":{"htm":{"len":13},"qtm":{"len":16,"scramble":"R U R'' U F'' L'' B'' U'' B R U'' L U R'' U'' F"},"stm":{"len":13},"sqtm":{"len":15,"scramble":"S'' U F'' L2 F U S'' R'' F'' L F R S2"}}}'::jsonb WHERE puzzle = '3x3' AND set_slug = '1lll' AND name = '1LLL 19 50';
-- 1lll/1LLL 19 62: 580/DTR5 → 578/DTRA,逆 689→686,镜 568→566
UPDATE alg_cases SET meta = '{"cp":"DTR","im":698,"no":578,"gen":"FRU","inv":686,"oll":"DT","sym":{"cn":"1"},"docNo":"1106","oldNo":"1807","ollcp":"DTRA","mirror":566,"subset":"1LLL","optimal":{"htm":{"len":13},"qtm":{"len":16,"scramble":"L'' U'' L U'' F R B U B'' L'' U R'' U'' L U F''"},"stm":{"len":13},"sqtm":{"len":15,"scramble":"M U'' L F2 L'' U'' M B L F'' L'' B'' M2"}}}'::jsonb WHERE puzzle = '3x3' AND set_slug = '1lll' AND name = '1LLL 19 62';
-- 1lll/1LLL 19 64: 566/DTLA → 580/DTR5,逆 698→689,镜 578→568
UPDATE alg_cases SET meta = '{"cp":"DTR","im":701,"no":580,"gen":"DFRU","inv":689,"oll":"DT","sym":{"cn":"1"},"type":"OS","docNo":"1101","oldNo":"1810","ollcp":"DTR5","mirror":568,"subset":"1LLL","optimal":{"htm":{"len":13,"scramble":"R2 B2 L R'' U'' F U'' F'' L2 B L U'' R''"},"qtm":{"len":14,"scramble":"F'' U'' R'' D'' F D F R U'' R'' L F R L''"},"stm":{"len":12,"scramble":"F'' U'' R'' D'' F D F R U'' M'' U M"},"sqtm":{"len":12,"scramble":"F'' U'' R'' D'' F D F R U'' M'' U M"}},"scramble":"F (R U'' R'' F) U (R U'' R'' F'') U (R U R'' F'')"}'::jsonb WHERE puzzle = '3x3' AND set_slug = '1lll' AND name = '1LLL 19 64';
