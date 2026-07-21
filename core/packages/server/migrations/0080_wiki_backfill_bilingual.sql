-- 0080_wiki_backfill_bilingual.sql
-- 一次性回填:把 seed 词条的中英混排 head/body 拆进 0079 新增的
-- head_en/head_zh/body_en/body_zh 结构化列。原 head/body 原样保留(搜索/slug/兜底)。
-- 由 packages/server/scripts/gen-wiki-backfill.ts 从 DB 自身 combined 值生成,勿手改。
-- 拆分规则见 scripts/lib/wiki-bilingual.mjs(首汉字切分,实测 713 条零误拆)。

UPDATE wiki_terms SET head_en=$wcbf$(…)$wcbf$, head_zh=$wcbf$括号$wcbf$, body_en=$wcbf$Bracket are for grouping moves together to help you memorize like (R' F R F').$wcbf$, body_zh=$wcbf$括号用于将转动序列分组以帮助记忆, 例如(R' F R F').$wcbf$ WHERE source='seed' AND letter='#' AND position=0;
UPDATE wiki_terms SET head_en=$wcbf$+-Center$wcbf$, head_zh=$wcbf$棱心块$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='#' AND position=1;
UPDATE wiki_terms SET head_en=$wcbf$+2 (Plus Two Seconds)$wcbf$, head_zh=$wcbf$加2秒$wcbf$, body_en=$wcbf$The standard time penalty in WCA competitions WCA$wcbf$, body_zh=$wcbf$比赛时的惩罚$wcbf$ WHERE source='seed' AND letter='#' AND position=2;
UPDATE wiki_terms SET head_en=$wcbf$1-Flip$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$A Pyraminx advanced method$wcbf$, body_zh=$wcbf$金字塔高级玩法$wcbf$ WHERE source='seed' AND letter='#' AND position=3;
UPDATE wiki_terms SET head_en=$wcbf$1-Look$wcbf$, head_zh=$wcbf$全预判$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='#' AND position=4;
UPDATE wiki_terms SET head_en=$wcbf$1MSF2L (One Misslot F2L)$wcbf$, head_zh=$wcbf$单错槽F2L$wcbf$, body_en=$wcbf$NF2L subset$wcbf$, body_zh=$wcbf$非标F2L子集$wcbf$ WHERE source='seed' AND letter='#' AND position=5;
UPDATE wiki_terms SET head_en=$wcbf$2GLL (2-Generator Last Layer) R,U$wcbf$, head_zh=$wcbf$流还原顶层$wcbf$, body_en=$wcbf$ZBLL subset where CP is solved$wcbf$, body_zh=$wcbf$角排列已还原的ZBLL子集$wcbf$ WHERE source='seed' AND letter='#' AND position=6;
UPDATE wiki_terms SET head_en=$wcbf$2H (Two-Handed)$wcbf$, head_zh=$wcbf$双手$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='#' AND position=7;
UPDATE wiki_terms SET head_en=$wcbf$2MSF2L (Two Misslot F2L)$wcbf$, head_zh=$wcbf$双错槽F2L$wcbf$, body_en=$wcbf$NF2L subset$wcbf$, body_zh=$wcbf$非标F2L子集$wcbf$ WHERE source='seed' AND letter='#' AND position=8;
UPDATE wiki_terms SET head_en=$wcbf$3-Style (3-Cycle with Freestyle)$wcbf$, head_zh=$wcbf$三循环法$wcbf$, body_en=$wcbf$An advanced BLD method using 3-cycle, discovered by Olly Hayden, Hao Cheng in 2004, 2006.$wcbf$, body_zh=$wcbf$三循环法是采用三循环的盲拧高级法, Olly Hayden, 程浩 (网名"彳亍") 分别在2004年, 2006年独立发现. WCA三盲项目中首批使用三循环法的选手是Leyan Lo, Tyson Mao (毛台勝), Chris Hardwick, Shelley Chang, 在2005年初.$wcbf$ WHERE source='seed' AND letter='#' AND position=9;
UPDATE wiki_terms SET head_en=$wcbf$n-Bar (n>1) n-$wcbf$, head_zh=$wcbf$棒$wcbf$, body_en=$wcbf$n connected stickers$wcbf$, body_zh=$wcbf$n个连在一起的贴纸$wcbf$ WHERE source='seed' AND letter='#' AND position=10;
UPDATE wiki_terms SET head_en=$wcbf$n-Gen (n-Generator) n-$wcbf$, head_zh=$wcbf$流$wcbf$, body_en=$wcbf$Using only moves with n sides or slices$wcbf$, body_zh=$wcbf$只转动n个外层或内层$wcbf$ WHERE source='seed' AND letter='#' AND position=11;
UPDATE wiki_terms SET head_en=$wcbf$n-Line (n>2) n-$wcbf$, head_zh=$wcbf$条$wcbf$, body_en=$wcbf$n connected stickers$wcbf$, body_zh=$wcbf$n个连在一起的贴纸$wcbf$ WHERE source='seed' AND letter='#' AND position=12;
UPDATE wiki_terms SET head_en=$wcbf$nxn$wcbf$, head_zh=$wcbf$n阶魔方$wcbf$, body_en=$wcbf$nxnxn cube$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='#' AND position=13;
UPDATE wiki_terms SET head_en=$wcbf$nxn Kilominx$wcbf$, head_zh=$wcbf$n阶五魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='#' AND position=14;
UPDATE wiki_terms SET head_en=$wcbf$nxn Morphix$wcbf$, head_zh=$wcbf$n阶魔粽$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='#' AND position=15;
UPDATE wiki_terms SET head_en=$wcbf$nLLL (n Look Last Layer, n=1,2,3,4)$wcbf$, head_zh=$wcbf$n步顶层 (n步骤还原顶层)$wcbf$, body_en=$wcbf$Solving the last layer in n steps or 'looks'. In CFOP, 4LLL, 3LLL and 2LLL refer to 2 Look OLL+2 look PLL, 2 Look OLL+PLL, and OLL+PLL, respectively. 1LLL solve LL in 1 step.$wcbf$, body_zh=$wcbf$在CFOP中，分别指2步OLL+2步PLL，2步OLL+PLL，OLL+PLL. 1LLL一步还原顶层 (3915条, 公式首次由Bernard Helmstetter给出).$wcbf$ WHERE source='seed' AND letter='#' AND position=16;
UPDATE wiki_terms SET head_en=$wcbf$n-Look$wcbf$, head_zh=$wcbf$n叠 / n段式$wcbf$, body_en=$wcbf$n recognition + n algorithm$wcbf$, body_zh=$wcbf$n次观察 + n个公式$wcbf$ WHERE source='seed' AND letter='#' AND position=17;
UPDATE wiki_terms SET head_en=$wcbf$n-Mover$wcbf$, head_zh=$wcbf$n步转动$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='#' AND position=18;
UPDATE wiki_terms SET head_en=$wcbf$ABmCnE (All But m Corners, n Edges)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$All pieces but m corners and n edges are solved$wcbf$, body_zh=$wcbf$所有块都已还原除了m个角和n个棱$wcbf$ WHERE source='seed' AND letter='A' AND position=0;
UPDATE wiki_terms SET head_en=$wcbf$acn$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$The website of alg/reconstruction viewing and sharing
https://alg.cubing.net/$wcbf$, body_zh=$wcbf$公式/复盘演示和分享网站$wcbf$ WHERE source='seed' AND letter='A' AND position=1;
UPDATE wiki_terms SET head_en=$wcbf$Add letter$wcbf$, head_zh=$wcbf$加编码消翻色$wcbf$, body_en=$wcbf$Use in BLD to cancel into twist$wcbf$, body_zh=$wcbf$用于三盲, 加编码消翻色$wcbf$ WHERE source='seed' AND letter='A' AND position=2;
UPDATE wiki_terms SET head_en=$wcbf$ADF (Adjust D Face)$wcbf$, head_zh=$wcbf$用D调整底层$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='A' AND position=3;
UPDATE wiki_terms SET head_en=$wcbf$Adj (Adjacent)$wcbf$, head_zh=$wcbf$邻（相邻的）$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='A' AND position=4;
UPDATE wiki_terms SET head_en=$wcbf$Advanced Method$wcbf$, head_zh=$wcbf$高级方法$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='A' AND position=5;
UPDATE wiki_terms SET head_en=$wcbf$AfR (African Record/Rank)$wcbf$, head_zh=$wcbf$非洲纪录/排名$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='A' AND position=6;
UPDATE wiki_terms SET head_en=$wcbf$Alg (Algorithm)$wcbf$, head_zh=$wcbf$公式$wcbf$, body_en=$wcbf$A sequence of moves designed to achieve a particular outcome on a puzzle$wcbf$, body_zh=$wcbf$让魔方到达特定状态的转动序列$wcbf$ WHERE source='seed' AND letter='A' AND position=7;
UPDATE wiki_terms SET head_en=$wcbf$AlgDb$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$The website of algorithm database
http://algdb.net/$wcbf$, body_zh=$wcbf$公式数据库网站$wcbf$ WHERE source='seed' AND letter='A' AND position=8;
UPDATE wiki_terms SET head_en=$wcbf$Algset$wcbf$, head_zh=$wcbf$公式集$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='A' AND position=9;
UPDATE wiki_terms SET head_en=$wcbf$Align$wcbf$, head_zh=$wcbf$对齐$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='A' AND position=10;
UPDATE wiki_terms SET head_en=$wcbf$Alternative Algorithm$wcbf$, head_zh=$wcbf$备选公式$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='A' AND position=11;
UPDATE wiki_terms SET head_en=$wcbf$All-Rounder$wcbf$, head_zh=$wcbf$全能选手$wcbf$, body_en=$wcbf$See also "Bronze Member".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='A' AND position=12;
UPDATE wiki_terms SET head_en=$wcbf$Anti-Diag OLLCP$wcbf$, head_zh=$wcbf$反对角换OLLCP$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='A' AND position=13;
UPDATE wiki_terms SET head_en=$wcbf$Anti-Symmetry$wcbf$, head_zh=$wcbf$反对称$wcbf$, body_en=$wcbf$A cube is called antisymmetric to a given symmetry S, if S transforms the cube into its inverse. Applying S together with the inversion operator T then gives the original cube again.
m (A) = A'.$wcbf$, body_zh=$wcbf$A的镜像=A的逆.$wcbf$ WHERE source='seed' AND letter='A' AND position=14;
UPDATE wiki_terms SET head_en=$wcbf$Anti-Twist$wcbf$, head_zh=$wcbf$防转角$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='A' AND position=15;
UPDATE wiki_terms SET head_en=$wcbf$AoX (Average of X)$wcbf$, head_zh=$wcbf$X次去尾平均$wcbf$, body_en=$wcbf$In an AoX, the best and worst times in an average are placed in brackets. Example: (5.43) 4.32 3.21 2.10 (1.00).$wcbf$, body_zh=$wcbf$用圆括号将最好和最坏的时间括起来. 例如：(5.43) 4.32 3.21 2.10 (1.00).$wcbf$ WHERE source='seed' AND letter='A' AND position=16;
UPDATE wiki_terms SET head_en=$wcbf$AoXR (X=1,2,3,4)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$If a competitor did not make it to the finals, there is no AoXR. Otherwise, AoXR is the mean of averages of all rounds of the competitor.$wcbf$, body_zh=$wcbf$若没有进入决赛, 则无AoXR. 否则, AoXR是选手一场比赛中某项目所有轮的平均成绩的不去尾平均.$wcbf$ WHERE source='seed' AND letter='A' AND position=17;
UPDATE wiki_terms SET head_en=$wcbf$AS (Anti-Sune)$wcbf$, head_zh=$wcbf$反小鱼$wcbf$, body_en=$wcbf$The inverse of the Sune algorithm which re-orients 3 corners CCW$wcbf$, body_zh=$wcbf$小鱼的逆公式，还原三个需要逆时针翻转的角块的色向$wcbf$ WHERE source='seed' AND letter='A' AND position=18;
UPDATE wiki_terms SET head_en=$wcbf$AsR (Asian Record/Rank)$wcbf$, head_zh=$wcbf$亚洲纪录/排名$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='A' AND position=19;
UPDATE wiki_terms SET head_en=$wcbf$Assemble$wcbf$, head_zh=$wcbf$组装$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='A' AND position=20;
UPDATE wiki_terms SET head_en=$wcbf$Astrominx$wcbf$, head_zh=$wcbf$正二十面体魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='A' AND position=21;
UPDATE wiki_terms SET head_en=$wcbf$Asymmetry$wcbf$, head_zh=$wcbf$非对称$wcbf$, body_en=$wcbf$Non-symmetry$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='A' AND position=22;
UPDATE wiki_terms SET head_en=$wcbf$ATM (Axial Turn Metric)$wcbf$, head_zh=$wcbf$轴向转动度量制$wcbf$, body_en=$wcbf$A metric for 3x3 where any movement within the same axis counts as a single move. This includes quarter turns, half turns, slice turns, and antislice turns.$wcbf$, body_zh=$wcbf$同轴转动算一步, 比如L' R2, 机器人解魔方是两层一块转的.$wcbf$ WHERE source='seed' AND letter='A' AND position=23;
UPDATE wiki_terms SET head_en=$wcbf$Audio Memo$wcbf$, head_zh=$wcbf$读码记忆$wcbf$, body_en=$wcbf$TS BU PI RN = "tuss boo pie rin"$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='A' AND position=24;
UPDATE wiki_terms SET head_en=$wcbf$AUF (Adjust U Face)$wcbf$, head_zh=$wcbf$用U调整顶层, 对齐$wcbf$, body_en=$wcbf$This is a move generally performed before or after an algorithm to align the U face to a desired position. It could either be U, U', or U2.$wcbf$, body_zh=$wcbf$是在做还原公式前或后的调整. 可以是U，U'或U2.$wcbf$ WHERE source='seed' AND letter='A' AND position=25;
UPDATE wiki_terms SET head_en=$wcbf$Avg (Average, ⌀)$wcbf$, head_zh=$wcbf$去尾平均$wcbf$, body_en=$wcbf$The average result of counting solves$wcbf$, body_zh=$wcbf$计入成绩的平均值$wcbf$ WHERE source='seed' AND letter='A' AND position=26;
UPDATE wiki_terms SET head_en=$wcbf$Axes$wcbf$, head_zh=$wcbf$轴（复数）$wcbf$, body_en=$wcbf$A plural of axis$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='A' AND position=27;
UPDATE wiki_terms SET head_en=$wcbf$Axis$wcbf$, head_zh=$wcbf$轴$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='A' AND position=28;
UPDATE wiki_terms SET head_en=$wcbf$Axis Cube$wcbf$, head_zh=$wcbf$轴魔方$wcbf$, body_en=$wcbf$Twisty puzzle in cube shape. But as it has unequal divisions, the mixed axis cube will not be in the cube shape. It is also referred to as the Ghost Cube. An Axis Cube is EXACTLY like a 3X3 Rubik's Cube; if you look at it from a certain angle.$wcbf$, body_zh=$wcbf$例如变幻金刚魔方和鬼魔.$wcbf$ WHERE source='seed' AND letter='A' AND position=29;
UPDATE wiki_terms SET head_en=$wcbf$B (Back)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$A face move$wcbf$, body_zh=$wcbf$一种面转动$wcbf$ WHERE source='seed' AND letter='B' AND position=0;
UPDATE wiki_terms SET head_en=$wcbf$Back Slash$wcbf$, head_zh=$wcbf$反斜杠$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='B' AND position=1;
UPDATE wiki_terms SET head_en=$wcbf$Bad Edge$wcbf$, head_zh=$wcbf$坏棱$wcbf$, body_en=$wcbf$Misoriented edge$wcbf$, body_zh=$wcbf$错向棱$wcbf$ WHERE source='seed' AND letter='B' AND position=2;
UPDATE wiki_terms SET head_en=$wcbf$Bandaged puzzle$wcbf$, head_zh=$wcbf$捆绑魔方$wcbf$, body_en=$wcbf$A twisty puzzle that has cubies that have been combined together, generally restricting certain moves that would have previously been possible had said puzzle not been bandaged. An example of a bandaged puzzle is a Rubik's cube with an edge bandaged with a corner.$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='B' AND position=3;
UPDATE wiki_terms SET head_en=$wcbf$Bar$wcbf$, head_zh=$wcbf$棒$wcbf$, body_en=$wcbf$2 connected stickers$wcbf$, body_zh=$wcbf$2连格$wcbf$ WHERE source='seed' AND letter='B' AND position=4;
UPDATE wiki_terms SET head_en=$wcbf$BB (Blockbuilding)$wcbf$, head_zh=$wcbf$筑砖 / 砖构筑$wcbf$, body_en=$wcbf$Inuitively solving blocks of pieces around the cube, in contrast to algorithmic speedcubing approaches$wcbf$, body_zh=$wcbf$凭直觉还原整团的块，与公式化的速拧方法作对比$wcbf$ WHERE source='seed' AND letter='B' AND position=5;
UPDATE wiki_terms SET head_en=$wcbf$Beginner Method$wcbf$, head_zh=$wcbf$入门玩法$wcbf$, body_en=$wcbf$Method designed for beginners, which has few algorithms but many steps$wcbf$, body_zh=$wcbf$为初学者设计的方法，公式少但步骤多$wcbf$ WHERE source='seed' AND letter='B' AND position=6;
UPDATE wiki_terms SET head_en=$wcbf$Beido$wcbf$, head_zh=$wcbf$贝朵$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$单手R U2 R'中的U2$wcbf$ WHERE source='seed' AND letter='B' AND position=7;
UPDATE wiki_terms SET head_en=$wcbf$Bell Method$wcbf$, head_zh=$wcbf$贝尔法$wcbf$, body_en=$wcbf$A Pyraminx advanced method$wcbf$, body_zh=$wcbf$金字塔高级玩法$wcbf$ WHERE source='seed' AND letter='B' AND position=8;
UPDATE wiki_terms SET head_en=$wcbf$Belt Method$wcbf$, head_zh=$wcbf$腰带法$wcbf$, body_en=$wcbf$Solve E-slice; Separate the remaining pieces into their respective layers; Orient the U and D layer pieces (need Corner Orientation Parity and Edge Orientation Parity); Permute U and D layer pieces; PLL Parity- M2 U2 M2$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='B' AND position=9;
UPDATE wiki_terms SET head_en=$wcbf$Big Cube$wcbf$, head_zh=$wcbf$高阶魔方$wcbf$, body_en=$wcbf$High order cube, NxNxN cube (N>3)$wcbf$, body_zh=$wcbf$三阶以上的正阶魔方$wcbf$ WHERE source='seed' AND letter='B' AND position=10;
UPDATE wiki_terms SET head_en=$wcbf$Binding Pair$wcbf$, head_zh=$wcbf$结合基$wcbf$, body_en=$wcbf$F2L1 and F2L2$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='B' AND position=11;
UPDATE wiki_terms SET head_en=$wcbf$Blank Cube$wcbf$, head_zh=$wcbf$裸方$wcbf$, body_en=$wcbf$Cube without sticker$wcbf$, body_zh=$wcbf$未上贴纸的魔方$wcbf$ WHERE source='seed' AND letter='B' AND position=12;
UPDATE wiki_terms SET head_en=$wcbf$BLD (Blindfolded)$wcbf$, head_zh=$wcbf$盲拧$wcbf$, body_en=$wcbf$Solving cubes blindfolded$wcbf$, body_zh=$wcbf$闭上眼睛还原魔方$wcbf$ WHERE source='seed' AND letter='B' AND position=13;
UPDATE wiki_terms SET head_en=$wcbf$BLDTM (Blindfolded Quarter Turn Metric)$wcbf$, head_zh=$wcbf$盲拧转动度量制$wcbf$, body_en=$wcbf$A quasi-STM where UD, UD' counts as 1 turn, U2, U2D, U2D', U2D2 counts as 2 turn UD, etc.
UD', UD$wcbf$, body_zh=$wcbf$计数为1, U2D, U2D', U2D2计数为2等的准中层转动度量制$wcbf$ WHERE source='seed' AND letter='B' AND position=14;
UPDATE wiki_terms SET head_en=$wcbf$Blindfold$wcbf$, head_zh=$wcbf$眼罩$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='B' AND position=15;
UPDATE wiki_terms SET head_en=$wcbf$Blindfolded Solving$wcbf$, head_zh=$wcbf$盲解$wcbf$, body_en=$wcbf$See also "BLD".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='B' AND position=16;
UPDATE wiki_terms SET head_en=$wcbf$Blindsolving$wcbf$, head_zh=$wcbf$盲解$wcbf$, body_en=$wcbf$See also "BLD".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='B' AND position=17;
UPDATE wiki_terms SET head_en=$wcbf$BLE (Brooks' Last Edge)$wcbf$, head_zh=$wcbf$布鲁克斯末棱 [27]$wcbf$, body_en=$wcbf$Inserting an edge into last F2L slot and orient LL corners$wcbf$, body_zh=$wcbf$插入LS棱并完成顶角色向$wcbf$ WHERE source='seed' AND letter='B' AND position=18;
UPDATE wiki_terms SET head_en=$wcbf$Block$wcbf$, head_zh=$wcbf$砖$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='B' AND position=19;
UPDATE wiki_terms SET head_en=$wcbf$Blockbuilding Cross$wcbf$, head_zh=$wcbf$砖构筑十字$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='B' AND position=20;
UPDATE wiki_terms SET head_en=$wcbf$BoN (Best of N)$wcbf$, head_zh=$wcbf$N次取最好$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='B' AND position=21;
UPDATE wiki_terms SET head_en=$wcbf$Boob Cube$wcbf$, head_zh=$wcbf$笨蛋魔方$wcbf$, body_en=$wcbf$1x1x2 cuboid 1x1x2$wcbf$, body_zh=$wcbf$矩体魔方$wcbf$ WHERE source='seed' AND letter='B' AND position=22;
UPDATE wiki_terms SET head_en=$wcbf$BOY (Blue-Orange-Yellow)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$Western Color Scheme$wcbf$, body_zh=$wcbf$西方配色$wcbf$ WHERE source='seed' AND letter='B' AND position=23;
UPDATE wiki_terms SET head_en=$wcbf$BPA (Best Possible Average)$wcbf$, head_zh=$wcbf$最好可能平均$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$5把还原中，在前4把已知的前提下，理论上最快的Ao5，即前4把中最快3把的平均$wcbf$ WHERE source='seed' AND letter='B' AND position=24;
UPDATE wiki_terms SET head_en=$wcbf$BTM (Block Turn Metric)$wcbf$, head_zh=$wcbf$砖度量制$wcbf$, body_en=$wcbf$A metric where any group of contiguous slices moving the same way is counted as one move$wcbf$, body_zh=$wcbf$任意平行的连续多层的转动计数为1的度量制$wcbf$ WHERE source='seed' AND letter='B' AND position=25;
UPDATE wiki_terms SET head_en=$wcbf$Break$wcbf$, head_zh=$wcbf$破坏$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='B' AND position=26;
UPDATE wiki_terms SET head_en=$wcbf$Bronze Member$wcbf$, head_zh=$wcbf$青铜会员$wcbf$, body_en=$wcbf$See also "Mollerz Memberships".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='B' AND position=27;
UPDATE wiki_terms SET head_en=$wcbf$Budget Cube$wcbf$, head_zh=$wcbf$廉价魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='B' AND position=28;
UPDATE wiki_terms SET head_en=$wcbf$Buffer$wcbf$, head_zh=$wcbf$缓冲块$wcbf$, body_en=$wcbf$Some fixed sticker used in BLD$wcbf$, body_zh=$wcbf$盲拧中某个固定贴纸$wcbf$ WHERE source='seed' AND letter='B' AND position=29;
UPDATE wiki_terms SET head_en=$wcbf$Bumpless$wcbf$, head_zh=$wcbf$少卡挫的$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='B' AND position=30;
UPDATE wiki_terms SET head_en=$wcbf$BYO (Blue-Yellow-Orange)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$Japanese Color Scheme$wcbf$, body_zh=$wcbf$日本配色$wcbf$ WHERE source='seed' AND letter='B' AND position=31;
UPDATE wiki_terms SET head_en=$wcbf$Cage Method$wcbf$, head_zh=$wcbf$笼法$wcbf$, body_en=$wcbf$Used in super big cube$wcbf$, body_zh=$wcbf$用于超高阶$wcbf$ WHERE source='seed' AND letter='C' AND position=0;
UPDATE wiki_terms SET head_en=$wcbf$Cancel Moves$wcbf$, head_zh=$wcbf$消步$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=1;
UPDATE wiki_terms SET head_en=$wcbf$Canonical$wcbf$, head_zh=$wcbf$正则的$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=2;
UPDATE wiki_terms SET head_en=$wcbf$Cap$wcbf$, head_zh=$wcbf$盖子$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=3;
UPDATE wiki_terms SET head_en=$wcbf$Case$wcbf$, head_zh=$wcbf$情况$wcbf$, body_en=$wcbf$Position (up to isomorphism), equivalence class$wcbf$, body_zh=$wcbf$同构下的状态, 等价类$wcbf$ WHERE source='seed' AND letter='C' AND position=4;
UPDATE wiki_terms SET head_en=$wcbf$CCW (Counterclockwise)$wcbf$, head_zh=$wcbf$逆时针$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=5;
UPDATE wiki_terms SET head_en=$wcbf$CE (Cube Explorer)$wcbf$, head_zh=$wcbf$魔方探测器$wcbf$, body_en=$wcbf$A cube solving software program for desktop computers$wcbf$, body_zh=$wcbf$电脑版的三阶魔方公式求解器$wcbf$ WHERE source='seed' AND letter='C' AND position=6;
UPDATE wiki_terms SET head_en=$wcbf$Center$wcbf$, head_zh=$wcbf$中心块$wcbf$, body_en=$wcbf$The middle piece on each side of 3x3. For big cube, it refers to the pieces with only one color.$wcbf$, body_zh=$wcbf$三阶魔方中心的块. 对高阶魔方，指只含一个颜色的块.$wcbf$ WHERE source='seed' AND letter='C' AND position=7;
UPDATE wiki_terms SET head_en=$wcbf$CF (Corner First)$wcbf$, head_zh=$wcbf$角先$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=8;
UPDATE wiki_terms SET head_en=$wcbf$CFCE (Cross+F2L+CLL+ELL)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=9;
UPDATE wiki_terms SET head_en=$wcbf$CFOP (Cross-F2L-OLL-PLL) （$wcbf$, head_zh=$wcbf$十字 – 前两层 - 顶层排列 - 顶层色向）$wcbf$, body_en=$wcbf$CFOP, the most commonly used speedsolving method for 3x3, was first developed in the early 1980s combining innovations by a number of cubers. Jessica Fridrich popularized it by publishing it online in 1997.
C 190079
F
O 57
P 21$wcbf$, body_zh=$wcbf$最主流的三阶魔方速拧方法
不考虑每个阶段的还原态，CFOP法所有阶段共有190324个状态
标态41+非标126$wcbf$ WHERE source='seed' AND letter='C' AND position=10;
UPDATE wiki_terms SET head_en=$wcbf$Champion$wcbf$, head_zh=$wcbf$冠军$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=11;
UPDATE wiki_terms SET head_en=$wcbf$Championship$wcbf$, head_zh=$wcbf$锦标赛$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=12;
UPDATE wiki_terms SET head_en=$wcbf$Chinese Letter Scheme$wcbf$, head_zh=$wcbf$中式编码$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$也称为彳亍编码，块先编码。$wcbf$ WHERE source='seed' AND letter='C' AND position=13;
UPDATE wiki_terms SET head_en=$wcbf$Checker$wcbf$, head_zh=$wcbf$棋盘$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=14;
UPDATE wiki_terms SET head_en=$wcbf$Cleaning$wcbf$, head_zh=$wcbf$清洁$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=15;
UPDATE wiki_terms SET head_en=$wcbf$Clearing$wcbf$, head_zh=$wcbf$清理$wcbf$, body_en=$wcbf$Used in super big cube cage method$wcbf$, body_zh=$wcbf$用于超高阶魔方的笼法$wcbf$ WHERE source='seed' AND letter='C' AND position=16;
UPDATE wiki_terms SET head_en=$wcbf$CLL (Corners of Last Layer)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$Solving last layer corners [42]$wcbf$, body_zh=$wcbf$还原顶层角块$wcbf$ WHERE source='seed' AND letter='C' AND position=17;
UPDATE wiki_terms SET head_en=$wcbf$Clover Cube$wcbf$, head_zh=$wcbf$四叶草魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=18;
UPDATE wiki_terms SET head_en=$wcbf$CLS (Corner Last Slot) [104]$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$CLS solve last F2L corner and CO, assuming EO are solved
CLS$wcbf$, body_zh=$wcbf$是在EO已还原时，还原末组F2L的角和CO$wcbf$ WHERE source='seed' AND letter='C' AND position=19;
UPDATE wiki_terms SET head_en=$wcbf$CLSCP (CLS+CP)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$Solving the last F2L corner and LL corners, assuming LL edges are oriented$wcbf$, body_zh=$wcbf$顶层有棱十字的情况下，插入最后一组F2L的角块的同时还原顶层角块$wcbf$ WHERE source='seed' AND letter='C' AND position=20;
UPDATE wiki_terms SET head_en=$wcbf$CMLL (Corners and Orientation of Last Layer Ignoring M-Slice)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$One step in intermediate Roux method$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=21;
UPDATE wiki_terms SET head_en=$wcbf$CN (Color Neutrality)$wcbf$, head_zh=$wcbf$全色 (颜色中立)$wcbf$, body_en=$wcbf$The ability to start a puzzle on any color$wcbf$, body_zh=$wcbf$能从任意颜色开始还原魔方的能力$wcbf$ WHERE source='seed' AND letter='C' AND position=22;
UPDATE wiki_terms SET head_en=$wcbf$CO (Corner Orientation)$wcbf$, head_zh=$wcbf$翻角（角块色向）$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=23;
UPDATE wiki_terms SET head_en=$wcbf$COLL (Corners and Orientation of Last Layer) [42]$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$Solving LL corners, assuming EOLL is solved$wcbf$, body_zh=$wcbf$在不破坏顶层棱块色向的情况下，还原顶层角块$wcbf$ WHERE source='seed' AND letter='C' AND position=24;
UPDATE wiki_terms SET head_en=$wcbf$Color$wcbf$, head_zh=$wcbf$颜色$wcbf$, body_en=$wcbf$For example, consider the color where the red/green/blue values are decimal numbers: red=36, green=104, blue=160 (a grayish-blue color). The decimal numbers 36, 104 and 160 are equivalent to the hexadecimal numbers 24, 68 and A0 respectively. The hex triplet is obtained by concatenating the six hexadecimal digits together, 2468A0 in this example.$wcbf$, body_zh=$wcbf$十六进制表示的网页颜色 Web color in hexadecimal format: 白 white #FFFFFF; 红 red #EE0000; 绿 green #00D800; 蓝 blue #0000F2; 橙 orange #FFA100; 黄 yellow #FEFE00; 深灰背景 dark grey background #404040; 灰 grey #808080; 肉 flesh #EEE8AA; 深绿 dark green #1E8F57; 浅蓝 blue #ADD8E6.$wcbf$ WHERE source='seed' AND letter='C' AND position=25;
UPDATE wiki_terms SET head_en=$wcbf$Color Scheme$wcbf$, head_zh=$wcbf$配色方案$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=26;
UPDATE wiki_terms SET head_en=$wcbf$Color Rotation$wcbf$, head_zh=$wcbf$转色$wcbf$, body_en=$wcbf$Recoloring of the faces$wcbf$, body_zh=$wcbf$重新给魔方填色$wcbf$ WHERE source='seed' AND letter='C' AND position=27;
UPDATE wiki_terms SET head_en=$wcbf$Column$wcbf$, head_zh=$wcbf$列$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=28;
UPDATE wiki_terms SET head_en=$wcbf$Combo (Combination)$wcbf$, head_zh=$wcbf$叠加$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=29;
UPDATE wiki_terms SET head_en=$wcbf$Comm (Commutator)$wcbf$, head_zh=$wcbf$换位子$wcbf$, body_en=$wcbf$[A, B] = A B A' B'. Example: (R' D' R) (U) (R' D R) (U').$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=30;
UPDATE wiki_terms SET head_en=$wcbf$Comp (Competition)$wcbf$, head_zh=$wcbf$比赛$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=31;
UPDATE wiki_terms SET head_en=$wcbf$Competitor$wcbf$, head_zh=$wcbf$选手$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=32;
UPDATE wiki_terms SET head_en=$wcbf$Conj (Conjugate)$wcbf$, head_zh=$wcbf$共轭子$wcbf$, body_en=$wcbf$A: B = [A: B] = A B A', where A is setup, B is inverse. Example: (R U2 R') (R' F R F') (R U2 R').$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=33;
UPDATE wiki_terms SET head_en=$wcbf$Connect$wcbf$, head_zh=$wcbf$连接$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=34;
UPDATE wiki_terms SET head_en=$wcbf$Contact Surface$wcbf$, head_zh=$wcbf$接触面$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=35;
UPDATE wiki_terms SET head_en=$wcbf$COP$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$SQ1
CSP+OBL+PBL=170+73+967=1210$wcbf$, body_zh=$wcbf$顶尖还原方法$wcbf$ WHERE source='seed' AND letter='C' AND position=36;
UPDATE wiki_terms SET head_en=$wcbf$Continuous$wcbf$, head_zh=$wcbf$连续的$wcbf$, body_en=$wcbf$A pattern is called Continuous if two neighboring faces match along the edge. That is to say, two adjacent edge cubies and corner cubies have the same color on the first face if and only if they have the same color on the second face. Continuous patterns are good candidates for exceptionally beautiful patterns.$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=37;
UPDATE wiki_terms SET head_en=$wcbf$Corner$wcbf$, head_zh=$wcbf$角块$wcbf$, body_en=$wcbf$Pieces with three different colors for NxNxN cubes$wcbf$, body_zh=$wcbf$含三种颜色的块$wcbf$ WHERE source='seed' AND letter='C' AND position=38;
UPDATE wiki_terms SET head_en=$wcbf$Corner Cutting$wcbf$, head_zh=$wcbf$容错$wcbf$, body_en=$wcbf$The ability for a puzzle to turn when the layers of the cube are misaligned. There are 2 types: Regular corner cutting (R U', F R', etc.) and reverse corner cutting (R U, F R, etc.).$wcbf$, body_zh=$wcbf$当魔方没有对齐时，仍能转动魔方. 有两种类型：正容错(U' R, R U', F R'等) 和逆容错 (U R, R U, F R).$wcbf$ WHERE source='seed' AND letter='C' AND position=39;
UPDATE wiki_terms SET head_en=$wcbf$$wcbf$, head_zh=$wcbf$假设n>45°.$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$满足Un R能实现的最小n越小, 正容错能力越好;
满足Un' R能实现的最小n越小, 逆容错能力越好;$wcbf$ WHERE source='seed' AND letter='C' AND position=40;
UPDATE wiki_terms SET head_en=$wcbf$Corner Twists$wcbf$, head_zh=$wcbf$转角$wcbf$, body_en=$wcbf$The pieces of speedcubes need to move easily. Because of this sometimes corners can twist in their place. This can occur with very rounded corners as well as cubes on very loose tensions. A puzzle cannot be solved when a single corner twists in its place. It must be corrected before the solve can be finished.$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=41;
UPDATE wiki_terms SET head_en=$wcbf$Counting Solves$wcbf$, head_zh=$wcbf$计入成绩$wcbf$, body_en=$wcbf$A set of consecutive solves excluding best and worst solves$wcbf$, body_zh=$wcbf$去掉了最好和最坏的成绩的一组连续的还原$wcbf$ WHERE source='seed' AND letter='C' AND position=42;
UPDATE wiki_terms SET head_en=$wcbf$CP (Corner Permutation)$wcbf$, head_zh=$wcbf$角序（角块排列）$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=43;
UPDATE wiki_terms SET head_en=$wcbf$CPF2L (Corner in Place)$wcbf$, head_zh=$wcbf$角归位F2L$wcbf$, body_en=$wcbf$NF2L subset$wcbf$, body_zh=$wcbf$非标F2L子集$wcbf$ WHERE source='seed' AND letter='C' AND position=44;
UPDATE wiki_terms SET head_en=$wcbf$CPLL (Corner Permutation of Last Layer)$wcbf$, head_zh=$wcbf$顶层角序$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=45;
UPDATE wiki_terms SET head_en=$wcbf$CR (Continental Record)$wcbf$, head_zh=$wcbf$洲纪录$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=46;
UPDATE wiki_terms SET head_en=$wcbf$Cross$wcbf$, head_zh=$wcbf$十字$wcbf$, body_en=$wcbf$Solving 4 edge pieces around a center piece$wcbf$, body_zh=$wcbf$还原围绕某个中心块的四个棱块$wcbf$ WHERE source='seed' AND letter='C' AND position=47;
UPDATE wiki_terms SET head_en=$wcbf$Cross+n$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$cross and prediction of first n F2L$wcbf$, body_zh=$wcbf$十字+前n个F2L的预判$wcbf$ WHERE source='seed' AND letter='C' AND position=48;
UPDATE wiki_terms SET head_en=$wcbf$CS (Cubeshape)$wcbf$, head_zh=$wcbf$复形$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=49;
UPDATE wiki_terms SET head_en=$wcbf$CSP (Cubeshape Parity)$wcbf$, head_zh=$wcbf$复形奇偶$wcbf$, body_en=$wcbf$See page "SQ-1 CSP Algorithms".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=50;
UPDATE wiki_terms SET head_en=$wcbf$csTimer$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$Timer App by Shuang Chen$wcbf$, body_zh=$wcbf$陈霜设计的专业的魔方计时网站 https://cstimer.net/$wcbf$ WHERE source='seed' AND letter='C' AND position=51;
UPDATE wiki_terms SET head_en=$wcbf$Cube$wcbf$, head_zh=$wcbf$正阶魔方$wcbf$, body_en=$wcbf$Regular hexahedra puzzle$wcbf$, body_zh=$wcbf$正六面体魔方$wcbf$ WHERE source='seed' AND letter='C' AND position=52;
UPDATE wiki_terms SET head_en=$wcbf$Cube Cover$wcbf$, head_zh=$wcbf$魔方遮罩$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=53;
UPDATE wiki_terms SET head_en=$wcbf$CubeRoot$wcbf$, head_zh=$wcbf$魔方根$wcbf$, body_en=$wcbf$A website speedcubing tutorials and algorithms$wcbf$, body_zh=$wcbf$一个魔方速拧教程公式库 https://www.cuberoot.me/$wcbf$ WHERE source='seed' AND letter='C' AND position=54;
UPDATE wiki_terms SET head_en=$wcbf$CUF2L (Corner in U)$wcbf$, head_zh=$wcbf$顶角F2L$wcbf$, body_en=$wcbf$NF2L subset$wcbf$, body_zh=$wcbf$非标F2L子集$wcbf$ WHERE source='seed' AND letter='C' AND position=55;
UPDATE wiki_terms SET head_en=$wcbf$Cube Rotation$wcbf$, head_zh=$wcbf$整体旋转魔方$wcbf$, body_en=$wcbf$Rotating the cube in place without turning any side. The three rotational axes used in cube notation are x, y and z.$wcbf$, body_zh=$wcbf$在不转动任何面的情况下整体旋转魔方. 三个正交轴分别表示为 x, y, z.$wcbf$ WHERE source='seed' AND letter='C' AND position=56;
UPDATE wiki_terms SET head_en=$wcbf$Cubeography$wcbf$, head_zh=$wcbf$魔方美图 / 魔方摄影$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=57;
UPDATE wiki_terms SET head_en=$wcbf$Cuber$wcbf$, head_zh=$wcbf$魔友$wcbf$, body_en=$wcbf$Person who enjoy playing with cube or twisty puzzle$wcbf$, body_zh=$wcbf$喜欢玩魔方的人$wcbf$ WHERE source='seed' AND letter='C' AND position=58;
UPDATE wiki_terms SET head_en=$wcbf$Cubeshape$wcbf$, head_zh=$wcbf$复形$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=59;
UPDATE wiki_terms SET head_en=$wcbf$Cubie$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$Solvable piece on an NxNxN puzzle$wcbf$, body_zh=$wcbf$正阶魔方中能还原的块$wcbf$ WHERE source='seed' AND letter='C' AND position=60;
UPDATE wiki_terms SET head_en=$wcbf$Cubing$wcbf$, head_zh=$wcbf$玩魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=61;
UPDATE wiki_terms SET head_en=$wcbf$Cuboid$wcbf$, head_zh=$wcbf$矩体魔方$wcbf$, body_en=$wcbf$LxMxN cube LxMxN$wcbf$, body_zh=$wcbf$不等阶魔方$wcbf$ WHERE source='seed' AND letter='C' AND position=62;
UPDATE wiki_terms SET head_en=$wcbf$Cutoff$wcbf$, head_zh=$wcbf$及格线$wcbf$, body_en=$wcbf$A Cutoff Round is a round with a "Best of X" cutoff phase and a cutoff result (e.g. "Best of 2" with a cutoff result of 2 minutes). If the competitor meets the cutoff result in at least one of their cutoff phase attempts, they are eligible for the remaining attempts. Attempts from the cutoff phase count towards the full round format.$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=63;
UPDATE wiki_terms SET head_en=$wcbf$Curvy Copter$wcbf$, head_zh=$wcbf$花瓣直升机魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=64;
UPDATE wiki_terms SET head_en=$wcbf$CW (Clockwise)$wcbf$, head_zh=$wcbf$顺时针$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=65;
UPDATE wiki_terms SET head_en=$wcbf$CxLL (Corners Last Layer)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$A group of methods that solve LL corners, which contains COLL, CLL, CMLL$wcbf$, body_zh=$wcbf$还原顶层角块的系列方法，例如COLL, CLL, CMLL$wcbf$ WHERE source='seed' AND letter='C' AND position=66;
UPDATE wiki_terms SET head_en=$wcbf$Cycle$wcbf$, head_zh=$wcbf$循环，轮换$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=67;
UPDATE wiki_terms SET head_en=$wcbf$Cycle Break$wcbf$, head_zh=$wcbf$循环结束, 借位归位等$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=68;
UPDATE wiki_terms SET head_en=$wcbf$Cyclic Shifts$wcbf$, head_zh=$wcbf$循环移位$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$定义1. 若公式第一步放到最后一步不会改变公式的状态，再把刚刚得到的公式的第一步再放到最后一步也不会改变状态，等等等等，则称该公式可以进行循环移位
定义2. [A: B] [C: B] = A B A' C B C'$wcbf$ WHERE source='seed' AND letter='C' AND position=69;
UPDATE wiki_terms SET head_en=$wcbf$CZZ (Cross+ZBF2L+ZBLL)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='C' AND position=70;
UPDATE wiki_terms SET head_en=$wcbf$D (Down)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$A face move$wcbf$, body_zh=$wcbf$一种面转动$wcbf$ WHERE source='seed' AND letter='D' AND position=0;
UPDATE wiki_terms SET head_en=$wcbf$Daisy ($wcbf$, head_zh=$wcbf$十字上的) 小花$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='D' AND position=1;
UPDATE wiki_terms SET head_en=$wcbf$DCTimer$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$Timer App by Mingyuan Zhang
https://dctimer.cn/$wcbf$, body_zh=$wcbf$张铭源设计的专业的魔方计时器$wcbf$ WHERE source='seed' AND letter='D' AND position=2;
UPDATE wiki_terms SET head_en=$wcbf$DEC – (Double Extended Cross)$wcbf$, head_zh=$wcbf$双重拓展十字$wcbf$, body_en=$wcbf$See also "XXcross".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='D' AND position=3;
UPDATE wiki_terms SET head_en=$wcbf$Dedge (Double Edge)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$A block consisting of the two edge pieces on 4x4 that have the same pair of colors. A dedge can be moved around as if it were a single edge on a 3x3x3 cube.$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='D' AND position=4;
UPDATE wiki_terms SET head_en=$wcbf$Delegate$wcbf$, head_zh=$wcbf$代表$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='D' AND position=5;
UPDATE wiki_terms SET head_en=$wcbf$Defect$wcbf$, head_zh=$wcbf$故障$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='D' AND position=6;
UPDATE wiki_terms SET head_en=$wcbf$Devil's Algorithm$wcbf$, head_zh=$wcbf$恶魔公式$wcbf$, body_en=$wcbf$An algorithm whose repetitions can visit all states of the puzzle http://anttila.ca/michael/devilsalgorithm/$wcbf$, body_zh=$wcbf$重复若干遍就能遍历所有魔方状态的公式$wcbf$ WHERE source='seed' AND letter='D' AND position=7;
UPDATE wiki_terms SET head_en=$wcbf$Devil's Number$wcbf$, head_zh=$wcbf$恶魔之数$wcbf$, body_en=$wcbf$The minimum of moves in Devil's Algorithm$wcbf$, body_zh=$wcbf$恶魔公式步数最小值$wcbf$ WHERE source='seed' AND letter='D' AND position=8;
UPDATE wiki_terms SET head_en=$wcbf$Diag (Diagonal)$wcbf$, head_zh=$wcbf$对角上（对角线上的）$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='D' AND position=9;
UPDATE wiki_terms SET head_en=$wcbf$Diamond Member$wcbf$, head_zh=$wcbf$钻石会员$wcbf$, body_en=$wcbf$See also "Mollerz Memberships".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='D' AND position=10;
UPDATE wiki_terms SET head_en=$wcbf$Different$wcbf$, head_zh=$wcbf$不同的$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='D' AND position=11;
UPDATE wiki_terms SET head_en=$wcbf$Dino Cube$wcbf$, head_zh=$wcbf$X魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='D' AND position=12;
UPDATE wiki_terms SET head_en=$wcbf$Disassemble$wcbf$, head_zh=$wcbf$拆$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='D' AND position=13;
UPDATE wiki_terms SET head_en=$wcbf$Display$wcbf$, head_zh=$wcbf$大显$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$时间显示器$wcbf$ WHERE source='seed' AND letter='D' AND position=14;
UPDATE wiki_terms SET head_en=$wcbf$Distinctive$wcbf$, head_zh=$wcbf$本质的$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='D' AND position=15;
UPDATE wiki_terms SET head_en=$wcbf$DIY Cube$wcbf$, head_zh=$wcbf$自制魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='D' AND position=16;
UPDATE wiki_terms SET head_en=$wcbf$DNF (Did Not Finish)$wcbf$, head_zh=$wcbf$未完成$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='D' AND position=17;
UPDATE wiki_terms SET head_en=$wcbf$DNS (Did Not Start)$wcbf$, head_zh=$wcbf$放弃（未开始）$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='D' AND position=18;
UPDATE wiki_terms SET head_en=$wcbf$DR (Domino Reduction)$wcbf$, head_zh=$wcbf$多米诺降群, 色先法$wcbf$, body_en=$wcbf$Reduce the cube state to the state generated by <U, D, R2, L2, F2, B2>$wcbf$, body_zh=$wcbf$将魔方降群到<U, D, R2, L2, F2, B2>$wcbf$ WHERE source='seed' AND letter='D' AND position=19;
UPDATE wiki_terms SET head_en=$wcbf$DR Trigger$wcbf$, head_zh=$wcbf$多米诺降群触发器$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='D' AND position=20;
UPDATE wiki_terms SET head_en=$wcbf$Drag$wcbf$, head_zh=$wcbf$拉/拽$wcbf$, body_en=$wcbf$Use right ring finger to do U in (R U R' U'D) (R2 U' R U') (R' U R' U) R2 D'$wcbf$, body_zh=$wcbf$用右中指做(R U R' U'D) (R2 U' R U') (R' U R' U) R2 D'中的U$wcbf$ WHERE source='seed' AND letter='D' AND position=21;
UPDATE wiki_terms SET head_en=$wcbf$Drill$wcbf$, head_zh=$wcbf$训练$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='D' AND position=22;
UPDATE wiki_terms SET head_en=$wcbf$Dodecahedron$wcbf$, head_zh=$wcbf$十二面体$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='D' AND position=23;
UPDATE wiki_terms SET head_en=$wcbf$Dogic Cube$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='D' AND position=24;
UPDATE wiki_terms SET head_en=$wcbf$Domino Cube$wcbf$, head_zh=$wcbf$多米诺魔方$wcbf$, body_en=$wcbf$2x3x3 Cube 2x3x3$wcbf$, body_zh=$wcbf$魔方$wcbf$ WHERE source='seed' AND letter='D' AND position=25;
UPDATE wiki_terms SET head_en=$wcbf$Don$wcbf$, head_zh=$wcbf$戴眼罩$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='D' AND position=26;
UPDATE wiki_terms SET head_en=$wcbf$Dot$wcbf$, head_zh=$wcbf$点$wcbf$, body_en=$wcbf$A single sticker$wcbf$, body_zh=$wcbf$单独1个贴$wcbf$ WHERE source='seed' AND letter='D' AND position=27;
UPDATE wiki_terms SET head_en=$wcbf$Double Flick$wcbf$, head_zh=$wcbf$连拨$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='D' AND position=28;
UPDATE wiki_terms SET head_en=$wcbf$Double Turns$wcbf$, head_zh=$wcbf$二连转动$wcbf$, body_en=$wcbf$U2, R2, etc.$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='D' AND position=29;
UPDATE wiki_terms SET head_en=$wcbf$E (Equator)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$A slice move$wcbf$, body_zh=$wcbf$一种中层转动$wcbf$ WHERE source='seed' AND letter='E' AND position=0;
UPDATE wiki_terms SET head_en=$wcbf$E/O (Eka/Orozco)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$3BLD intermediate Method$wcbf$, body_zh=$wcbf$三盲进阶法$wcbf$ WHERE source='seed' AND letter='E' AND position=1;
UPDATE wiki_terms SET head_en=$wcbf$EC (Extended Cross)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$See also "Xcross".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='E' AND position=2;
UPDATE wiki_terms SET head_en=$wcbf$Edge$wcbf$, head_zh=$wcbf$棱块$wcbf$, body_en=$wcbf$Pieces with two different colors$wcbf$, body_zh=$wcbf$含两种颜色的块$wcbf$ WHERE source='seed' AND letter='E' AND position=3;
UPDATE wiki_terms SET head_en=$wcbf$Edge Control$wcbf$, head_zh=$wcbf$控棱$wcbf$, body_en=$wcbf$Intentionally orienting some last layer edges while solving F2L$wcbf$, body_zh=$wcbf$做F2L时有意识地还原顶层一些棱块的色向$wcbf$ WHERE source='seed' AND letter='E' AND position=4;
UPDATE wiki_terms SET head_en=$wcbf$Edge Flip$wcbf$, head_zh=$wcbf$翻棱$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='E' AND position=5;
UPDATE wiki_terms SET head_en=$wcbf$Efficient$wcbf$, head_zh=$wcbf$高效的$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='E' AND position=6;
UPDATE wiki_terms SET head_en=$wcbf$EG (Erik-Gunnar)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$2x2 advanced method that solving one face, and then finish the entire cube in one algorithm. EG includes CLL, EG-1, EG-2.$wcbf$, body_zh=$wcbf$二阶高级方法，先还原一面，再一次性还原整个魔方.$wcbf$ WHERE source='seed' AND letter='E' AND position=7;
UPDATE wiki_terms SET head_en=$wcbf$Eido$wcbf$, head_zh=$wcbf$爱朵$wcbf$, body_en=$wcbf$Left index finger pushes U2' in (R U' R' U') (R U R D) (R' U' R D') R' U2 R' U2'$wcbf$, body_zh=$wcbf$用左食指做(R U' R' U') (R U R D) (R' U' R D') R' U2 R' U2'中的U2'$wcbf$ WHERE source='seed' AND letter='E' AND position=8;
UPDATE wiki_terms SET head_en=$wcbf$$wcbf$, head_zh=$wcbf$或R2'$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='E' AND position=9;
UPDATE wiki_terms SET head_en=$wcbf$Eka$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$A 3BLD edge intermediate method invented by Adrian Dębski and popularized by Grigorii Alekseev
Adrian Dębski$wcbf$, body_zh=$wcbf$发明的, Grigorii Alekseev推广的三盲棱进阶法$wcbf$ WHERE source='seed' AND letter='E' AND position=10;
UPDATE wiki_terms SET head_en=$wcbf$Elasticity$wcbf$, head_zh=$wcbf$弹力$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='E' AND position=11;
UPDATE wiki_terms SET head_en=$wcbf$Elite Kilominx$wcbf$, head_zh=$wcbf$六阶五魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='E' AND position=12;
UPDATE wiki_terms SET head_en=$wcbf$ELL (Edges of LL)$wcbf$, head_zh=$wcbf$还原顶层棱块$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='E' AND position=13;
UPDATE wiki_terms SET head_en=$wcbf$ELS (Edge Last Slot) [21]$wcbf$, head_zh=$wcbf$棱末槽$wcbf$, body_en=$wcbf$MGLS sub-step solves LS edge and EOLL$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='E' AND position=14;
UPDATE wiki_terms SET head_en=$wcbf$EMS$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$E,M,S moves are frequently used in 3-style edge  E,M,S$wcbf$, body_zh=$wcbf$转动在三循环棱里被频繁使用$wcbf$ WHERE source='seed' AND letter='E' AND position=15;
UPDATE wiki_terms SET head_en=$wcbf$EO (Edge Orientation)$wcbf$, head_zh=$wcbf$翻棱（棱块色向）$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='E' AND position=16;
UPDATE wiki_terms SET head_en=$wcbf$EOcross (EO+cross)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='E' AND position=17;
UPDATE wiki_terms SET head_en=$wcbf$EOFC (EO of F2L and Cross)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='E' AND position=18;
UPDATE wiki_terms SET head_en=$wcbf$EOLine$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$The first step of ZZ method: solve all EO, and DR and DB edges. ZZ$wcbf$, body_zh=$wcbf$法的第一步: 还原EO, 以及DR和DB棱.$wcbf$ WHERE source='seed' AND letter='E' AND position=19;
UPDATE wiki_terms SET head_en=$wcbf$EOLL (EO of LL)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='E' AND position=20;
UPDATE wiki_terms SET head_en=$wcbf$EOLR (Edge Orientation Left & Right)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$A step in advanced Roux method$wcbf$, body_zh=$wcbf$高级桥式玩法中的一个步骤$wcbf$ WHERE source='seed' AND letter='E' AND position=21;
UPDATE wiki_terms SET head_en=$wcbf$EOLS (EO + LS)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='E' AND position=22;
UPDATE wiki_terms SET head_en=$wcbf$EP (Edge Permutation)$wcbf$, head_zh=$wcbf$棱序（棱块排列）$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='E' AND position=23;
UPDATE wiki_terms SET head_en=$wcbf$EPF2L (Egde in Place)$wcbf$, head_zh=$wcbf$棱归位F2L$wcbf$, body_en=$wcbf$NF2L subset$wcbf$, body_zh=$wcbf$非标F2L子集$wcbf$ WHERE source='seed' AND letter='E' AND position=24;
UPDATE wiki_terms SET head_en=$wcbf$EPLL (Edge Permutation of Last Layer)$wcbf$, head_zh=$wcbf$顶层棱序$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='E' AND position=25;
UPDATE wiki_terms SET head_en=$wcbf$Eparity (Edge Parity)$wcbf$, head_zh=$wcbf$棱特$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='E' AND position=26;
UPDATE wiki_terms SET head_en=$wcbf$Equator$wcbf$, head_zh=$wcbf$赤道$wcbf$, body_en=$wcbf$Middle layer on SQ1, 3x3  SQ1,$wcbf$, body_zh=$wcbf$三阶的中层$wcbf$ WHERE source='seed' AND letter='E' AND position=27;
UPDATE wiki_terms SET head_en=$wcbf$ER (European Record/Rank)$wcbf$, head_zh=$wcbf$欧洲纪录/排名$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='E' AND position=28;
UPDATE wiki_terms SET head_en=$wcbf$ETM (Execution Turn Metric)$wcbf$, head_zh=$wcbf$执行转动度量制$wcbf$, body_en=$wcbf$A metric for 3x3 where any perceived movement counts as a turn. Each move of the categories Face Moves, Outer Block Moves, and Rotations is counted as 1 move.$wcbf$, body_zh=$wcbf$任意单个实际操作计数为1的度量制. 每个面转动, 外部转动以及整体转动计1步.
在SQ1中, 是/转动, 及UD层同时转动计数为1的度量制$wcbf$ WHERE source='seed' AND letter='E' AND position=29;
UPDATE wiki_terms SET head_en=$wcbf$EUF2L (Egde in U)$wcbf$, head_zh=$wcbf$顶棱F2L$wcbf$, body_en=$wcbf$NF2L subset$wcbf$, body_zh=$wcbf$非标F2L子集$wcbf$ WHERE source='seed' AND letter='E' AND position=30;
UPDATE wiki_terms SET head_en=$wcbf$Examinx$wcbf$, head_zh=$wcbf$十一阶五魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='E' AND position=31;
UPDATE wiki_terms SET head_en=$wcbf$Example Solve$wcbf$, head_zh=$wcbf$实例$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='E' AND position=32;
UPDATE wiki_terms SET head_en=$wcbf$Exec (Execute)$wcbf$, head_zh=$wcbf$执行$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='E' AND position=33;
UPDATE wiki_terms SET head_en=$wcbf$exPLL (PLL Execution) PLL$wcbf$, head_zh=$wcbf$连拧$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='E' AND position=34;
UPDATE wiki_terms SET head_en=$wcbf$F (Front)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$A face move$wcbf$, body_zh=$wcbf$一种面转动$wcbf$ WHERE source='seed' AND letter='F' AND position=0;
UPDATE wiki_terms SET head_en=$wcbf$F2L (First Two Layers)$wcbf$, head_zh=$wcbf$前两层, 前两层的四个槽$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=1;
UPDATE wiki_terms SET head_en=$wcbf$F2L-1 (F2L Minus One) F2L$wcbf$, head_zh=$wcbf$减一$wcbf$, body_en=$wcbf$See also "TEC".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=2;
UPDATE wiki_terms SET head_en=$wcbf$F2L-F2B$wcbf$, head_zh=$wcbf$F桥$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$优先放DR棱的右桥方式$wcbf$ WHERE source='seed' AND letter='F' AND position=3;
UPDATE wiki_terms SET head_en=$wcbf$F2L Orientation   F2L$wcbf$, head_zh=$wcbf$色向$wcbf$, body_en=$wcbf$S-axis orientation of edge of F2L  F2L$wcbf$, body_zh=$wcbf$棱关于S轴的色向$wcbf$ WHERE source='seed' AND letter='F' AND position=4;
UPDATE wiki_terms SET head_en=$wcbf$F3L (First Three Layers)$wcbf$, head_zh=$wcbf$前三层$wcbf$, body_en=$wcbf$Use in 4x4$wcbf$, body_zh=$wcbf$用于四阶$wcbf$ WHERE source='seed' AND letter='F' AND position=5;
UPDATE wiki_terms SET head_en=$wcbf$Face$wcbf$, head_zh=$wcbf$面$wcbf$, body_en=$wcbf$A single surface$wcbf$, body_zh=$wcbf$一个单独的表面$wcbf$ WHERE source='seed' AND letter='F' AND position=6;
UPDATE wiki_terms SET head_en=$wcbf$Facet$wcbf$, head_zh=$wcbf$色块$wcbf$, body_en=$wcbf$See also "sticker".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=7;
UPDATE wiki_terms SET head_en=$wcbf$Face-First$wcbf$, head_zh=$wcbf$面先法$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=8;
UPDATE wiki_terms SET head_en=$wcbf$Factory Solves$wcbf$, head_zh=$wcbf$工厂还原$wcbf$, body_en=$wcbf$It involves a scrambled cube for every solver (or sometimes just one cube between solvers), and after each step of the CFOP method, the cube is passed to the next person in the line.$wcbf$, body_zh=$wcbf$多人按步骤共同还原一个魔方.$wcbf$ WHERE source='seed' AND letter='F' AND position=9;
UPDATE wiki_terms SET head_en=$wcbf$Fat Sune$wcbf$, head_zh=$wcbf$胖小鱼$wcbf$, body_en=$wcbf$r U R' U R U2 r'$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=10;
UPDATE wiki_terms SET head_en=$wcbf$FB (First Block)$wcbf$, head_zh=$wcbf$左桥, 第一桥$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=11;
UPDATE wiki_terms SET head_en=$wcbf$FBDR (FB + DR Edge)$wcbf$, head_zh=$wcbf$左桥右底棱$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=12;
UPDATE wiki_terms SET head_en=$wcbf$FBF (Face-By-Face)$wcbf$, head_zh=$wcbf$面先法$wcbf$, body_en=$wcbf$A 2x2 advanced method which makes a face first$wcbf$, body_zh=$wcbf$首先完成一个面的二阶魔方高级还原方法$wcbf$ WHERE source='seed' AND letter='F' AND position=13;
UPDATE wiki_terms SET head_en=$wcbf$FBFS (FB + FS)$wcbf$, head_zh=$wcbf$左桥首方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=14;
UPDATE wiki_terms SET head_en=$wcbf$FBLP (FB's LP)$wcbf$, head_zh=$wcbf$左桥末槽$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=15;
UPDATE wiki_terms SET head_en=$wcbf$FC (Fixed Color)$wcbf$, head_zh=$wcbf$单色底$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=16;
UPDATE wiki_terms SET head_en=$wcbf$FCN (Fixed Corner Notation)$wcbf$, head_zh=$wcbf$固定角转动记号$wcbf$, body_en=$wcbf$R, U, L, B. Used in skewb WCA notation$wcbf$, body_zh=$wcbf$用于斜转的WCA记号$wcbf$ WHERE source='seed' AND letter='F' AND position=17;
UPDATE wiki_terms SET head_en=$wcbf$Finger Trick$wcbf$, head_zh=$wcbf$指法$wcbf$, body_en=$wcbf$Skillful acts for fingers to execute algorithms very fast$wcbf$, body_zh=$wcbf$有技巧的指法能让公式执行得很快$wcbf$ WHERE source='seed' AND letter='F' AND position=18;
UPDATE wiki_terms SET head_en=$wcbf$Fingertrickable$wcbf$, head_zh=$wcbf$顺手的$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=19;
UPDATE wiki_terms SET head_en=$wcbf$First-Timer$wcbf$, head_zh=$wcbf$首次参赛者$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=20;
UPDATE wiki_terms SET head_en=$wcbf$Fisher Cube$wcbf$, head_zh=$wcbf$费舍尔魔方 (移棱魔方)$wcbf$, body_en=$wcbf$This cube, invented by Tony Fisher, that has been rotated on one axis rotated 45 degrees internally, known as fishering.
Fixed Center (Center-Center)$wcbf$, body_zh=$wcbf$固定中心 (正中心)$wcbf$ WHERE source='seed' AND letter='F' AND position=21;
UPDATE wiki_terms SET head_en=$wcbf$FL (First Layer)$wcbf$, head_zh=$wcbf$底层$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=22;
UPDATE wiki_terms SET head_en=$wcbf$Flagship$wcbf$, head_zh=$wcbf$旗舰$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=23;
UPDATE wiki_terms SET head_en=$wcbf$Flick$wcbf$, head_zh=$wcbf$拨$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=24;
UPDATE wiki_terms SET head_en=$wcbf$Flip$wcbf$, head_zh=$wcbf$翻棱$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=25;
UPDATE wiki_terms SET head_en=$wcbf$Flipped in Place$wcbf$, head_zh=$wcbf$原地翻$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=26;
UPDATE wiki_terms SET head_en=$wcbf$Floppy Cube$wcbf$, head_zh=$wcbf$单层魔方$wcbf$, body_en=$wcbf$1xMxN Cuboid 1xMxN$wcbf$, body_zh=$wcbf$的矩体魔方$wcbf$ WHERE source='seed' AND letter='F' AND position=27;
UPDATE wiki_terms SET head_en=$wcbf$Float$wcbf$, head_zh=$wcbf$浮动的$wcbf$, body_en=$wcbf$3BLD concept$wcbf$, body_zh=$wcbf$三盲概念$wcbf$ WHERE source='seed' AND letter='F' AND position=28;
UPDATE wiki_terms SET head_en=$wcbf$Float Buffer$wcbf$, head_zh=$wcbf$浮动缓冲$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=29;
UPDATE wiki_terms SET head_en=$wcbf$FLS (Flipped Last Slot)$wcbf$, head_zh=$wcbf$翻末槽棱$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=30;
UPDATE wiki_terms SET head_en=$wcbf$FM (Fewest Moves)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=31;
UPDATE wiki_terms SET head_en=$wcbf$FMC (Fewest Moves Challenge)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$See also FM.$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=32;
UPDATE wiki_terms SET head_en=$wcbf$FnC (First n Centers)$wcbf$, head_zh=$wcbf$前n中心$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=33;
UPDATE wiki_terms SET head_en=$wcbf$FnE (First n Edges)$wcbf$, head_zh=$wcbf$前n棱$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=34;
UPDATE wiki_terms SET head_en=$wcbf$Force Cube$wcbf$, head_zh=$wcbf$拼纯魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=35;
UPDATE wiki_terms SET head_en=$wcbf$Forward Slash$wcbf$, head_zh=$wcbf$斜杠$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=36;
UPDATE wiki_terms SET head_en=$wcbf$FR (Floppy Reduction)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$The cube can be solved with <F2B2R2L2>$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=37;
UPDATE wiki_terms SET head_en=$wcbf$Framecount$wcbf$, head_zh=$wcbf$数帧$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=38;
UPDATE wiki_terms SET head_en=$wcbf$Free F2B$wcbf$, head_zh=$wcbf$自由桥$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$把右桥任意棱块看做DR棱, 进而完成右桥122$wcbf$ WHERE source='seed' AND letter='F' AND position=39;
UPDATE wiki_terms SET head_en=$wcbf$Free Slice$wcbf$, head_zh=$wcbf$自由中层$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=40;
UPDATE wiki_terms SET head_en=$wcbf$Free Pair$wcbf$, head_zh=$wcbf$基态$wcbf$, body_en=$wcbf$F2L1~4$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=41;
UPDATE wiki_terms SET head_en=$wcbf$Fridrich Method$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$See also "CFOP".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=42;
UPDATE wiki_terms SET head_en=$wcbf$FS (First Square)$wcbf$, head_zh=$wcbf$首方$wcbf$, body_en=$wcbf$First 1x2x2$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=43;
UPDATE wiki_terms SET head_en=$wcbf$FT (Feet)$wcbf$, head_zh=$wcbf$脚拧$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=44;
UPDATE wiki_terms SET head_en=$wcbf$FTO (Face-Turning Octahedron)$wcbf$, head_zh=$wcbf$转面八面体魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=45;
UPDATE wiki_terms SET head_en=$wcbf$Full-Bright$wcbf$, head_zh=$wcbf$全亮$wcbf$, body_en=$wcbf$Color type of stickers$wcbf$, body_zh=$wcbf$贴纸的颜色种类$wcbf$ WHERE source='seed' AND letter='F' AND position=46;
UPDATE wiki_terms SET head_en=$wcbf$Full-Corner Cutting$wcbf$, head_zh=$wcbf$全容错$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=47;
UPDATE wiki_terms SET head_en=$wcbf$Full Step$wcbf$, head_zh=$wcbf$无跳$wcbf$, body_en=$wcbf$One did not skip any step during solving$wcbf$, body_zh=$wcbf$还原时没有跳过任何步骤$wcbf$ WHERE source='seed' AND letter='F' AND position=48;
UPDATE wiki_terms SET head_en=$wcbf$FWR (Female World Record)$wcbf$, head_zh=$wcbf$女子世界纪录$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='F' AND position=49;
UPDATE wiki_terms SET head_en=$wcbf$Gear Cube$wcbf$, head_zh=$wcbf$齿轮魔方$wcbf$, body_en=$wcbf$The Gear cube (also known as the Caution cube) is a twistable puzzle in the shape of a cube that is cut two times along each of three axes, as a 3x3x3. Moreover, there are geared edges. That means the edges can turn around themselves.$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='G' AND position=0;
UPDATE wiki_terms SET head_en=$wcbf$Ghost Cube$wcbf$, head_zh=$wcbf$鬼魔$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='G' AND position=1;
UPDATE wiki_terms SET head_en=$wcbf$Gigaminx$wcbf$, head_zh=$wcbf$五阶五魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='G' AND position=2;
UPDATE wiki_terms SET head_en=$wcbf$Gigamorphix$wcbf$, head_zh=$wcbf$五阶魔粽$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='G' AND position=3;
UPDATE wiki_terms SET head_en=$wcbf$Grand Slam$wcbf$, head_zh=$wcbf$大满贯$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$世锦赛 + 洲锦赛 + 国家级赛事的项目冠军. 若选手所在洲暂无洲锦赛, 则不需要洲锦赛这一条. 目前冇大洋洲和北美洲锦标赛, 以后要是有了, 那就需要重新统计.$wcbf$ WHERE source='seed' AND letter='G' AND position=4;
UPDATE wiki_terms SET head_en=$wcbf$$wcbf$, head_zh=$wcbf$三阶: Feliks Zemdegs (澳大利亚), Max Park (美国), Philipp Weyer (德国)$wcbf$, body_en=$wcbf$SQ1: Piotr Michał Padlewski ($wcbf$, body_zh=$wcbf$二阶: Rowe Hessler (美国), Feliks Zemdegs (澳大利亚), Cameron Stollery (澳大利亚)
四阶: Feliks Zemdegs (澳大利亚), Max Park (美国), Sebastian Weyer (德国)
五阶: Frank Morris (美国), Dan Cohen (美国), Feliks Zemdegs (澳大利亚), Kevin Hays (美国), Max Park (美国)
六阶: Dan Cohen (美国), Feliks Zemdegs (澳大利亚), Kevin Hays (美国), Max Park (美国)
七阶: Michał Halczuk (波兰), Feliks Zemdegs (澳大利亚), Bence Barát (匈牙利), Kevin Hays (美国), Max Park (美国)
三盲: Dror Vomberg (以色列), Leyan Lo, Zane Carney (澳大利亚), Marcell Endrey (匈牙利), Kabyanil Talukdar (印度)
最少步: Sébastien Auroux (德国), Steven Xu (美国), João Pedro Batista Ribeiro Costa (巴西), Christopher Chi (最少步)
单手: Chris Hardwick (美国), Ryan Patricio (美国), 伏見有史 (日本), Feliks Zemdegs (澳大利亚)
魔表: Ernesto Fernández Regueira (西班牙), Deven Nadudvari (美国), Niko Ronkainen (芬兰), Wojciech Knott (波兰)
五魔方: Grant Tregay (美国), Erik Akkersdijk (荷兰), Bálint Bodor (匈牙利), Simon Westlund (瑞典), Oscar Roth Andersen (丹麦), Juan Pablo Huanqui (五魔)
金字塔: 岡要平 (日本), Jules Desjardin (法国), Drew Brads (美国)
斜转: Daniel Wallin (瑞典),
波兰), Emanuel Rheinert (德国), Jayden McNeill (澳大利亚)
四盲: Chris Hardwick (美国), Marcell Endrey (匈牙利), Bill Wang (加拿大), Stanley Chapel (美国)
五盲: Chris Hardwick (美国), Tom Nelson (新西兰), Stanley Chapel (美国)
多盲: Marcell Endrey (匈牙利), Shivam Bansal (印度), Graham Siggins (美国)$wcbf$ WHERE source='seed' AND letter='G' AND position=5;
UPDATE wiki_terms SET head_en=$wcbf$Grip$wcbf$, head_zh=$wcbf$起手, 抓住$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='G' AND position=6;
UPDATE wiki_terms SET head_en=$wcbf$Grip Shift$wcbf$, head_zh=$wcbf$换手移位$wcbf$, body_en=$wcbf$Right thumb touches Center on F, then left thumb touches Center on F, vice versa.$wcbf$, body_zh=$wcbf$F面中心由右拇指接触换成左拇指接触, 或反过来$wcbf$ WHERE source='seed' AND letter='G' AND position=7;
UPDATE wiki_terms SET head_en=$wcbf$Group$wcbf$, head_zh=$wcbf$群$wcbf$, body_en=$wcbf$A mathematical structure. The set of all states of Rubik's cube form a group.$wcbf$, body_zh=$wcbf$一种数学结构. 三阶魔方所有状态的集合构成一个群.$wcbf$ WHERE source='seed' AND letter='G' AND position=8;
UPDATE wiki_terms SET head_en=$wcbf$GTS (Guess The Statistics)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$猜数据游戏$wcbf$ WHERE source='seed' AND letter='G' AND position=9;
UPDATE wiki_terms SET head_en=$wcbf$Go Through$wcbf$, head_zh=$wcbf$遍历$wcbf$, body_en=$wcbf$Traverse$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='G' AND position=10;
UPDATE wiki_terms SET head_en=$wcbf$Gold Member$wcbf$, head_zh=$wcbf$黄金会员$wcbf$, body_en=$wcbf$See also "Mollerz Memberships".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='G' AND position=11;
UPDATE wiki_terms SET head_en=$wcbf$God's Algorithm$wcbf$, head_zh=$wcbf$上帝公式$wcbf$, body_en=$wcbf$The optimal solution from a puzzle state to another state, commonly the solved state$wcbf$, body_zh=$wcbf$魔方从一个状态到另一个状态的最优解（最少步解）$wcbf$ WHERE source='seed' AND letter='G' AND position=12;
UPDATE wiki_terms SET head_en=$wcbf$God's Number$wcbf$, head_zh=$wcbf$上帝之数$wcbf$, body_en=$wcbf$The diameter of the group of the puzzle (the furthest distance two states can be from each other)$wcbf$, body_zh=$wcbf$魔方群直径，即还原一个任意打乱的魔方所需要的最少步数$wcbf$ WHERE source='seed' AND letter='G' AND position=13;
UPDATE wiki_terms SET head_en=$wcbf$Good Edge$wcbf$, head_zh=$wcbf$好棱$wcbf$, body_en=$wcbf$Oriented edge$wcbf$, body_zh=$wcbf$正向棱$wcbf$ WHERE source='seed' AND letter='G' AND position=14;
UPDATE wiki_terms SET head_en=$wcbf$Grouping$wcbf$, head_zh=$wcbf$组合$wcbf$, body_en=$wcbf$Sequences of moves can be grouped using brackets: (R U F)$wcbf$, body_zh=$wcbf$转动序列可用括号进行组合: (R U F)$wcbf$ WHERE source='seed' AND letter='G' AND position=15;
UPDATE wiki_terms SET head_en=$wcbf$Guimond (Gaétan Guimond)$wcbf$, head_zh=$wcbf$色先法（吉蒙德法）$wcbf$, body_en=$wcbf$A 2x2 method$wcbf$, body_zh=$wcbf$二阶方法$wcbf$ WHERE source='seed' AND letter='G' AND position=16;
UPDATE wiki_terms SET head_en=$wcbf$Half-Bright$wcbf$, head_zh=$wcbf$半亮$wcbf$, body_en=$wcbf$Color type of stickers$wcbf$, body_zh=$wcbf$贴纸的颜色种类$wcbf$ WHERE source='seed' AND letter='H' AND position=0;
UPDATE wiki_terms SET head_en=$wcbf$Half Slice-Plane$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$[A,B], where A, B are 1 STM, 1HTM$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='H' AND position=1;
UPDATE wiki_terms SET head_en=$wcbf$Half Turn$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$Any 180 degree turn$wcbf$, body_zh=$wcbf$任意面的180°旋转$wcbf$ WHERE source='seed' AND letter='H' AND position=2;
UPDATE wiki_terms SET head_en=$wcbf$Handfeel$wcbf$, head_zh=$wcbf$手感$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='H' AND position=3;
UPDATE wiki_terms SET head_en=$wcbf$Hanoiminx$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='H' AND position=4;
UPDATE wiki_terms SET head_en=$wcbf$Hard Regrip$wcbf$, head_zh=$wcbf$硬换手$wcbf$, body_en=$wcbf$Non-soft regrip$wcbf$, body_zh=$wcbf$非软换手$wcbf$ WHERE source='seed' AND letter='H' AND position=5;
UPDATE wiki_terms SET head_en=$wcbf$Hedge (Hedgeslammer) (F R' F' R)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='H' AND position=6;
UPDATE wiki_terms SET head_en=$wcbf$Headlight$wcbf$, head_zh=$wcbf$头灯$wcbf$, body_en=$wcbf$See also "light".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='H' AND position=7;
UPDATE wiki_terms SET head_en=$wcbf$Heise$wcbf$, head_zh=$wcbf$海斯法$wcbf$, body_en=$wcbf$FM method$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='H' AND position=8;
UPDATE wiki_terms SET head_en=$wcbf$Helicopter Cube$wcbf$, head_zh=$wcbf$直升机魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='H' AND position=9;
UPDATE wiki_terms SET head_en=$wcbf$Hexahedron$wcbf$, head_zh=$wcbf$六面体$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='H' AND position=10;
UPDATE wiki_terms SET head_en=$wcbf$HLS (Hessler Last Slot)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$a 3x3x3 subset in which the last F2L pair that can be solved alone with R U R' or L' U' L, and OLL are solved simultaneously$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='H' AND position=11;
UPDATE wiki_terms SET head_en=$wcbf$HTA (Human Thistlethwaite Algorithm)$wcbf$, head_zh=$wcbf$人脑西斯尔思韦特公式$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='H' AND position=12;
UPDATE wiki_terms SET head_en=$wcbf$HTM (Half Turn Metric)$wcbf$, head_zh=$wcbf$半圈转动度量制$wcbf$, body_en=$wcbf$A metric for 3x3 where any turn of any face, by any angle, counts as 1 turn$wcbf$, body_zh=$wcbf$任意面的任意一次转动计数为1的度量制$wcbf$ WHERE source='seed' AND letter='H' AND position=13;
UPDATE wiki_terms SET head_en=$wcbf$Hollow$wcbf$, head_zh=$wcbf$中空的$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='H' AND position=14;
UPDATE wiki_terms SET head_en=$wcbf$Home Position$wcbf$, head_zh=$wcbf$块还原后所在位置$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='H' AND position=15;
UPDATE wiki_terms SET head_en=$wcbf$Home Grip$wcbf$, head_zh=$wcbf$中手$wcbf$, body_en=$wcbf$Start thumb from middle$wcbf$, body_zh=$wcbf$起手中手, 本位起手$wcbf$ WHERE source='seed' AND letter='H' AND position=16;
UPDATE wiki_terms SET head_en=$wcbf$Honeycomb$wcbf$, head_zh=$wcbf$蜂巢$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='H' AND position=17;
UPDATE wiki_terms SET head_en=$wcbf$Hoya$wcbf$, head_zh=$wcbf$霍亚法$wcbf$, body_en=$wcbf$4x4 method.$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='H' AND position=18;
UPDATE wiki_terms SET head_en=$wcbf$HTR (Half Turn Reduction)$wcbf$, head_zh=$wcbf$半圈转动降群$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='H' AND position=19;
UPDATE wiki_terms SET head_en=$wcbf$Icosahedron$wcbf$, head_zh=$wcbf$二十面体$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='I' AND position=0;
UPDATE wiki_terms SET head_en=$wcbf$Identity Algorithm$wcbf$, head_zh=$wcbf$还原态公式$wcbf$, body_en=$wcbf$An alg C is called an identity alg if C solves a solved state I.$wcbf$, body_zh=$wcbf$称公式C为还原态公式, 若C能还原还原态I.$wcbf$ WHERE source='seed' AND letter='I' AND position=1;
UPDATE wiki_terms SET head_en=$wcbf$In Place$wcbf$, head_zh=$wcbf$归位, 原地$wcbf$, body_en=$wcbf$In the correct spot (but can be solved, flipped, twisty).$wcbf$, body_zh=$wcbf$在正确位置 (但可能是已还原, 翻棱或转角)$wcbf$ WHERE source='seed' AND letter='I' AND position=2;
UPDATE wiki_terms SET head_en=$wcbf$Influencing$wcbf$, head_zh=$wcbf$预控$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='I' AND position=3;
UPDATE wiki_terms SET head_en=$wcbf$Inner Shell$wcbf$, head_zh=$wcbf$内壳$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='I' AND position=4;
UPDATE wiki_terms SET head_en=$wcbf$Insertion$wcbf$, head_zh=$wcbf$插入，入槽$wcbf$, body_en=$wcbf$In CFOP method, it refers to F2L. In BLD 3-Style method, it refers to 3 moves that inserts the sticker outside of the interchange into one of the stickers in the interchange without disturbing the rest of the interchange layer.
In FMC, it is a technique. See also "Skeleton".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='I' AND position=5;
UPDATE wiki_terms SET head_en=$wcbf$Inspection$wcbf$, head_zh=$wcbf$观察$wcbf$, body_en=$wcbf$The time used to inspect the cube before starting a solve. In WCA competitions, the maximum inspection time is 15 seconds.$wcbf$, body_zh=$wcbf$在还原魔方前的观察时间. WCA 比赛中最长观察时间为15s.$wcbf$ WHERE source='seed' AND letter='I' AND position=6;
UPDATE wiki_terms SET head_en=$wcbf$Interchange$wcbf$, head_zh=$wcbf$交换$wcbf$, body_en=$wcbf$A single move that moves one sticker into another sticker’s spot without disturbing the 3rd sticker$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='I' AND position=7;
UPDATE wiki_terms SET head_en=$wcbf$Intermediate Method$wcbf$, head_zh=$wcbf$进阶方法$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='I' AND position=8;
UPDATE wiki_terms SET head_en=$wcbf$Internal$wcbf$, head_zh=$wcbf$内核/底$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='I' AND position=9;
UPDATE wiki_terms SET head_en=$wcbf$Intuitive Solving$wcbf$, head_zh=$wcbf$直观还原$wcbf$, body_en=$wcbf$Intuitive solving consists in solving the Rubik's cube without using any algorithm that you do not understand. In most methods, for example for the last layer, most algorithm are used in such way that there is an input cube in some state, then you apply the appropriate algorithm that you learnt by heart, and quite magically, the cube is in the desired state.$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='I' AND position=10;
UPDATE wiki_terms SET head_en=$wcbf$Inverse$wcbf$, head_zh=$wcbf$逆序, 逆预设$wcbf$, body_en=$wcbf$The inverse of A B C is C' B' A'. A B$wcbf$, body_zh=$wcbf$C的逆序是C' B' A'.$wcbf$ WHERE source='seed' AND letter='I' AND position=11;
UPDATE wiki_terms SET head_en=$wcbf$Inverse Case$wcbf$, head_zh=$wcbf$逆情况$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='I' AND position=12;
UPDATE wiki_terms SET head_en=$wcbf$Isomorphism$wcbf$, head_zh=$wcbf$同构$wcbf$, body_en=$wcbf$See also Isomorphy.$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='I' AND position=13;
UPDATE wiki_terms SET head_en=$wcbf$Isomorphy$wcbf$, head_zh=$wcbf$同构体$wcbf$, body_en=$wcbf$2 cube states are called isomorphic if they are essentially the same. 24 cube rotations, 24 reflections, and/or 24 color rotations of one cube will transform it into the other cube.$wcbf$, body_zh=$wcbf$两个魔方状态被称为同构的, 若它们本质上一样. 即存在一种转体 (旋转) [24], 镜像 [24] 或转色 (颜色轮换) [24] 操作, 对其中一个状态进行该操作就会变成另一个状态. 注: 转色是配色的置换, 即6次对称群作用在配色的6元集上得到集合.
两个情况同构的必要条件有: 砖结构相同; 连色数量相同; 对称类型相同; 存在相同解法 (不考虑开头的转体), 对某个阶段存在相同解法 (例如十字, 底面, 222, 底层等), 最优解法长度相同.$wcbf$ WHERE source='seed' AND letter='I' AND position=14;
UPDATE wiki_terms SET head_en=$wcbf$Ivy Cube$wcbf$, head_zh=$wcbf$枫叶魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='I' AND position=15;
UPDATE wiki_terms SET head_en=$wcbf$Judge$wcbf$, head_zh=$wcbf$裁判$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='J' AND position=0;
UPDATE wiki_terms SET head_en=$wcbf$Jumble$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='J' AND position=1;
UPDATE wiki_terms SET head_en=$wcbf$Journey Method$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$See also "Method of Loci".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='J' AND position=2;
UPDATE wiki_terms SET head_en=$wcbf$Karnaukh Notation$wcbf$, head_zh=$wcbf$卡脑壳记号$wcbf$, body_en=$wcbf$One SQ1 notation by Daniel Karnaukh.It is based on standard Square-1 notation, with three major changes:
Parentheses and commas are omitted;
Slashes are replaced with spaces;
Letters are assigned to common pairs of moves.$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='K' AND position=0;
UPDATE wiki_terms SET head_en=$wcbf$Keyhole Cross$wcbf$, head_zh=$wcbf$钥匙孔十字$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='K' AND position=1;
UPDATE wiki_terms SET head_en=$wcbf$Keyhole F2L$wcbf$, head_zh=$wcbf$钥匙孔F2L$wcbf$, body_en=$wcbf$A F2L technique$wcbf$, body_zh=$wcbf$一种F2L技术$wcbf$ WHERE source='seed' AND letter='K' AND position=2;
UPDATE wiki_terms SET head_en=$wcbf$Key Sticker$wcbf$, head_zh=$wcbf$关键格$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='K' AND position=3;
UPDATE wiki_terms SET head_en=$wcbf$Kilominx$wcbf$, head_zh=$wcbf$二阶五魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='K' AND position=4;
UPDATE wiki_terms SET head_en=$wcbf$King of All-Rounder$wcbf$, head_zh=$wcbf$全能王$wcbf$, body_en=$wcbf$Stanley Chapel ($wcbf$, body_zh=$wcbf$全项目都有单次和平均 (平均不算多盲) 中地区平均SoR最靠前的选手, 即所有项目平均地区排名总和最小. 这种定义下, 一个地区的全能王仅能有一人 (挺符合"王"的称号), 不是终身制的, SoR可能会被刷掉.
国家全能王
中国: 欧阳韵奇
洲际全能王
亚洲: 黄佳铨 (马来西亚)
大洋洲: Tom Nelson (新西兰)
欧洲: Daniel Wallin (瑞典)
北美洲: Stanley Chapel (美国)
南美洲: 无
非洲: 无
世界全能王
美国)$wcbf$ WHERE source='seed' AND letter='K' AND position=5;
UPDATE wiki_terms SET head_en=$wcbf$King of Grand Slam$wcbf$, head_zh=$wcbf$大满贯王$wcbf$, body_en=$wcbf$People who have most Grand Slams
Feliks Zemdegs$wcbf$, body_zh=$wcbf$拥有最多大满贯的选手$wcbf$ WHERE source='seed' AND letter='K' AND position=6;
UPDATE wiki_terms SET head_en=$wcbf$KK (Kaleta-Kłosko)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$A skewb advanced method$wcbf$, body_zh=$wcbf$斜转的一种高级玩法$wcbf$ WHERE source='seed' AND letter='K' AND position=7;
UPDATE wiki_terms SET head_en=$wcbf$L (Left)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$A face move$wcbf$, body_zh=$wcbf$一种面转动$wcbf$ WHERE source='seed' AND letter='L' AND position=0;
UPDATE wiki_terms SET head_en=$wcbf$L2L (Last Two Layer)$wcbf$, head_zh=$wcbf$末两层$wcbf$, body_en=$wcbf$Skewb advanced algs$wcbf$, body_zh=$wcbf$斜转高级公式$wcbf$ WHERE source='seed' AND letter='L' AND position=1;
UPDATE wiki_terms SET head_en=$wcbf$L5EF (Last Five Edge First)$wcbf$, head_zh=$wcbf$后五棱先$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='L' AND position=2;
UPDATE wiki_terms SET head_en=$wcbf$L10P (Last 10 Pieces)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$CMLL+LSE$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='L' AND position=3;
UPDATE wiki_terms SET head_en=$wcbf$Latch Cube$wcbf$, head_zh=$wcbf$插销魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='L' AND position=4;
UPDATE wiki_terms SET head_en=$wcbf$Layer$wcbf$, head_zh=$wcbf$层$wcbf$, body_en=$wcbf$All pieces which make up one rotational side.$wcbf$, body_zh=$wcbf$某个旋转面上所有的块的集合.$wcbf$ WHERE source='seed' AND letter='L' AND position=5;
UPDATE wiki_terms SET head_en=$wcbf$LBL (Layer By Layer)$wcbf$, head_zh=$wcbf$层先法$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='L' AND position=6;
UPDATE wiki_terms SET head_en=$wcbf$LEG$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$EG1 case where bar is on DL$wcbf$, body_zh=$wcbf$棒在DL的EG1情况$wcbf$ WHERE source='seed' AND letter='L' AND position=7;
UPDATE wiki_terms SET head_en=$wcbf$Letter$wcbf$, head_zh=$wcbf$字母, 编码$wcbf$, body_en=$wcbf$Notation of sticker$wcbf$, body_zh=$wcbf$贴纸的表示$wcbf$ WHERE source='seed' AND letter='L' AND position=8;
UPDATE wiki_terms SET head_en=$wcbf$Letter Pairs$wcbf$, head_zh=$wcbf$字母对$wcbf$, body_en=$wcbf$Any single word/sound/name that has derived from associating 2 letters$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='L' AND position=9;
UPDATE wiki_terms SET head_en=$wcbf$Letter Pair Images$wcbf$, head_zh=$wcbf$字母对图像$wcbf$, body_en=$wcbf$Letter pair images are objects/animals/people/adjectives that can be easily visualised and are created by combining 2 letters. These images can interact with each other and be placed along an imaginary journey/route.$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='L' AND position=10;
UPDATE wiki_terms SET head_en=$wcbf$Lettering Scheme$wcbf$, head_zh=$wcbf$编码方案$wcbf$, body_en=$wcbf$A very popular and efficient technique for attaining letters. An imaginary lettering scheme is placed on the cube, so each sticker/position is assigned its own unique letter. The idea is to memorise the letters of the cycles that would be necessary to solve the cube.$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='L' AND position=11;
UPDATE wiki_terms SET head_en=$wcbf$LH (Left-handed)$wcbf$, head_zh=$wcbf$左单（左手单手）$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='L' AND position=12;
UPDATE wiki_terms SET head_en=$wcbf$Light$wcbf$, head_zh=$wcbf$灯$wcbf$, body_en=$wcbf$line except the middle dot$wcbf$, body_zh=$wcbf$除去中间点的线$wcbf$ WHERE source='seed' AND letter='L' AND position=13;
UPDATE wiki_terms SET head_en=$wcbf$Line$wcbf$, head_zh=$wcbf$线$wcbf$, body_en=$wcbf$3 connected stickers$wcbf$, body_zh=$wcbf$3连格$wcbf$ WHERE source='seed' AND letter='L' AND position=14;
UPDATE wiki_terms SET head_en=$wcbf$Linear Solve$wcbf$, head_zh=$wcbf$线性还原, 无退回还原$wcbf$, body_en=$wcbf$No NISS solve$wcbf$, body_zh=$wcbf$无NISS还原, 即在正打乱或逆打乱下没有NISS的还原$wcbf$ WHERE source='seed' AND letter='L' AND position=15;
UPDATE wiki_terms SET head_en=$wcbf$LL (Last Layer)$wcbf$, head_zh=$wcbf$顶层$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='L' AND position=16;
UPDATE wiki_terms SET head_en=$wcbf$LLEF (Last Layer Edge First)$wcbf$, head_zh=$wcbf$顶层棱先$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='L' AND position=17;
UPDATE wiki_terms SET head_en=$wcbf$LL Skip OP$wcbf$, head_zh=$wcbf$连跳$wcbf$, body_en=$wcbf$OLL skip + PLL skip = 1/15552$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='L' AND position=18;
UPDATE wiki_terms SET head_en=$wcbf$LnC (Last n Centers)$wcbf$, head_zh=$wcbf$后n中心$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='L' AND position=19;
UPDATE wiki_terms SET head_en=$wcbf$LnE (Last n Edges)$wcbf$, head_zh=$wcbf$后n棱$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='L' AND position=20;
UPDATE wiki_terms SET head_en=$wcbf$Locked Clip$wcbf$, head_zh=$wcbf$卡扣拼接$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='L' AND position=21;
UPDATE wiki_terms SET head_en=$wcbf$Loci$wcbf$, head_zh=$wcbf$地点$wcbf$, body_en=$wcbf$Multiple locations$wcbf$, body_zh=$wcbf$多个地点$wcbf$ WHERE source='seed' AND letter='L' AND position=22;
UPDATE wiki_terms SET head_en=$wcbf$Lockup$wcbf$, head_zh=$wcbf$卡住$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='L' AND position=23;
UPDATE wiki_terms SET head_en=$wcbf$Locus$wcbf$, head_zh=$wcbf$地点$wcbf$, body_en=$wcbf$Single location$wcbf$, body_zh=$wcbf$单个地点$wcbf$ WHERE source='seed' AND letter='L' AND position=24;
UPDATE wiki_terms SET head_en=$wcbf$Lookahead$wcbf$, head_zh=$wcbf$预判$wcbf$, body_en=$wcbf$Planning future stages while executing moves to solve the pieces of the current stage$wcbf$, body_zh=$wcbf$执行当前步骤时预测未来魔方状态$wcbf$ WHERE source='seed' AND letter='L' AND position=25;
UPDATE wiki_terms SET head_en=$wcbf$LP (Last Pair)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$See also "LS".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='L' AND position=26;
UPDATE wiki_terms SET head_en=$wcbf$LS (Last Slot)$wcbf$, head_zh=$wcbf$末槽$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='L' AND position=27;
UPDATE wiki_terms SET head_en=$wcbf$LSE (Last Six Edge) [92160]$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$A step in advanced Roux method$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='L' AND position=28;
UPDATE wiki_terms SET head_en=$wcbf$LSLL (Last Slot and Last Layer)$wcbf$, head_zh=$wcbf$末槽顶层 [583284]$wcbf$, body_en=$wcbf$LS + LL
288*7776/4+(3916+3888)*3 = 583284$wcbf$, body_zh=$wcbf$不考虑AUF
考虑AUF$wcbf$ WHERE source='seed' AND letter='L' AND position=29;
UPDATE wiki_terms SET head_en=$wcbf$Lubricant (Lube)$wcbf$, head_zh=$wcbf$润滑油$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='L' AND position=30;
UPDATE wiki_terms SET head_en=$wcbf$Lubrication$wcbf$, head_zh=$wcbf$润滑$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='L' AND position=31;
UPDATE wiki_terms SET head_en=$wcbf$Lucky Case$wcbf$, head_zh=$wcbf$好情况$wcbf$, body_en=$wcbf$Case that has easy step to execute during solving$wcbf$, body_zh=$wcbf$还原的情况中有容易执行的步骤$wcbf$ WHERE source='seed' AND letter='L' AND position=32;
UPDATE wiki_terms SET head_en=$wcbf$M (Middle)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$A slice move$wcbf$, body_zh=$wcbf$一种中层转动$wcbf$ WHERE source='seed' AND letter='M' AND position=0;
UPDATE wiki_terms SET head_en=$wcbf$M (Magnet)$wcbf$, head_zh=$wcbf$磁力版$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=1;
UPDATE wiki_terms SET head_en=$wcbf$Make$wcbf$, head_zh=$wcbf$完成, 制造$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=2;
UPDATE wiki_terms SET head_en=$wcbf$Magic$wcbf$, head_zh=$wcbf$八板$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=3;
UPDATE wiki_terms SET head_en=$wcbf$Magnetic Capsule$wcbf$, head_zh=$wcbf$磁力舱$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=4;
UPDATE wiki_terms SET head_en=$wcbf$Maple Leaf Skewb$wcbf$, head_zh=$wcbf$枫叶斜转$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=5;
UPDATE wiki_terms SET head_en=$wcbf$Master Kilominx$wcbf$, head_zh=$wcbf$四阶五魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=6;
UPDATE wiki_terms SET head_en=$wcbf$Master Magic$wcbf$, head_zh=$wcbf$十二板$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=7;
UPDATE wiki_terms SET head_en=$wcbf$Match$wcbf$, head_zh=$wcbf$匹配$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=8;
UPDATE wiki_terms SET head_en=$wcbf$Main$wcbf$, head_zh=$wcbf$主力, 首选$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=9;
UPDATE wiki_terms SET head_en=$wcbf$Mastermorphix$wcbf$, head_zh=$wcbf$魔粽 / 粽子魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=10;
UPDATE wiki_terms SET head_en=$wcbf$Master Pyraminx$wcbf$, head_zh=$wcbf$四阶金字塔$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=11;
UPDATE wiki_terms SET head_en=$wcbf$MBLD (Multi-BLD)$wcbf$, head_zh=$wcbf$多盲$wcbf$, body_en=$wcbf$One of WCA events  WCA$wcbf$, body_zh=$wcbf$项目之一$wcbf$ WHERE source='seed' AND letter='M' AND position=12;
UPDATE wiki_terms SET head_en=$wcbf$MBLD Old Style$wcbf$, head_zh=$wcbf$旧多盲$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=13;
UPDATE wiki_terms SET head_en=$wcbf$Mean (μ )$wcbf$, head_zh=$wcbf$平均$wcbf$, body_en=$wcbf$See "Mox".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=14;
UPDATE wiki_terms SET head_en=$wcbf$Megaminx$wcbf$, head_zh=$wcbf$五魔$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=15;
UPDATE wiki_terms SET head_en=$wcbf$Megamorphix$wcbf$, head_zh=$wcbf$四阶魔粽$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=16;
UPDATE wiki_terms SET head_en=$wcbf$Mehta$wcbf$, head_zh=$wcbf$梅塔法$wcbf$, body_en=$wcbf$Mehta$wcbf$, body_zh=$wcbf$是一个极具潜力的三阶魔方全新还原方法，由印度人Yash Mehta在2020年8月发明。该方法的一个分支Mehta-TDR被全世界最强的方法中立者Tao Yu所主力。$wcbf$ WHERE source='seed' AND letter='M' AND position=17;
UPDATE wiki_terms SET head_en=$wcbf$Method$wcbf$, head_zh=$wcbf$方法$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=18;
UPDATE wiki_terms SET head_en=$wcbf$Metric$wcbf$, head_zh=$wcbf$度量制$wcbf$, body_en=$wcbf$move count metric
https://speedsolving.com/wiki/index.php/Metric$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=19;
UPDATE wiki_terms SET head_en=$wcbf$Memo (Memorization)$wcbf$, head_zh=$wcbf$记忆$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=20;
UPDATE wiki_terms SET head_en=$wcbf$Memory Palaces$wcbf$, head_zh=$wcbf$记忆宫殿$wcbf$, body_en=$wcbf$See also "Method of loci".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=21;
UPDATE wiki_terms SET head_en=$wcbf$Method Neutral$wcbf$, head_zh=$wcbf$方法中立$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=22;
UPDATE wiki_terms SET head_en=$wcbf$Method of loci$wcbf$, head_zh=$wcbf$定桩记忆法$wcbf$, body_en=$wcbf$A method of memory enhancement which uses visualizations with the use of spatial memory, familiar information about one's environment, to quickly and efficiently recall information$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=23;
UPDATE wiki_terms SET head_en=$wcbf$Meyer$wcbf$, head_zh=$wcbf$迈耶法$wcbf$, body_en=$wcbf$4x4 method.$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=24;
UPDATE wiki_terms SET head_en=$wcbf$MF2L (Multi-Angle F2L)$wcbf$, head_zh=$wcbf$多向F2L$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=25;
UPDATE wiki_terms SET head_en=$wcbf$MGLS (Makisumi-Garron Last Slot)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$ELS then CLS$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=26;
UPDATE wiki_terms SET head_en=$wcbf$Middle Layer$wcbf$, head_zh=$wcbf$中间层$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=27;
UPDATE wiki_terms SET head_en=$wcbf$Midge$wcbf$, head_zh=$wcbf$中棱$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=28;
UPDATE wiki_terms SET head_en=$wcbf$Mini Guildford Challenge$wcbf$, head_zh=$wcbf$迷你吉尔福德挑战$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$所有有WCA五次平均的项目的连拧$wcbf$ WHERE source='seed' AND letter='M' AND position=29;
UPDATE wiki_terms SET head_en=$wcbf$Minx (Megaminx)$wcbf$, head_zh=$wcbf$五魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=30;
UPDATE wiki_terms SET head_en=$wcbf$Mirror$wcbf$, head_zh=$wcbf$镜像$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=31;
UPDATE wiki_terms SET head_en=$wcbf$Misalign$wcbf$, head_zh=$wcbf$错层, 错开$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=32;
UPDATE wiki_terms SET head_en=$wcbf$Misoriented$wcbf$, head_zh=$wcbf$错向的 (色向错误的)$wcbf$, body_en=$wcbf$Not oriented$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=33;
UPDATE wiki_terms SET head_en=$wcbf$Misscramble$wcbf$, head_zh=$wcbf$错误打乱$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=34;
UPDATE wiki_terms SET head_en=$wcbf$Misslot$wcbf$, head_zh=$wcbf$错槽$wcbf$, body_en=$wcbf$Different slot$wcbf$, body_zh=$wcbf$不同的槽$wcbf$ WHERE source='seed' AND letter='M' AND position=35;
UPDATE wiki_terms SET head_en=$wcbf$Mixup Cube$wcbf$, head_zh=$wcbf$混元魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=36;
UPDATE wiki_terms SET head_en=$wcbf$Mod (Modification)$wcbf$, head_zh=$wcbf$改装$wcbf$, body_en=$wcbf$Any change to the puzzle (except turning) such as making a new cube with an existing mechanism.$wcbf$, body_zh=$wcbf$除了拧之外的对魔方的任何改动，例如在原有机制的基础上造了一个新的魔方$wcbf$ WHERE source='seed' AND letter='M' AND position=37;
UPDATE wiki_terms SET head_en=$wcbf$Mollerz Memberships$wcbf$, head_zh=$wcbf$莫勒兹会员制$wcbf$, body_en=$wcbf$http://stats.spendla.uk/mollerzmembership/table.html#mollerz-wca-memberships
5 indexes:
Averages in all sighted speedsolve events (Not BLD/FMC)
Means in FMC/BLD
WC Podium
WR
Win all events$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=38;
UPDATE wiki_terms SET head_en=$wcbf$One-Event-Missing Member: People who achieved all events except$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$Bronze Member: all-rounder, i.e., a single in every event
Silver Member: all-rounder + 1 index
Gold Member: all-rounder + 2 indexes
Platinum Member: all-rounder + 3 indexes
Opal Member: all-rounder + 4 indexes
Diamond Member: all-rounder + 5 indexes$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=39;
UPDATE wiki_terms SET head_en=$wcbf$This reduces region bias with CR/NR and also makes Gold obtainable only on personal talent. Gold is considered the pinnacle of a lot of things (Olympics, World Championships at sports, etc.) but getting past this point requires that bit extra to be on the next level.$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=40;
UPDATE wiki_terms SET head_en=$wcbf$$wcbf$, head_zh=$wcbf$五个指标$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$所有睁眼速拧项目有平均
最少步和所有盲拧项目有平均
登上世锦赛领奖台
打破世界纪录
赢得所有项目$wcbf$ WHERE source='seed' AND letter='M' AND position=41;
UPDATE wiki_terms SET head_en=$wcbf$$wcbf$, head_zh=$wcbf$七个会员$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$缺单项会员: 除一项目外所有项目有单次
青铜会员: 全能选手, 即所有项目有单次
白银会员: 全能选手且完成1个指标
黄金会员: 全能选手且完成2个指标
铂金会员: 全能选手且完成3个指标
欧泊会员: 全能选手且完成4个指标
钻石会员: 全能选手且完成5个指标$wcbf$ WHERE source='seed' AND letter='M' AND position=42;
UPDATE wiki_terms SET head_en=$wcbf$$wcbf$, head_zh=$wcbf$优势: 在CR/NR上减小地区偏见, 等级多样化, 达到的途径很多, 更容易.$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=43;
UPDATE wiki_terms SET head_en=$wcbf$Move$wcbf$, head_zh=$wcbf$转动$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=44;
UPDATE wiki_terms SET head_en=$wcbf$Move Count$wcbf$, head_zh=$wcbf$步数$wcbf$, body_en=$wcbf$The number of moves$wcbf$, body_zh=$wcbf$操作的长度$wcbf$ WHERE source='seed' AND letter='M' AND position=45;
UPDATE wiki_terms SET head_en=$wcbf$Move Sequence$wcbf$, head_zh=$wcbf$转动序列$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=46;
UPDATE wiki_terms SET head_en=$wcbf$Mox (Mean of x)$wcbf$, head_zh=$wcbf$x次平均$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=47;
UPDATE wiki_terms SET head_en=$wcbf$Multislotting$wcbf$, head_zh=$wcbf$多组入槽$wcbf$, body_en=$wcbf$Intentionally inserting F2L in a manner which leads next F2L to good case$wcbf$, body_zh=$wcbf$有意地以某种方式插入一组F2L，让下一组F2L变成简单的情况$wcbf$ WHERE source='seed' AND letter='M' AND position=48;
UPDATE wiki_terms SET head_en=$wcbf$Muscle Memory$wcbf$, head_zh=$wcbf$肌肉记忆$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='M' AND position=49;
UPDATE wiki_terms SET head_en=$wcbf$NAR (North American Record/Rank)$wcbf$, head_zh=$wcbf$北美洲纪录/排名$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='N' AND position=0;
UPDATE wiki_terms SET head_en=$wcbf$Negative (-)$wcbf$, head_zh=$wcbf$负$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='N' AND position=1;
UPDATE wiki_terms SET head_en=$wcbf$NF2L (Non-Standard F2L) [126]$wcbf$, head_zh=$wcbf$非标F2L (非标准F2L)$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$有棱或角块处于非目标槽的F2L$wcbf$ WHERE source='seed' AND letter='N' AND position=2;
UPDATE wiki_terms SET head_en=$wcbf$Nod Don$wcbf$, head_zh=$wcbf$点戴（点头式戴眼罩）$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='N' AND position=3;
UPDATE wiki_terms SET head_en=$wcbf$Non NxN Cube$wcbf$, head_zh=$wcbf$异形魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='N' AND position=4;
UPDATE wiki_terms SET head_en=$wcbf$Normal$wcbf$, head_zh=$wcbf$正序$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='N' AND position=5;
UPDATE wiki_terms SET head_en=$wcbf$Notation$wcbf$, head_zh=$wcbf$记号$wcbf$, body_en=$wcbf$Notation on Cube moves$wcbf$, body_zh=$wcbf$魔方标记体系$wcbf$ WHERE source='seed' AND letter='N' AND position=6;
UPDATE wiki_terms SET head_en=$wcbf$Niklas$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$The commutator R U' L' U R' U' L (U), which re-orients 3 corners clockwise.$wcbf$, body_zh=$wcbf$交换子R U' L' U R' U' L (U).$wcbf$ WHERE source='seed' AND letter='N' AND position=7;
UPDATE wiki_terms SET head_en=$wcbf$NISS (Normal-Inverse-Scramble-Switch)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$One of FMC techniques$wcbf$, body_zh=$wcbf$最少步常用技巧$wcbf$ WHERE source='seed' AND letter='N' AND position=8;
UPDATE wiki_terms SET head_en=$wcbf$NR (National Record/Rank)$wcbf$, head_zh=$wcbf$国家纪录/排名$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='N' AND position=9;
UPDATE wiki_terms SET head_en=$wcbf$Nutella$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$A Pyraminx advanced method$wcbf$, body_zh=$wcbf$金字塔高级玩法$wcbf$ WHERE source='seed' AND letter='N' AND position=10;
UPDATE wiki_terms SET head_en=$wcbf$NWR (Newcomer World Record)$wcbf$, head_zh=$wcbf$新人世界纪录$wcbf$, body_en=$wcbf$Newcomer Result: The best result achieved by a competitor in an event during their first competition for the event. NWR: World Record for Newcomer Result.$wcbf$, body_zh=$wcbf$新人成绩: 选手第一次参加某项目的比赛的该项目最好成绩. 这里的首次定义为首场比赛, 而不仅仅是首轮或首把还原. NWR: 新人成绩的世界纪录.$wcbf$ WHERE source='seed' AND letter='N' AND position=11;
UPDATE wiki_terms SET head_en=$wcbf$OBL (Orientation of Both Layer)$wcbf$, head_zh=$wcbf$双层色向$wcbf$, body_en=$wcbf$Used in SQ1$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='O' AND position=0;
UPDATE wiki_terms SET head_en=$wcbf$Oblique$wcbf$, head_zh=$wcbf$斜心$wcbf$, body_en=$wcbf$Center in 6x6 or higher which is not belong to fixed center, X-center and +-center$wcbf$, body_zh=$wcbf$六阶以上的非正中心, 角心, 边心的中心$wcbf$ WHERE source='seed' AND letter='O' AND position=1;
UPDATE wiki_terms SET head_en=$wcbf$OBM (Outer Block Moves)$wcbf$, head_zh=$wcbf$外砖转动$wcbf$, body_en=$wcbf$Outer slice with adjacent inner slices$wcbf$, body_zh=$wcbf$外层和及与外层相邻的若干内层$wcbf$ WHERE source='seed' AND letter='O' AND position=2;
UPDATE wiki_terms SET head_en=$wcbf$OBTM (Outer Block Turn Metric)$wcbf$, head_zh=$wcbf$外砖转动度量制$wcbf$, body_en=$wcbf$One official turn metric:
Each move of the categories Face Moves and Outer Block Moves is counted as 1 move.
Each move of the Rotations category is counted as 0 moves.$wcbf$, body_zh=$wcbf$官方度量制:
每个面转动或外部转动计1步. 每个整体转动计0步.$wcbf$ WHERE source='seed' AND letter='O' AND position=3;
UPDATE wiki_terms SET head_en=$wcbf$OcR (Oceanic Record/Rank)$wcbf$, head_zh=$wcbf$大洋洲纪录/排名$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='O' AND position=4;
UPDATE wiki_terms SET head_en=$wcbf$Octahedron$wcbf$, head_zh=$wcbf$八面体$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='O' AND position=5;
UPDATE wiki_terms SET head_en=$wcbf$OCLL (Orient Corners of Last Layer)$wcbf$, head_zh=$wcbf$还原顶层角块色向$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='O' AND position=6;
UPDATE wiki_terms SET head_en=$wcbf$Odd Piece$wcbf$, head_zh=$wcbf$奇块$wcbf$, body_en=$wcbf$See Comm page.$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='O' AND position=7;
UPDATE wiki_terms SET head_en=$wcbf$OELL (Orientation of Edges of Last Layer)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='O' AND position=8;
UPDATE wiki_terms SET head_en=$wcbf$Official$wcbf$, head_zh=$wcbf$官方$wcbf$, body_en=$wcbf$See also "WCA".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='O' AND position=9;
UPDATE wiki_terms SET head_en=$wcbf$OH (One-Handed)$wcbf$, head_zh=$wcbf$单手$wcbf$, body_en=$wcbf$One-handed speedcubing$wcbf$, body_zh=$wcbf$单手速拧$wcbf$ WHERE source='seed' AND letter='O' AND position=10;
UPDATE wiki_terms SET head_en=$wcbf$Oka (Yohei Oka)$wcbf$, head_zh=$wcbf$奥卡法$wcbf$, body_en=$wcbf$Pyraminx intermediate method$wcbf$, body_zh=$wcbf$金字塔进阶玩法$wcbf$ WHERE source='seed' AND letter='O' AND position=11;
UPDATE wiki_terms SET head_en=$wcbf$OLL (Orientation of LL)$wcbf$, head_zh=$wcbf$还原顶层色向$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='O' AND position=12;
UPDATE wiki_terms SET head_en=$wcbf$OLLCP (OLL + CP)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='O' AND position=13;
UPDATE wiki_terms SET head_en=$wcbf$OLL Skip$wcbf$, head_zh=$wcbf$跳O$wcbf$, body_en=$wcbf$Probability=1/216$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='O' AND position=14;
UPDATE wiki_terms SET head_en=$wcbf$OLS (OLL+LS) [8111+1]$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='O' AND position=15;
UPDATE wiki_terms SET head_en=$wcbf$One-Event-Missing Member$wcbf$, head_zh=$wcbf$缺单项会员$wcbf$, body_en=$wcbf$See also "Mollerz Memberships".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='O' AND position=16;
UPDATE wiki_terms SET head_en=$wcbf$OO (Objectively Optimal)$wcbf$, head_zh=$wcbf$客观最优的$wcbf$, body_en=$wcbf$= speedsolving optimal$wcbf$, body_zh=$wcbf$可理解为速拧最优的$wcbf$ WHERE source='seed' AND letter='O' AND position=17;
UPDATE wiki_terms SET head_en=$wcbf$OOPP (CO-EO-CP-EP)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='O' AND position=18;
UPDATE wiki_terms SET head_en=$wcbf$OOPS$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$OLL + OLL + PLL Skip = OLL-combo 1LLL$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='O' AND position=19;
UPDATE wiki_terms SET head_en=$wcbf$OP (Old Pochmann, Classic Pochmann)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$2-cycle blindfold method invented by Stefan Pochmann in 2004$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='O' AND position=20;
UPDATE wiki_terms SET head_en=$wcbf$OPA (OLL Parity Avoidance)$wcbf$, head_zh=$wcbf$O特避免$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='O' AND position=21;
UPDATE wiki_terms SET head_en=$wcbf$Opal Member$wcbf$, head_zh=$wcbf$欧泊会员$wcbf$, body_en=$wcbf$See also "Mollerz Memberships".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='O' AND position=22;
UPDATE wiki_terms SET head_en=$wcbf$Oparity (OLL Parity)$wcbf$, head_zh=$wcbf$O特$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='O' AND position=23;
UPDATE wiki_terms SET head_en=$wcbf$Open$wcbf$, head_zh=$wcbf$开的$wcbf$, body_en=$wcbf$See also "Free".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='O' AND position=24;
UPDATE wiki_terms SET head_en=$wcbf$Opp (Opposite)$wcbf$, head_zh=$wcbf$对，反（相对的，相反的）$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='O' AND position=25;
UPDATE wiki_terms SET head_en=$wcbf$Opp Light$wcbf$, head_zh=$wcbf$对头灯$wcbf$, body_en=$wcbf$Light and the middle dot with opposite color$wcbf$, body_zh=$wcbf$灯和灯中间的反色点$wcbf$ WHERE source='seed' AND letter='O' AND position=26;
UPDATE wiki_terms SET head_en=$wcbf$Optimal$wcbf$, head_zh=$wcbf$最优的$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='O' AND position=27;
UPDATE wiki_terms SET head_en=$wcbf$Optimal Solution$wcbf$, head_zh=$wcbf$最优解$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='O' AND position=28;
UPDATE wiki_terms SET head_en=$wcbf$Orbit$wcbf$, head_zh=$wcbf$轨道$wcbf$, body_en=$wcbf$The set of all positions where it can be sent to by normal turns of the puzzle (not allowing cube rotations). This is distinct from the set of positions with similar-looking pieces - in some puzzles, it is not immediately obvious where a piece can be moved to.$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='O' AND position=29;
UPDATE wiki_terms SET head_en=$wcbf$Order$wcbf$, head_zh=$wcbf$阶$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='O' AND position=30;
UPDATE wiki_terms SET head_en=$wcbf$Oriented$wcbf$, head_zh=$wcbf$正向的 (色向正确的)$wcbf$, body_en=$wcbf$Property of pieces generated by {U, D, L, R, F2, B2}$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='O' AND position=31;
UPDATE wiki_terms SET head_en=$wcbf$Orientation$wcbf$, head_zh=$wcbf$色向，色向; (打乱, 还原) 坐标$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='O' AND position=32;
UPDATE wiki_terms SET head_en=$wcbf$Orozco$wcbf$, head_zh=$wcbf$奥罗斯科法$wcbf$, body_en=$wcbf$A step up from the OP Method  OP$wcbf$, body_zh=$wcbf$法的进阶方法$wcbf$ WHERE source='seed' AND letter='O' AND position=33;
UPDATE wiki_terms SET head_en=$wcbf$Ortega (Victor Ortega)$wcbf$, head_zh=$wcbf$面先法（奥尔特加法）$wcbf$, body_en=$wcbf$See also "FBF".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='O' AND position=34;
UPDATE wiki_terms SET head_en=$wcbf$Overshoot$wcbf$, head_zh=$wcbf$转动过度$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$在三阶上，指多做了90°及以上，例如M'做成了M2'.$wcbf$ WHERE source='seed' AND letter='O' AND position=35;
UPDATE wiki_terms SET head_en=$wcbf$Overwork$wcbf$, head_zh=$wcbf$复用$wcbf$, body_en=$wcbf$Using the same finger twice, where cuber needs to reset it during ≤1 quarter turn. Examples: U' R' U'; M2' U M'; U U.$wcbf$, body_zh=$wcbf$在做完≤1半圈转动后需要重置手指的位置, 这时使用了同一个手指转动两次. 例如: U' R' U'; M2' U M'; U U.$wcbf$ WHERE source='seed' AND letter='O' AND position=36;
UPDATE wiki_terms SET head_en=$wcbf$Outer Shell$wcbf$, head_zh=$wcbf$外壳$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='O' AND position=37;
UPDATE wiki_terms SET head_en=$wcbf$Over Inspection$wcbf$, head_zh=$wcbf$长观察$wcbf$, body_en=$wcbf$Inspection time over 15s$wcbf$, body_zh=$wcbf$超过15秒的观察时间$wcbf$ WHERE source='seed' AND letter='O' AND position=38;
UPDATE wiki_terms SET head_en=$wcbf$Pair$wcbf$, head_zh=$wcbf$对, 合并$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=0;
UPDATE wiki_terms SET head_en=$wcbf$Parity$wcbf$, head_zh=$wcbf$特（奇偶）$wcbf$, body_en=$wcbf$Parity in a speedsolving context generally refers to additional steps required to solve a puzzle in cases where there are (or appear to be) an odd number of piece swaps on a cube.$wcbf$, body_zh=$wcbf$在速拧背景下指还原某些魔方可能会出现的特殊情况（块的奇数次交换）.$wcbf$ WHERE source='seed' AND letter='P' AND position=1;
UPDATE wiki_terms SET head_en=$wcbf$Parity + Twist$wcbf$, head_zh=$wcbf$奇偶带翻色$wcbf$, body_en=$wcbf$Used in BLD$wcbf$, body_zh=$wcbf$用于盲拧$wcbf$ WHERE source='seed' AND letter='P' AND position=2;
UPDATE wiki_terms SET head_en=$wcbf$Pattern$wcbf$, head_zh=$wcbf$图案$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=3;
UPDATE wiki_terms SET head_en=$wcbf$Pause$wcbf$, head_zh=$wcbf$停顿$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=4;
UPDATE wiki_terms SET head_en=$wcbf$PB (Personal Best)$wcbf$, head_zh=$wcbf$个人最好成绩$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=5;
UPDATE wiki_terms SET head_en=$wcbf$PBL (Permutation of Both Layers)$wcbf$, head_zh=$wcbf$双层排列$wcbf$, body_en=$wcbf$A step used in some common 2x2 methods$wcbf$, body_zh=$wcbf$二阶中一些常见方法的一个步骤$wcbf$ WHERE source='seed' AND letter='P' AND position=6;
UPDATE wiki_terms SET head_en=$wcbf$Petaminx$wcbf$, head_zh=$wcbf$九阶五魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=7;
UPDATE wiki_terms SET head_en=$wcbf$Picture Cube$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$See also "Supercube".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=8;
UPDATE wiki_terms SET head_en=$wcbf$Platinum Member$wcbf$, head_zh=$wcbf$铂金会员$wcbf$, body_en=$wcbf$See also "Mollerz Memberships".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=9;
UPDATE wiki_terms SET head_en=$wcbf$PDR (Partial Domino Reduction)$wcbf$, head_zh=$wcbf$部分多米诺降群$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=10;
UPDATE wiki_terms SET head_en=$wcbf$Pentultimate$wcbf$, head_zh=$wcbf$斜转五魔$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=11;
UPDATE wiki_terms SET head_en=$wcbf$Petrus Method (Lars Petrus)$wcbf$, head_zh=$wcbf$彼得鲁斯法$wcbf$, body_en=$wcbf$A 3x3 speedsolving method which has a strong emphasis on blockbuilding$wcbf$, body_zh=$wcbf$三阶的一种强调块构造速拧玩法$wcbf$ WHERE source='seed' AND letter='P' AND position=12;
UPDATE wiki_terms SET head_en=$wcbf$Perm (Permutation)$wcbf$, head_zh=$wcbf$排列$wcbf$, body_en=$wcbf$XX perm = PLL-XX$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=13;
UPDATE wiki_terms SET head_en=$wcbf$Pillowed Puzzle$wcbf$, head_zh=$wcbf$面包魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=14;
UPDATE wiki_terms SET head_en=$wcbf$Pinch$wcbf$, head_zh=$wcbf$捏住, 勾$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=15;
UPDATE wiki_terms SET head_en=$wcbf$PLL (Permutation of LL)$wcbf$, head_zh=$wcbf$还原顶层排列$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=16;
UPDATE wiki_terms SET head_en=$wcbf$PLL Skip$wcbf$, head_zh=$wcbf$跳P$wcbf$, body_en=$wcbf$Probability=1/72$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=17;
UPDATE wiki_terms SET head_en=$wcbf$Podium$wcbf$, head_zh=$wcbf$领奖台$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=18;
UPDATE wiki_terms SET head_en=$wcbf$Polaris Cube$wcbf$, head_zh=$wcbf$北极星魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=19;
UPDATE wiki_terms SET head_en=$wcbf$POLL (Oparity OLL)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$One algorithm to solve Oparity and OLL$wcbf$, body_zh=$wcbf$用一个公式还原O特和OLL$wcbf$ WHERE source='seed' AND letter='P' AND position=20;
UPDATE wiki_terms SET head_en=$wcbf$Polyhedron$wcbf$, head_zh=$wcbf$多面体$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=21;
UPDATE wiki_terms SET head_en=$wcbf$POP$wcbf$, head_zh=$wcbf$飞棱$wcbf$, body_en=$wcbf$When pieces 'pop' or fall out of a cube during turning$wcbf$, body_zh=$wcbf$在转魔方时魔方发生散架（掉块）$wcbf$ WHERE source='seed' AND letter='P' AND position=22;
UPDATE wiki_terms SET head_en=$wcbf$Position$wcbf$, head_zh=$wcbf$状态$wcbf$, body_en=$wcbf$See also "Pattern".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=23;
UPDATE wiki_terms SET head_en=$wcbf$Pparity (PLL Parity)$wcbf$, head_zh=$wcbf$P特$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=24;
UPDATE wiki_terms SET head_en=$wcbf$PPLL (Pparity PLL)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$One algorithm to solve Pparity and PLL$wcbf$, body_zh=$wcbf$用一个公式还原P特和PLL$wcbf$ WHERE source='seed' AND letter='P' AND position=25;
UPDATE wiki_terms SET head_en=$wcbf$PR (Personal Record)$wcbf$, head_zh=$wcbf$个人纪录$wcbf$, body_en=$wcbf$Official personal best$wcbf$, body_zh=$wcbf$官方个人最好成绩$wcbf$ WHERE source='seed' AND letter='P' AND position=26;
UPDATE wiki_terms SET head_en=$wcbf$PR Streak$wcbf$, head_zh=$wcbf$每场比赛均有PR$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=27;
UPDATE wiki_terms SET head_en=$wcbf$Practice$wcbf$, head_zh=$wcbf$练习$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=28;
UPDATE wiki_terms SET head_en=$wcbf$Predict$wcbf$, head_zh=$wcbf$预判$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=29;
UPDATE wiki_terms SET head_en=$wcbf$Pre-AUF$wcbf$, head_zh=$wcbf$用U预先调整顶层$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=30;
UPDATE wiki_terms SET head_en=$wcbf$Premove$wcbf$, head_zh=$wcbf$预操作$wcbf$, body_en=$wcbf$Used in FMC$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=31;
UPDATE wiki_terms SET head_en=$wcbf$Prerequisite$wcbf$, head_zh=$wcbf$预备，先导$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=32;
UPDATE wiki_terms SET head_en=$wcbf$Preserve$wcbf$, head_zh=$wcbf$保留$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=33;
UPDATE wiki_terms SET head_en=$wcbf$Press$wcbf$, head_zh=$wcbf$按$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=34;
UPDATE wiki_terms SET head_en=$wcbf$Pretty Patterns$wcbf$, head_zh=$wcbf$花式图案$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=35;
UPDATE wiki_terms SET head_en=$wcbf$Prevent Dot (OLL)$wcbf$, head_zh=$wcbf$跳点O$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=36;
UPDATE wiki_terms SET head_en=$wcbf$Prime (')$wcbf$, head_zh=$wcbf$撇号$wcbf$, body_en=$wcbf$See also "Singmaster Notation".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=37;
UPDATE wiki_terms SET head_en=$wcbf$Probability$wcbf$, head_zh=$wcbf$概率$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=38;
UPDATE wiki_terms SET head_en=$wcbf$Professor Pyraminx$wcbf$, head_zh=$wcbf$五阶金字塔$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=39;
UPDATE wiki_terms SET head_en=$wcbf$PSB (Pseudo Block)$wcbf$, head_zh=$wcbf$伪块$wcbf$, body_en=$wcbf$Concept in FMC$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=40;
UPDATE wiki_terms SET head_en=$wcbf$PSC (Prepared Solve Challenge)$wcbf$, head_zh=$wcbf$事先练习过的还原挑战$wcbf$, body_en=$wcbf$Downsolve$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=41;
UPDATE wiki_terms SET head_en=$wcbf$PSCross (Pseudo Cross)$wcbf$, head_zh=$wcbf$伪十字$wcbf$, body_en=$wcbf$Solved cross ignoring ADF$wcbf$, body_zh=$wcbf$不考虑ADF的底十字$wcbf$ WHERE source='seed' AND letter='P' AND position=42;
UPDATE wiki_terms SET head_en=$wcbf$PSF2L (Pseudo F2L)$wcbf$, head_zh=$wcbf$伪F2L$wcbf$, body_en=$wcbf$Double Keyhole. For example, D (U R U' R') D'.$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=43;
UPDATE wiki_terms SET head_en=$wcbf$Pseudo Xcross$wcbf$, head_zh=$wcbf$伪拓展十字$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=44;
UPDATE wiki_terms SET head_en=$wcbf$Pseudoslotting$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$See also "PSF2L"$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=45;
UPDATE wiki_terms SET head_en=$wcbf$Pull$wcbf$, head_zh=$wcbf$反拨$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=46;
UPDATE wiki_terms SET head_en=$wcbf$Push$wcbf$, head_zh=$wcbf$推$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=47;
UPDATE wiki_terms SET head_en=$wcbf$Puzzle$wcbf$, head_zh=$wcbf$魔方$wcbf$, body_en=$wcbf$An object with many pieces which can be manipulated in certain well-defined ways, the goal of which is to bring the pieces into a predefined solved position.$wcbf$, body_zh=$wcbf$对所有魔方和类似项目的统称.$wcbf$ WHERE source='seed' AND letter='P' AND position=48;
UPDATE wiki_terms SET head_en=$wcbf$Py (Pyraminx)$wcbf$, head_zh=$wcbf$金字塔魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=49;
UPDATE wiki_terms SET head_en=$wcbf$Pyramorphix$wcbf$, head_zh=$wcbf$二阶金字塔$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='P' AND position=50;
UPDATE wiki_terms SET head_en=$wcbf$QSTM (Quarter Slice Turn Metric) 1/4$wcbf$, head_zh=$wcbf$中层转动度量制$wcbf$, body_en=$wcbf$A metric for the 3x3x3 in which any clockwise or counterclockwise 90-degree turn of any layer counts as one turn, and rotations do not count as moves.$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='Q' AND position=0;
UPDATE wiki_terms SET head_en=$wcbf$QT 90°$wcbf$, head_zh=$wcbf$转动$wcbf$, body_en=$wcbf$90°$wcbf$, body_zh=$wcbf$转动$wcbf$ WHERE source='seed' AND letter='Q' AND position=1;
UPDATE wiki_terms SET head_en=$wcbf$QTM (Quarter Turn Metric) 90$wcbf$, head_zh=$wcbf$度量制$wcbf$, body_en=$wcbf$A metric where any turn of any face by 90° counts as 1 turn$wcbf$, body_zh=$wcbf$任意面的一次90°转动计数为1的度量制$wcbf$ WHERE source='seed' AND letter='Q' AND position=2;
UPDATE wiki_terms SET head_en=$wcbf$Quarter Turn$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$Any 90 degree turn$wcbf$, body_zh=$wcbf$任意90°转动$wcbf$ WHERE source='seed' AND letter='Q' AND position=3;
UPDATE wiki_terms SET head_en=$wcbf$Qualifying Time$wcbf$, head_zh=$wcbf$资格线$wcbf$, body_en=$wcbf$Competitors have to meet the Qualifying Time of the competition events by 2019-07-10 20:00:00, for example.$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='Q' AND position=4;
UPDATE wiki_terms SET head_en=$wcbf$Queccaminx$wcbf$, head_zh=$wcbf$十九阶五魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='Q' AND position=5;
UPDATE wiki_terms SET head_en=$wcbf$R (Right)$wcbf$, head_zh=$wcbf$右$wcbf$, body_en=$wcbf$A face move$wcbf$, body_zh=$wcbf$一种面转动$wcbf$ WHERE source='seed' AND letter='R' AND position=0;
UPDATE wiki_terms SET head_en=$wcbf$Rayminx$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='R' AND position=1;
UPDATE wiki_terms SET head_en=$wcbf$Read$wcbf$, head_zh=$wcbf$读码$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='R' AND position=2;
UPDATE wiki_terms SET head_en=$wcbf$Real Man$wcbf$, head_zh=$wcbf$真人$wcbf$, body_en=$wcbf$5 scrambles + inspections + solves$wcbf$, body_zh=$wcbf$五把打乱+ 观察 + 还原$wcbf$ WHERE source='seed' AND letter='R' AND position=3;
UPDATE wiki_terms SET head_en=$wcbf$Recognition$wcbf$, head_zh=$wcbf$观察$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='R' AND position=4;
UPDATE wiki_terms SET head_en=$wcbf$Recon (Reconstruction)$wcbf$, head_zh=$wcbf$复盘$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='R' AND position=5;
UPDATE wiki_terms SET head_en=$wcbf$Reduction$wcbf$, head_zh=$wcbf$降阶法$wcbf$, body_en=$wcbf$A common big cube solving method whereby the cuber solves the center pieces into place, followed by pairing up edge pieces to effectively 'reduce' the big cube to a 3x3.$wcbf$, body_zh=$wcbf$高阶魔方常见的一种还原方法，先还原所有的中心块，再将所有棱块组好，此时魔方将等价于三阶魔方.$wcbf$ WHERE source='seed' AND letter='R' AND position=6;
UPDATE wiki_terms SET head_en=$wcbf$Redux$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$See also "Reduction Method".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='R' AND position=7;
UPDATE wiki_terms SET head_en=$wcbf$Reflectively Symmetry$wcbf$, head_zh=$wcbf$镜像对称$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='R' AND position=8;
UPDATE wiki_terms SET head_en=$wcbf$Realman$wcbf$, head_zh=$wcbf$真人$wcbf$, body_en=$wcbf$Solving without inspection first$wcbf$, body_zh=$wcbf$不带观察时间的还原$wcbf$ WHERE source='seed' AND letter='R' AND position=9;
UPDATE wiki_terms SET head_en=$wcbf$Redi Cube$wcbf$, head_zh=$wcbf$热帝魔方$wcbf$, body_en=$wcbf$A three-layered twisty puzzle on which each corner turn moves the three edges around it$wcbf$, body_zh=$wcbf$一种三阶异形魔方, 转1个角会同时影响周围的3个棱$wcbf$ WHERE source='seed' AND letter='R' AND position=10;
UPDATE wiki_terms SET head_en=$wcbf$Regrip$wcbf$, head_zh=$wcbf$换手$wcbf$, body_en=$wcbf$One of the hands leaves the cube before the letter move for the moment$wcbf$, body_zh=$wcbf$一只手在做字母动作前暂时离开魔方$wcbf$ WHERE source='seed' AND letter='R' AND position=11;
UPDATE wiki_terms SET head_en=$wcbf$Regripless$wcbf$, head_zh=$wcbf$无换手的$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='R' AND position=12;
UPDATE wiki_terms SET head_en=$wcbf$Regular Polyhedron$wcbf$, head_zh=$wcbf$正多面体$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='R' AND position=13;
UPDATE wiki_terms SET head_en=$wcbf$Relay$wcbf$, head_zh=$wcbf$接力$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='R' AND position=14;
UPDATE wiki_terms SET head_en=$wcbf$Repetition$wcbf$, head_zh=$wcbf$重复$wcbf$, body_en=$wcbf$Moves and groups can be repeated multiple times by appending the number of repetitions to the closing bracket: (R U')3 = R U' R U' R U'.$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='R' AND position=15;
UPDATE wiki_terms SET head_en=$wcbf$Rescramble$wcbf$, head_zh=$wcbf$克隆$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='R' AND position=16;
UPDATE wiki_terms SET head_en=$wcbf$Reverse$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$See also "inverse".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='R' AND position=17;
UPDATE wiki_terms SET head_en=$wcbf$Review$wcbf$, head_zh=$wcbf$测评$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='R' AND position=18;
UPDATE wiki_terms SET head_en=$wcbf$Rex Cube$wcbf$, head_zh=$wcbf$八轴魔星$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='R' AND position=19;
UPDATE wiki_terms SET head_en=$wcbf$RH (Right-handed)$wcbf$, head_zh=$wcbf$右单（右手单手）$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='R' AND position=20;
UPDATE wiki_terms SET head_en=$wcbf$Rhombic Triacontahedron$wcbf$, head_zh=$wcbf$菱形三十面体$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='R' AND position=21;
UPDATE wiki_terms SET head_en=$wcbf$Risky$wcbf$, head_zh=$wcbf$有风险的$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='R' AND position=22;
UPDATE wiki_terms SET head_en=$wcbf$RLS (Rowe Last Slot)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$VLS + HLS$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='R' AND position=23;
UPDATE wiki_terms SET head_en=$wcbf$rNISS (reverse NISS)$wcbf$, head_zh=$wcbf$反转NISS$wcbf$, body_en=$wcbf$Advanced insertions$wcbf$, body_zh=$wcbf$一种高级插入$wcbf$ WHERE source='seed' AND letter='R' AND position=24;
UPDATE wiki_terms SET head_en=$wcbf$Roll$wcbf$, head_zh=$wcbf$滚动$wcbf$, body_en=$wcbf$Use right index finger to do R2 in R2 D (R' U2 R D') R' U2 R'$wcbf$, body_zh=$wcbf$用右食指压住UBR角块来滚动R层, 做R2 D (R' U2 R D') R' U2 R'中的R2$wcbf$ WHERE source='seed' AND letter='R' AND position=25;
UPDATE wiki_terms SET head_en=$wcbf$Ronnaminx$wcbf$, head_zh=$wcbf$十七阶五魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='R' AND position=26;
UPDATE wiki_terms SET head_en=$wcbf$Rubik' Skewb Notation$wcbf$, head_zh=$wcbf$鲁比克斜转记号$wcbf$, body_en=$wcbf$R, B, L, r, b, l. Used in skewb solution$wcbf$, body_zh=$wcbf$用于斜转解法$wcbf$ WHERE source='seed' AND letter='R' AND position=27;
UPDATE wiki_terms SET head_en=$wcbf$Rubik's Clock$wcbf$, head_zh=$wcbf$魔表$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='R' AND position=28;
UPDATE wiki_terms SET head_en=$wcbf$Rubik's Cube (3x3)$wcbf$, head_zh=$wcbf$鲁比克魔方（三阶魔方）$wcbf$, body_en=$wcbf$A 3-D combination puzzle invented in 1974 by Hungarian sculptor and professor of architecture Ernő Rubik. It consists of 6 faces, each with 9 colored facets. From another aspect, this puzzle has 6 fixed centers, 12 edges, and 8 corners. A solved cube has all facets on each face with the same color.$wcbf$, body_zh=$wcbf$由匈牙利雕塑家和建筑学教授ErnőRubik于1974年发明的三维组合玩具. 它由6个面组成，每个面有9个贴片. 从另一个角度看，它由6个固定的中心块，12个棱块和8个角块. 还原好的魔方的每个面的所有贴片颜色都一样.$wcbf$ WHERE source='seed' AND letter='R' AND position=29;
UPDATE wiki_terms SET head_en=$wcbf$Rubik's Snake$wcbf$, head_zh=$wcbf$魔尺$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='R' AND position=30;
UPDATE wiki_terms SET head_en=$wcbf$RUD$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$R,U,D moves are frequently used in 3-style corner  R,U,D$wcbf$, body_zh=$wcbf$转动在三循环角里被频繁使用$wcbf$ WHERE source='seed' AND letter='R' AND position=31;
UPDATE wiki_terms SET head_en=$wcbf$Roman Room$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$See also "Method of loci".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='R' AND position=32;
UPDATE wiki_terms SET head_en=$wcbf$Rotation$wcbf$, head_zh=$wcbf$转体$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='R' AND position=33;
UPDATE wiki_terms SET head_en=$wcbf$Rotational Symmetry$wcbf$, head_zh=$wcbf$旋转对称$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='R' AND position=34;
UPDATE wiki_terms SET head_en=$wcbf$Rotationless$wcbf$, head_zh=$wcbf$少转体的$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='R' AND position=35;
UPDATE wiki_terms SET head_en=$wcbf$Roux (Gilles Roux)$wcbf$, head_zh=$wcbf$桥式方法$wcbf$, body_en=$wcbf$A 3x3 speedsolving method where 1x2x3 blocks are built on the left and right sides to begin$wcbf$, body_zh=$wcbf$一种三阶魔方还原方法，该方法首先在魔方的左右两边各搭好一个1x2x3的桥$wcbf$ WHERE source='seed' AND letter='R' AND position=36;
UPDATE wiki_terms SET head_en=$wcbf$Row$wcbf$, head_zh=$wcbf$行$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='R' AND position=37;
UPDATE wiki_terms SET head_en=$wcbf$RZP (Ruchy Zupełnie Przypadkowe)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$Completely Random Move$wcbf$, body_zh=$wcbf$的波兰语。Refers to the step between EO and DR where you simplify to something like DR-4e4c$wcbf$ WHERE source='seed' AND letter='R' AND position=38;
UPDATE wiki_terms SET head_en=$wcbf$S (Standing)$wcbf$, head_zh=$wcbf$站立$wcbf$, body_en=$wcbf$A slice move$wcbf$, body_zh=$wcbf$一种中层转动$wcbf$ WHERE source='seed' AND letter='S' AND position=0;
UPDATE wiki_terms SET head_en=$wcbf$S2L (Second Two Layers)$wcbf$, head_zh=$wcbf$第二个两层$wcbf$, body_en=$wcbf$Some pieces on Megaminx$wcbf$, body_zh=$wcbf$五魔上的某些块$wcbf$ WHERE source='seed' AND letter='S' AND position=1;
UPDATE wiki_terms SET head_en=$wcbf$Same$wcbf$, head_zh=$wcbf$相同的$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=2;
UPDATE wiki_terms SET head_en=$wcbf$Sandwich Cube$wcbf$, head_zh=$wcbf$三明治魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=3;
UPDATE wiki_terms SET head_en=$wcbf$SAR (South American Record/Rank)$wcbf$, head_zh=$wcbf$南美洲纪录/排名$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=4;
UPDATE wiki_terms SET head_en=$wcbf$SB (Second Block)$wcbf$, head_zh=$wcbf$右桥, 第二桥$wcbf$, body_en=$wcbf$Used in Roux method.$wcbf$, body_zh=$wcbf$用于桥式.$wcbf$ WHERE source='seed' AND letter='S' AND position=5;
UPDATE wiki_terms SET head_en=$wcbf$Scramble$wcbf$, head_zh=$wcbf$打乱$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=6;
UPDATE wiki_terms SET head_en=$wcbf$Scrambling Orientation$wcbf$, head_zh=$wcbf$打乱朝向$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=7;
UPDATE wiki_terms SET head_en=$wcbf$Selfinverse$wcbf$, head_zh=$wcbf$自逆$wcbf$, body_en=$wcbf$A = A'.$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=8;
UPDATE wiki_terms SET head_en=$wcbf$Setup$wcbf$, head_zh=$wcbf$预设$wcbf$, body_en=$wcbf$See also "conjugate".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=9;
UPDATE wiki_terms SET head_en=$wcbf$Separate$wcbf$, head_zh=$wcbf$分离$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=10;
UPDATE wiki_terms SET head_en=$wcbf$Sexy Move$wcbf$, head_zh=$wcbf$性感转动$wcbf$, body_en=$wcbf$R U R' U'$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=11;
UPDATE wiki_terms SET head_en=$wcbf$Shape Mod$wcbf$, head_zh=$wcbf$形状改装$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=12;
UPDATE wiki_terms SET head_en=$wcbf$Shapeshifting$wcbf$, head_zh=$wcbf$变形$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=13;
UPDATE wiki_terms SET head_en=$wcbf$Shepherd's Cube$wcbf$, head_zh=$wcbf$箭头魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=14;
UPDATE wiki_terms SET head_en=$wcbf$Shiftslotting$wcbf$, head_zh=$wcbf$槽位转移$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=15;
UPDATE wiki_terms SET head_en=$wcbf$Siamese Cube$wcbf$, head_zh=$wcbf$二连体魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=16;
UPDATE wiki_terms SET head_en=$wcbf$Side$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$See also "face".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=17;
UPDATE wiki_terms SET head_en=$wcbf$SiGN (Simple General Notation)$wcbf$, head_zh=$wcbf$简单通用记号$wcbf$, body_en=$wcbf$Standard notation for NxN$wcbf$, body_zh=$wcbf$高阶魔方转动的标准表示法$wcbf$ WHERE source='seed' AND letter='S' AND position=18;
UPDATE wiki_terms SET head_en=$wcbf$Sighted Event$wcbf$, head_zh=$wcbf$睁眼项目$wcbf$, body_en=$wcbf$Non-BLD event$wcbf$, body_zh=$wcbf$非盲拧项目$wcbf$ WHERE source='seed' AND letter='S' AND position=19;
UPDATE wiki_terms SET head_en=$wcbf$Silver Member$wcbf$, head_zh=$wcbf$白银会员$wcbf$, body_en=$wcbf$See also "Mollerz Memberships".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=20;
UPDATE wiki_terms SET head_en=$wcbf$Simulator$wcbf$, head_zh=$wcbf$模拟器$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=21;
UPDATE wiki_terms SET head_en=$wcbf$Simultaneous Move$wcbf$, head_zh=$wcbf$同时转动$wcbf$, body_en=$wcbf$For example, UD, U'D$wcbf$, body_zh=$wcbf$例如UD, U'D$wcbf$ WHERE source='seed' AND letter='S' AND position=22;
UPDATE wiki_terms SET head_en=$wcbf$Single$wcbf$, head_zh=$wcbf$单次成绩$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=23;
UPDATE wiki_terms SET head_en=$wcbf$Singmaster Notation$wcbf$, head_zh=$wcbf$辛马斯特记号$wcbf$, body_en=$wcbf$A basic notation method for 3x3: U, D, L, R, F, B turns the up, down, left, right, front, back face 90° (one quarter turn) clockwise, respectively. Adding a ' or 2 symbol to the end of one of the letters denotes a turn of that layer 90° (one quarter turn) counterclockwise or  180° (one half turn or two quarter turns).$wcbf$, body_zh=$wcbf$三阶的一种基本表示法: U, D, L, R, F, B分别表示将顶，底，左，右，前，后面顺时针转动90°（四分之一圈）. 在其中一个字母后加上撇号或2分别表示逆时针转动该层90°（四分之一圈）或180°（半圈）.$wcbf$ WHERE source='seed' AND letter='S' AND position=24;
UPDATE wiki_terms SET head_en=$wcbf$SK (Skewb)$wcbf$, head_zh=$wcbf$斜转魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=25;
UPDATE wiki_terms SET head_en=$wcbf$Skeleton$wcbf$, head_zh=$wcbf$骨架$wcbf$, body_en=$wcbf$The solved cube except for a few pieces. These pieces are frequently solved using commutators, which are known as insertions for the purposes of this event due to the way they are inserted into the skeleton. Ideally, some of the moves of the insertions will cancel with some of the moves of the skeleton, allowing for the cube to be solved much more efficiently.$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=26;
UPDATE wiki_terms SET head_en=$wcbf$Skew Center$wcbf$, head_zh=$wcbf$斜心$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=27;
UPDATE wiki_terms SET head_en=$wcbf$Skip$wcbf$, head_zh=$wcbf$跳步$wcbf$, body_en=$wcbf$One skipped some step during solving$wcbf$, body_zh=$wcbf$还原时跳过某个步骤$wcbf$ WHERE source='seed' AND letter='S' AND position=28;
UPDATE wiki_terms SET head_en=$wcbf$Slash$wcbf$, head_zh=$wcbf$杠$wcbf$, body_en=$wcbf$Flip notation in SQ-1 SQ-1$wcbf$, body_zh=$wcbf$中翻的表示$wcbf$ WHERE source='seed' AND letter='S' AND position=29;
UPDATE wiki_terms SET head_en=$wcbf$Sledge (Sledgehammer) (R' F R F')$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=30;
UPDATE wiki_terms SET head_en=$wcbf$Slice$wcbf$, head_zh=$wcbf$中层, 内层$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=31;
UPDATE wiki_terms SET head_en=$wcbf$Slice Move$wcbf$, head_zh=$wcbf$内层转动$wcbf$, body_en=$wcbf$Moves M, E, and S on 3x3$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=32;
UPDATE wiki_terms SET head_en=$wcbf$Slice-Plane$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$Conjugated half slice-plane$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=33;
UPDATE wiki_terms SET head_en=$wcbf$Slot$wcbf$, head_zh=$wcbf$槽, 槽位$wcbf$, body_en=$wcbf$A F2L edge-corner pair$wcbf$, body_zh=$wcbf$一组F2L棱角对$wcbf$ WHERE source='seed' AND letter='S' AND position=34;
UPDATE wiki_terms SET head_en=$wcbf$Weak Regrip$wcbf$, head_zh=$wcbf$弱换手$wcbf$, body_en=$wcbf$Non-thumb regrip$wcbf$, body_zh=$wcbf$非拇指的换手$wcbf$ WHERE source='seed' AND letter='S' AND position=35;
UPDATE wiki_terms SET head_en=$wcbf$Soft Regrip$wcbf$, head_zh=$wcbf$软换手$wcbf$, body_en=$wcbf$Regrip that can be done at the same time as another move$wcbf$, body_zh=$wcbf$一只手换手同时另一只手可以做转动或转体的换手$wcbf$ WHERE source='seed' AND letter='S' AND position=36;
UPDATE wiki_terms SET head_en=$wcbf$Solution$wcbf$, head_zh=$wcbf$解法$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=37;
UPDATE wiki_terms SET head_en=$wcbf$Solve$wcbf$, head_zh=$wcbf$还原，解法$wcbf$, body_en=$wcbf$Orient and permute$wcbf$, body_zh=$wcbf$还原色向和排列$wcbf$ WHERE source='seed' AND letter='S' AND position=38;
UPDATE wiki_terms SET head_en=$wcbf$Solver$wcbf$, head_zh=$wcbf$求解器$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=39;
UPDATE wiki_terms SET head_en=$wcbf$SoR (Sum of Ranks)$wcbf$, head_zh=$wcbf$世界排名总和$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=40;
UPDATE wiki_terms SET head_en=$wcbf$Spatial Memory$wcbf$, head_zh=$wcbf$空间记忆$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=41;
UPDATE wiki_terms SET head_en=$wcbf$Speed$wcbf$, head_zh=$wcbf$速度$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=42;
UPDATE wiki_terms SET head_en=$wcbf$Speed-Optimal$wcbf$, head_zh=$wcbf$速拧最优的$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=43;
UPDATE wiki_terms SET head_en=$wcbf$SpeedBLD$wcbf$, head_zh=$wcbf$速盲$wcbf$, body_en=$wcbf$A blindsolving Rubik's cube discipline in which unlimited memorisation time is allowed$wcbf$, body_zh=$wcbf$记忆时间不计入成绩的盲拧项目$wcbf$ WHERE source='seed' AND letter='S' AND position=44;
UPDATE wiki_terms SET head_en=$wcbf$Speedcube$wcbf$, head_zh=$wcbf$速拧魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=45;
UPDATE wiki_terms SET head_en=$wcbf$Speedcuber$wcbf$, head_zh=$wcbf$速拧玩家，速拧选手$wcbf$, body_en=$wcbf$Anyone who solves puzzles as fast as possible$wcbf$, body_zh=$wcbf$以尽可能快地还原魔方为目标的人群$wcbf$ WHERE source='seed' AND letter='S' AND position=46;
UPDATE wiki_terms SET head_en=$wcbf$Speedcubing$wcbf$, head_zh=$wcbf$速拧$wcbf$, body_en=$wcbf$A hobby or sport where an individual solves twisty puzzles as quickly as possible$wcbf$, body_zh=$wcbf$尽可能快地还原魔方的爱好或运动$wcbf$ WHERE source='seed' AND letter='S' AND position=47;
UPDATE wiki_terms SET head_en=$wcbf$Speedsolving$wcbf$, head_zh=$wcbf$速拧$wcbf$, body_en=$wcbf$See also "Speedcubing".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=48;
UPDATE wiki_terms SET head_en=$wcbf$Speffz Letter Scheme  Speffz$wcbf$, head_zh=$wcbf$编码方案$wcbf$, body_en=$wcbf$A standardized lettering scheme proposed by Ville Seppänen and Rob Holt. Start at UBL for A and then goes clockwise in U face to URB for B, etc. After the U face, follows L, F, R, B, and D.
Speffz$wcbf$, body_zh=$wcbf$是由 Ville Seppänen 和 Rob Holt 提出的国际通用的标准化编码方案, 也称为面先编码. 将UBL记为A，然后从U面开始顺时针走，将URB记为B，等等. U面完成后，依次标记L，F，R，B和D面.$wcbf$ WHERE source='seed' AND letter='S' AND position=49;
UPDATE wiki_terms SET head_en=$wcbf$Split$wcbf$, head_zh=$wcbf$分段$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=50;
UPDATE wiki_terms SET head_en=$wcbf$Split Pair$wcbf$, head_zh=$wcbf$游离基$wcbf$, body_en=$wcbf$F2L3 and F2L4$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=51;
UPDATE wiki_terms SET head_en=$wcbf$Spot$wcbf$, head_zh=$wcbf$位置$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=52;
UPDATE wiki_terms SET head_en=$wcbf$SPS$wcbf$, head_zh=$wcbf$翻每秒$wcbf$, body_en=$wcbf$Slash per second (used in SQ1)$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=53;
UPDATE wiki_terms SET head_en=$wcbf$SPTM (Simultaneously-Possible Turn Metric)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=54;
UPDATE wiki_terms SET head_en=$wcbf$Sq (Square)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$1x2x2 block 1x2x2$wcbf$, body_zh=$wcbf$砖$wcbf$ WHERE source='seed' AND letter='S' AND position=55;
UPDATE wiki_terms SET head_en=$wcbf$SQ1 SQ1$wcbf$, head_zh=$wcbf$魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=56;
UPDATE wiki_terms SET head_en=$wcbf$Squan (SQ1)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=57;
UPDATE wiki_terms SET head_en=$wcbf$SS (SpeedSolving Forums)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$https://www.speedsolving.com/$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=58;
UPDATE wiki_terms SET head_en=$wcbf$SS Method (Stern-Sun)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$A 2x2 intermediate method using 2x2 OLS algorithms$wcbf$, body_zh=$wcbf$使用二阶OLS公式的一种二阶进阶方法$wcbf$ WHERE source='seed' AND letter='S' AND position=59;
UPDATE wiki_terms SET head_en=$wcbf$SSE (Superset ENG)$wcbf$, head_zh=$wcbf$超集记号$wcbf$, body_en=$wcbf$Anotation for NxN, for example R, TR, NR, N2-3R, VR, MR, WR, SR, S2-5R, CR
http://randelshofer.ch/rubik/vcube7/doc/supersetENG_7x7.html$wcbf$, body_zh=$wcbf$高阶魔方转动的一种表示法, 例如 R, TR, NR, N2-3R, VR, MR, WR, SR, S2-5R, CR$wcbf$ WHERE source='seed' AND letter='S' AND position=60;
UPDATE wiki_terms SET head_en=$wcbf$Stable ($wcbf$, head_zh=$wcbf$手法) 稳定的$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=61;
UPDATE wiki_terms SET head_en=$wcbf$Stackmat$wcbf$, head_zh=$wcbf$史塔克$wcbf$, body_en=$wcbf$Stackmat Timer, Stackmat$wcbf$, body_zh=$wcbf$史塔克计时器, 史塔克垫$wcbf$ WHERE source='seed' AND letter='S' AND position=62;
UPDATE wiki_terms SET head_en=$wcbf$Standard F2L$wcbf$, head_zh=$wcbf$标准F2L$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=63;
UPDATE wiki_terms SET head_en=$wcbf$Starminx$wcbf$, head_zh=$wcbf$五星五魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=64;
UPDATE wiki_terms SET head_en=$wcbf$Sticker$wcbf$, head_zh=$wcbf$贴纸, 格$wcbf$, body_en=$wcbf$Adhesive label on facet$wcbf$, body_zh=$wcbf$色片上胶粘的标签$wcbf$ WHERE source='seed' AND letter='S' AND position=65;
UPDATE wiki_terms SET head_en=$wcbf$Stickerless Cube$wcbf$, head_zh=$wcbf$彩色魔方/实色魔方/免贴纸魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=66;
UPDATE wiki_terms SET head_en=$wcbf$STM (Slice Turn Metric)$wcbf$, head_zh=$wcbf$中层转动度量制$wcbf$, body_en=$wcbf$A metric for 3x3 where any turn of any layer, by any angle, counts as one turn$wcbf$, body_zh=$wcbf$任意面或任意层的任意角度转动计数为1的度量制
在SQ1中, 是/转动计数为1且不计入UD层转动的度量制$wcbf$ WHERE source='seed' AND letter='S' AND position=67;
UPDATE wiki_terms SET head_en=$wcbf$Sub-T$wcbf$, head_zh=$wcbf$低于T$wcbf$, body_en=$wcbf$Solving time below T$wcbf$, body_zh=$wcbf$在T时间内还原$wcbf$ WHERE source='seed' AND letter='S' AND position=68;
UPDATE wiki_terms SET head_en=$wcbf$Substep$wcbf$, head_zh=$wcbf$子步骤$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=69;
UPDATE wiki_terms SET head_en=$wcbf$Subway Time$wcbf$, head_zh=$wcbf$地铁时间$wcbf$, body_en=$wcbf$Solving when doors open on the subway$wcbf$, body_zh=$wcbf$在地铁开门的时间内还原魔方$wcbf$ WHERE source='seed' AND letter='S' AND position=70;
UPDATE wiki_terms SET head_en=$wcbf$Sune (R U R' U R U2' R')$wcbf$, head_zh=$wcbf$小鱼$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=71;
UPDATE wiki_terms SET head_en=$wcbf$Super Big Cube$wcbf$, head_zh=$wcbf$超高阶魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=72;
UPDATE wiki_terms SET head_en=$wcbf$Supercube$wcbf$, head_zh=$wcbf$带图案的魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=73;
UPDATE wiki_terms SET head_en=$wcbf$Superflip$wcbf$, head_zh=$wcbf$超翻$wcbf$, body_en=$wcbf$A famous position of the 3x3x3 where all corners are solved, and all edges are in the correct location but flipped. Despite its symmetry, this is an extremely difficult pattern, which is known to require 20 moves HTM to solve.$wcbf$, body_zh=$wcbf$所有棱块色向错误，其余都正确的三阶魔方状态. 不考虑对称性，这是一种及其困难的状态，至少需要20步HTM才能还原.$wcbf$ WHERE source='seed' AND letter='S' AND position=74;
UPDATE wiki_terms SET head_en=$wcbf$SV (Summer Variation)$wcbf$, head_zh=$wcbf$夏日变奏曲$wcbf$, body_en=$wcbf$LSLL subset that orients LL corners while solving R U R' case (or the mirror) for the last F2L pair, assuming LL edges are oriented.$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=75;
UPDATE wiki_terms SET head_en=$wcbf$Swag$wcbf$, head_zh=$wcbf$螺旋丸$wcbf$, body_en=$wcbf$Fingertrick of rotating the wrist$wcbf$, body_zh=$wcbf$旋转手腕的指法$wcbf$ WHERE source='seed' AND letter='S' AND position=76;
UPDATE wiki_terms SET head_en=$wcbf$Symmetry$wcbf$, head_zh=$wcbf$对称$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='S' AND position=77;
UPDATE wiki_terms SET head_en=$wcbf$T-Center$wcbf$, head_zh=$wcbf$棱心块$wcbf$, body_en=$wcbf$Edge center$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='T' AND position=0;
UPDATE wiki_terms SET head_en=$wcbf$Table Abuse$wcbf$, head_zh=$wcbf$磕桌$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$单手磕桌流$wcbf$ WHERE source='seed' AND letter='T' AND position=1;
UPDATE wiki_terms SET head_en=$wcbf$Target Slot$wcbf$, head_zh=$wcbf$目标槽$wcbf$, body_en=$wcbf$The F2L slot currently being solved$wcbf$, body_zh=$wcbf$正在被还原的F2L槽$wcbf$ WHERE source='seed' AND letter='T' AND position=2;
UPDATE wiki_terms SET head_en=$wcbf$TCLL (Twisty Corner of Last Layer)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$Supplement methods to EG methods EG$wcbf$, body_zh=$wcbf$方法的补充方法$wcbf$ WHERE source='seed' AND letter='T' AND position=3;
UPDATE wiki_terms SET head_en=$wcbf$Team BLD$wcbf$, head_zh=$wcbf$合盲$wcbf$, body_en=$wcbf$A popular speedcubing social activity where one cuber is blindfolded for the entire solve (including inspection) and communicates (mostly by listening) with another cuber about how to solve the cube.$wcbf$, body_zh=$wcbf$一种流行的速拧活动，一个人观察解法并告诉另一个人，一个人负责盲拧操作.$wcbf$ WHERE source='seed' AND letter='T' AND position=4;
UPDATE wiki_terms SET head_en=$wcbf$TEC (Triple Extended Cross)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$See also "XXXcross".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='T' AND position=5;
UPDATE wiki_terms SET head_en=$wcbf$Team$wcbf$, head_zh=$wcbf$合作$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$例如Team3BLD$wcbf$ WHERE source='seed' AND letter='T' AND position=6;
UPDATE wiki_terms SET head_en=$wcbf$Tension$wcbf$, head_zh=$wcbf$弹力$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='T' AND position=7;
UPDATE wiki_terms SET head_en=$wcbf$Teraminx$wcbf$, head_zh=$wcbf$七阶五魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='T' AND position=8;
UPDATE wiki_terms SET head_en=$wcbf$Time Attack$wcbf$, head_zh=$wcbf$时间攻击$wcbf$, body_en=$wcbf$Timing a full set in succession$wcbf$, body_zh=$wcbf$测速一个完整公式集$wcbf$ WHERE source='seed' AND letter='T' AND position=9;
UPDATE wiki_terms SET head_en=$wcbf$TNoodle$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$Java-based WCA official scramble programs
https://www.worldcubeassociation.org/regulations/scrambles/$wcbf$, body_zh=$wcbf$基于Java的WCA官方打乱程序$wcbf$ WHERE source='seed' AND letter='T' AND position=10;
UPDATE wiki_terms SET head_en=$wcbf$Time Limit$wcbf$, head_zh=$wcbf$还原时限$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='T' AND position=11;
UPDATE wiki_terms SET head_en=$wcbf$Timer$wcbf$, head_zh=$wcbf$计时器$wcbf$, body_en=$wcbf$An instrument designated to measure time, like csTimer, DCtimer and TwistyTimer.$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='T' AND position=12;
UPDATE wiki_terms SET head_en=$wcbf$Tile$wcbf$, head_zh=$wcbf$贴片$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='T' AND position=13;
UPDATE wiki_terms SET head_en=$wcbf$Top-First$wcbf$, head_zh=$wcbf$角先$wcbf$, body_en=$wcbf$A Pyraminx method$wcbf$, body_zh=$wcbf$一种金字塔还原法$wcbf$ WHERE source='seed' AND letter='T' AND position=14;
UPDATE wiki_terms SET head_en=$wcbf$tp (Twisty Puzzles)$wcbf$, head_zh=$wcbf$异形魔方网站$wcbf$, body_en=$wcbf$http://twistypuzzles.com/$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='T' AND position=15;
UPDATE wiki_terms SET head_en=$wcbf$TPS (Turns Per Second)$wcbf$, head_zh=$wcbf$转每秒 (每秒拧的步数)$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='T' AND position=16;
UPDATE wiki_terms SET head_en=$wcbf$TPS WB$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$一般指使用史塔克等魔方计时器和非智能的实体魔方创造的以STM计数转动的TPS世界最好成绩 (有视频).$wcbf$ WHERE source='seed' AND letter='T' AND position=17;
UPDATE wiki_terms SET head_en=$wcbf$Tredge (Triple Edge)$wcbf$, head_zh=$wcbf$组棱$wcbf$, body_en=$wcbf$A block consisting of the two edge pieces on 5x5 that have the same pair of colors$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='T' AND position=18;
UPDATE wiki_terms SET head_en=$wcbf$Trigger ($wcbf$, head_zh=$wcbf$操作)节, 触发器$wcbf$, body_en=$wcbf$A sequence of 3-4 moves easy to memorize and execute$wcbf$, body_zh=$wcbf$容易记忆和执行的3~6步的转动序列$wcbf$ WHERE source='seed' AND letter='T' AND position=19;
UPDATE wiki_terms SET head_en=$wcbf$Triple DR$wcbf$, head_zh=$wcbf$三轴多米诺降群$wcbf$, body_en=$wcbf$DR from every axis$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='T' AND position=20;
UPDATE wiki_terms SET head_en=$wcbf$Truncated Icosahedron$wcbf$, head_zh=$wcbf$截角二十面体$wcbf$, body_en=$wcbf$An Archimedean solid, one of 13 convex isogonal nonprismatic solids whose 32 faces are two or more types of regular polygons$wcbf$, body_zh=$wcbf$一种由12个正五边形和20个正六边形所组成的凸半正多面体，同时具有每个三面角等角和每条边等长的性质，因此属于阿基米德立体$wcbf$ WHERE source='seed' AND letter='T' AND position=21;
UPDATE wiki_terms SET head_en=$wcbf$Tutorial$wcbf$, head_zh=$wcbf$教程$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='T' AND position=22;
UPDATE wiki_terms SET head_en=$wcbf$TuRBo$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$A 3BLD corner intermediate method$wcbf$, body_zh=$wcbf$三盲角块进阶法$wcbf$ WHERE source='seed' AND letter='T' AND position=23;
UPDATE wiki_terms SET head_en=$wcbf$Turn$wcbf$, head_zh=$wcbf$拧$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='T' AND position=24;
UPDATE wiki_terms SET head_en=$wcbf$Tuttminx$wcbf$, head_zh=$wcbf$足球魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='T' AND position=25;
UPDATE wiki_terms SET head_en=$wcbf$Twist$wcbf$, head_zh=$wcbf$转角$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='T' AND position=26;
UPDATE wiki_terms SET head_en=$wcbf$Twisty Puzzle$wcbf$, head_zh=$wcbf$魔方$wcbf$, body_en=$wcbf$A puzzle with twisting or moving layers whose goal is to reach a pre-defined goal state by moving these parts to transition from one state of the puzzle to another. Mechanical puzzles that are operated by twisting groups of pieces.$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='T' AND position=27;
UPDATE wiki_terms SET head_en=$wcbf$Twizzle$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$See also " Twisty Puzzle "$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='T' AND position=28;
UPDATE wiki_terms SET head_en=$wcbf$Tymon's Challenge$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$Tymons Challenge is a measure of the time it takes a cuber to complete three sub-6 3x3 solves, not necessarily consecutively. A successful attempt accounts for the acts of 1) scrambling, 2) inspecting, and 3) timing for every completed solve. Entering times is not necessary, but solves must be timed on a Stackmat. Furthermore, at no point during an attempt may the cuber pause the timer.$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='T' AND position=29;
UPDATE wiki_terms SET head_en=$wcbf$The challenge was invented by Lucas Etter, who drew inspiration from Tymon Kolasinksis Fast Friday videos. Each Friday, Tymon would record three sub-6 3x3 solves, but Lucas saw the opportunity in adding a time component to Tymons plan. Hence, Tymons Challenge is simply the continuous version of recording three sub-6 3x3 solves. It sheds a new light on engaging practice.$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='T' AND position=30;
UPDATE wiki_terms SET head_en=$wcbf$U (Up)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$A face move$wcbf$, body_zh=$wcbf$一种面转动$wcbf$ WHERE source='seed' AND letter='U' AND position=0;
UPDATE wiki_terms SET head_en=$wcbf$Undo$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$See also "Inverse".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='U' AND position=1;
UPDATE wiki_terms SET head_en=$wcbf$Unique Cases$wcbf$, head_zh=$wcbf$本质情况$wcbf$, body_en=$wcbf$Cases where mirrors (and inverses) are excluded$wcbf$, body_zh=$wcbf$排除镜像的情况, 排除镜像及逆的情况$wcbf$ WHERE source='seed' AND letter='U' AND position=2;
UPDATE wiki_terms SET head_en=$wcbf$Unsexy Move (U R U' R')$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='U' AND position=3;
UPDATE wiki_terms SET head_en=$wcbf$Untimed Solve$wcbf$, head_zh=$wcbf$未计时的还原$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='U' AND position=4;
UPDATE wiki_terms SET head_en=$wcbf$UTM (Unidirectional Turn Metric)$wcbf$, head_zh=$wcbf$单方向度量制$wcbf$, body_en=$wcbf$R3 = 3 UTM$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='U' AND position=5;
UPDATE wiki_terms SET head_en=$wcbf$UWR (Unofficial World Record/Rank)$wcbf$, head_zh=$wcbf$非官方比赛世界纪录/排名$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='U' AND position=6;
UPDATE wiki_terms SET head_en=$wcbf$V-First$wcbf$, head_zh=$wcbf$V先$wcbf$, body_en=$wcbf$A pyraminx method$wcbf$, body_zh=$wcbf$一种金字塔还原法$wcbf$ WHERE source='seed' AND letter='V' AND position=0;
UPDATE wiki_terms SET head_en=$wcbf$VC (VisualCube)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$Generate custom Rubik's cube visualisations from your browser address bar
http://cube.rider.biz/visualcube.php$wcbf$, body_zh=$wcbf$魔方作图网页工具$wcbf$ WHERE source='seed' AND letter='V' AND position=1;
UPDATE wiki_terms SET head_en=$wcbf$Virtual Cube$wcbf$, head_zh=$wcbf$虚拟魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='V' AND position=2;
UPDATE wiki_terms SET head_en=$wcbf$Void Cube$wcbf$, head_zh=$wcbf$空心魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='V' AND position=3;
UPDATE wiki_terms SET head_en=$wcbf$VH Method (Vandenbergh-Harris Method) VH$wcbf$, head_zh=$wcbf$法$wcbf$, body_en=$wcbf$C+F1+F2+F3+VHLS+COLL+EPLL [41+32+42+4=119]
C+F1+F2+F3+VHLS+ZBLL (except S+/S-) [41+32+493-72+2=496]
C+F1+F2+F3+VHLS+ZBLL [41+32+493=566]$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='V' AND position=4;
UPDATE wiki_terms SET head_en=$wcbf$VHLS (Vandenbergh-Harris Last Slot) [32]$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$最后一组F2L在组好的情况下控出顶面十字$wcbf$ WHERE source='seed' AND letter='V' AND position=5;
UPDATE wiki_terms SET head_en=$wcbf$VLS (Valk Last Slot)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$VLS insert last connected basic F2L and solve OLL VLS$wcbf$, body_zh=$wcbf$插入末组连接基态F2L并还原OLL$wcbf$ WHERE source='seed' AND letter='V' AND position=6;
UPDATE wiki_terms SET head_en=$wcbf$w (wide)$wcbf$, head_zh=$wcbf$宽$wcbf$, body_en=$wcbf$For example, Rw$wcbf$, body_zh=$wcbf$例如Rw$wcbf$ WHERE source='seed' AND letter='W' AND position=0;
UPDATE wiki_terms SET head_en=$wcbf$Warm Up$wcbf$, head_zh=$wcbf$热身$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='W' AND position=1;
UPDATE wiki_terms SET head_en=$wcbf$Walkthrough$wcbf$, head_zh=$wcbf$实例$wcbf$, body_en=$wcbf$See also "Example Solve".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='W' AND position=2;
UPDATE wiki_terms SET head_en=$wcbf$WB (World Best)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$See also "UWR".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='W' AND position=3;
UPDATE wiki_terms SET head_en=$wcbf$WCA (World Cube Association)$wcbf$, head_zh=$wcbf$世界魔方协会$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='W' AND position=4;
UPDATE wiki_terms SET head_en=$wcbf$Westlund$wcbf$, head_zh=$wcbf$韦斯特隆德法$wcbf$, body_en=$wcbf$The most popular Megaminx method$wcbf$, body_zh=$wcbf$最流行的五魔方法$wcbf$ WHERE source='seed' AND letter='W' AND position=5;
UPDATE wiki_terms SET head_en=$wcbf$WF (With Feet)$wcbf$, head_zh=$wcbf$脚拧$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='W' AND position=6;
UPDATE wiki_terms SET head_en=$wcbf$Windmill Cube$wcbf$, head_zh=$wcbf$风火轮魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='W' AND position=7;
UPDATE wiki_terms SET head_en=$wcbf$Wing$wcbf$, head_zh=$wcbf$翼棱$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='W' AND position=8;
UPDATE wiki_terms SET head_en=$wcbf$WO (Wedel-Odder)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$A Pyraminx advanced method$wcbf$, body_zh=$wcbf$金字塔高级玩法$wcbf$ WHERE source='seed' AND letter='W' AND position=9;
UPDATE wiki_terms SET head_en=$wcbf$WPA (Worst Possible Average)$wcbf$, head_zh=$wcbf$最坏可能平均$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$5把还原中，在前4把已知的前提下，理论上最慢的Ao5, 即前4把中最慢3把的平均$wcbf$ WHERE source='seed' AND letter='W' AND position=10;
UPDATE wiki_terms SET head_en=$wcbf$WR (World Record/$wcbf$, head_zh=$wcbf$排名) 世界纪录/排名$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='W' AND position=11;
UPDATE wiki_terms SET head_en=$wcbf$WV (Winter Variation)$wcbf$, head_zh=$wcbf$冬日变奏曲$wcbf$, body_en=$wcbf$Inserting last connected F2L and orienting LL corners, assuming LL edges are oriented$wcbf$, body_zh=$wcbf$在顶棱正向时, 还原末组F2L（已组好）和角向$wcbf$ WHERE source='seed' AND letter='W' AND position=12;
UPDATE wiki_terms SET head_en=$wcbf$x$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$A rotation move$wcbf$, body_zh=$wcbf$一种整体旋转转动$wcbf$ WHERE source='seed' AND letter='X' AND position=0;
UPDATE wiki_terms SET head_en=$wcbf$X (Center)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$Center on 3x3$wcbf$, body_zh=$wcbf$三阶魔方的中心$wcbf$ WHERE source='seed' AND letter='X' AND position=1;
UPDATE wiki_terms SET head_en=$wcbf$X-Center (Corner Center)$wcbf$, head_zh=$wcbf$角心块$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='X' AND position=2;
UPDATE wiki_terms SET head_en=$wcbf$Xcross, XXcross, XXXcross$wcbf$, head_zh=$wcbf$拓展十字$wcbf$, body_en=$wcbf$Solving cross and one (two or three) F2L$wcbf$, body_zh=$wcbf$还原底面十字和一（二或三）组F2L$wcbf$ WHERE source='seed' AND letter='X' AND position=3;
UPDATE wiki_terms SET head_en=$wcbf$XWR$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$趣味项目世界纪录$wcbf$ WHERE source='seed' AND letter='X' AND position=4;
UPDATE wiki_terms SET head_en=$wcbf$y$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$A rotation move$wcbf$, body_zh=$wcbf$一种整体旋转转动$wcbf$ WHERE source='seed' AND letter='Y' AND position=0;
UPDATE wiki_terms SET head_en=$wcbf$Yau (Robert Yau)$wcbf$, head_zh=$wcbf$邱法$wcbf$, body_en=$wcbf$A big cube speedsolving method, where cross is solved before the cube is fully reduced to 3x3 stage$wcbf$, body_zh=$wcbf$高阶魔方的一种还原方法，在魔方完全降阶到三阶前底面十字就已经还原$wcbf$ WHERE source='seed' AND letter='Y' AND position=1;
UPDATE wiki_terms SET head_en=$wcbf$Yottaminx$wcbf$, head_zh=$wcbf$十五阶五魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='Y' AND position=2;
UPDATE wiki_terms SET head_en=$wcbf$YTWB (YouTube World Best)$wcbf$, head_zh=$wcbf$优兔视频世界最好成绩$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='Y' AND position=3;
UPDATE wiki_terms SET head_en=$wcbf$z$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$A rotation move$wcbf$, body_zh=$wcbf$一种整体旋转转动$wcbf$ WHERE source='seed' AND letter='Z' AND position=0;
UPDATE wiki_terms SET head_en=$wcbf$ZBF2L (Zborowski-Bruchem F2L)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$See also "EOLS".$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='Z' AND position=1;
UPDATE wiki_terms SET head_en=$wcbf$ZBLL (Zborowski-Bruchem LL)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$Solving the entire LL in 1 step, when LL edges are oriented$wcbf$, body_zh=$wcbf$已有顶层十字的情况下一次性还原整个顶层$wcbf$ WHERE source='seed' AND letter='Z' AND position=2;
UPDATE wiki_terms SET head_en=$wcbf$Zettaminx$wcbf$, head_zh=$wcbf$十三阶五魔方$wcbf$, body_en=$wcbf$$wcbf$, body_zh=$wcbf$$wcbf$ WHERE source='seed' AND letter='Z' AND position=3;
UPDATE wiki_terms SET head_en=$wcbf$ZZ (Zbiginiew Zborowski)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$A 3x3 method in which the first step involves orienting all edges on the cube.$wcbf$, body_zh=$wcbf$首先还原所有棱块的色向三阶还原方法$wcbf$ WHERE source='seed' AND letter='Z' AND position=4;
UPDATE wiki_terms SET head_en=$wcbf$ZZLL (Zbigniew Zborowski LL)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$ZBLL subset with 2 opp LL edges$wcbf$, body_zh=$wcbf$至少有一组对棱是对色的ZBLL子集$wcbf$ WHERE source='seed' AND letter='Z' AND position=5;
UPDATE wiki_terms SET head_en=$wcbf$ZZLS (Zbigniew Zborowski LS)$wcbf$, head_zh=$wcbf$$wcbf$, body_en=$wcbf$Solve LS and make 2 opp LL edges, assuming EO are solved$wcbf$, body_zh=$wcbf$还原末槽并完成顶层两个相对棱, 假设EO已还原$wcbf$ WHERE source='seed' AND letter='Z' AND position=6;
