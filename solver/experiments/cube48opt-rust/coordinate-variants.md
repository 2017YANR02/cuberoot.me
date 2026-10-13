# Opt1–Opt9 坐标的静态恢复

依据是仓库保留的九个原 `cube48optN.wasm`，不是按文件名推测倍增。WABT 静态反编译产物在 `.tmp/cubeopt-reverse/variants/optN.{dcmp,wat}`；没有为本次恢复实例化 WASM、求解或建表。公开原始文件和摘要由 `oracle.mjs` 对应的逐档 manifest 固定。

## 实际参数

表大小逐项读取各档 `get_table_size` 返回常量。每项仍占两位，空槽和 fallback 块头包含在容量中；容量不等于有效抽象状态数。

| Opt | 保留 EO 位 k | 原始表 bytes | 最终坐标数 | WASM 指针 | get_table_size 函数 |
| --- | ---: | ---: | ---: | --- | ---: |
| 1 | 0 | 30,401,280 | 121,605,120 | i32 | 128 |
| 2 | 2 | 121,605,120 | 486,420,480 | i32 | 131 |
| 3 | 3 | 243,210,240 | 972,840,960 | i32 | 131 |
| 4 | 4 | 486,420,480 | 1,945,681,920 | i32 | 131 |
| 5 | 5 | 972,840,960 | 3,891,363,840 | i32 | 131 |
| 6 | 6 | 1,945,681,920 | 7,782,727,680 | i32 | 131 |
| 7 | 7 | 3,891,363,840 | 15,565,455,360 | i32 | 131 |
| 8 | 8 | 7,782,727,680 | 31,130,910,720 | i64 | 130 |
| 9 | 9 | 15,565,455,360 | 62,261,821,440 | i64 | 130 |

该家族没有保留一位 EO 的公开成员。Opt1 到 Opt2 是四倍，之后逐档两倍。Opt6 的最终索引已经超出 u32；Opt6/7 仍采用 memory32，因为存储地址从两位索引除以四得到，不能据 WASM 指针宽度选择 Rust 索引宽度。

九档相同的核心函数编号：`step1_query=37`、`cubie2fast=40`、`input_scramble=71`、`init_cubeopt=72`、`init_fastcube=73`、`cube_move=94`、`edge_conj=95`、`corn_conj=96`、`init_cubie_table=97`、`set_corn_idx=98`、`set_edge_idx=99`、`init_symcord_table=100`、`get_prun_idx=101`。Opt8/9 相关指针参数由 i32 变为 i64；JS 调用需要 BigInt。

## 坐标定义

角块 raw 坐标沿用 `70 * sum(twist[i] * 3^i, i=0..6) + tetrad_rank`。153,090 项小表把它映射成 `(class << 6) | symmetry`，共 3,393 个类。用该 symmetry 对整组棱块共轭，包含翻转变化。

记 `C` 为 corner class；`I` 为去掉 identity 8..11 后其余八个位置中 identity 4..7 的组合序号，范围 0..69；`O` 为 identity 8..11 的四选十二带空槽序号，使用九位。`E = sum(flip[i] << i, i=0..10)`，取的是共轭后的**位置**编号，最后一位由偶翻转约束决定。于是：

```text
index(k) = ((C * 70 + I) << (9 + k))
         | ((E >> (11 - k)) << 9)
         | O
```

Opt1 令 k=0，完全忽略 E；其它档 k=Opt。恢复依据是 `step1_query` 先构造完整值 `C*73400320 + (I<<20) + (E<<9) + O`，再右移 9、8、7、6、5、4、3、2 位、清低九位，最后拼回 O。不是保留 EO 的低 k 位，也不是把整个 Opt1 index 直接左移。

`O` 的有效组合按十二位 mask 从大到小枚举，从 2 起编号；每到 64 的倍数留出两个坐标给块头。每个 512 槽段含 495 个组合，其余是头/尾空槽。各档没有改变这个 padding。两位代码的零值仍取同一个 16-byte 块首字的低四位，其余值加该档 base；base 和搜索上界由表/搜索模块负责。

## 小表布局

以下都是原线性内存中的字节偏移。snapshot 从零开始，恰在动态 PDB 指针之前结束；不包含该指针或大表。

| 区域 | Opt1 | Opt2–7 | Opt8–9 | 数据规模 |
| --- | ---: | ---: | ---: | --- |
| separation8 | 6,560 | 6,656 | 7,392 | 128 × u8 |
| separation12 | 6,688 | 6,784 | 7,520 | 2,048 × u16 |
| fast symmetry | 11,328 | 11,424 | 12,480 | 48 × 48 bytes |
| complement positions | 13,632 | 13,728 | 14,784 | 2,048 × 8 bytes |
| fast moves | 30,016 | 30,112 | 31,168 | 18 × 48 bytes |
| symmetry cubies | 189,856 | 189,952 | 191,008 | 48 × 20 bytes |
| move cubies | 190,816 | 190,912 | 191,968 | 18 × 20 bytes |
| symmetry products | 191,184 | 191,280 | 192,336 | 48 × 48 × u8 |
| reverse products | 193,488 | 193,584 | 194,640 | 48 × 48 × u8 |
| symmetry inverse | 195,792 | 195,888 | 196,944 | 前 48 × u8 |
| mask8 | 201,888 | 201,984 | 203,040 | 70 × u8 |
| mask12 | 201,968 | 202,064 | 203,120 | 512 × u16 |
| raw corner → class/sym | 204,496 | 204,592 | 205,648 | 153,090 × u32 |
| snapshot end / PDB pointer | 816,856 | 816,952 | 818,008 | 指针另占 4 / 4 / 8 bytes |

memory64 的 context 从 1,464 变为 1,472 bytes，node 仍为 68 bytes。stack pointer、budget、status、查询索引的偏移依次为 `1432/u64, 1440/i32, 1444/i32, 1448/u64`；memory32 对应 `1428/u32, 1432/i32, 1436/i32, 1440/u64`。生成阶段 fast-move 对象的单次分配由 19,208,544 变为 19,208,560 bytes；它另有动态分配，不能用这一个数作为峰值。

## Rust 接口与验证边界

`CoordTables::from_variant_bytes(bytes, opt)` 检查档位、精确 snapshot 长度、类号/对称号范围、组合表、complement 表和 18 个原动作。对象保存档位，`variant()` 可读取；`index64(&Cube)` 与 `index64_slow(&Cube)` 根据对象档位计算，不能每次传入不同档位。`coordinate_count()` 返回包括空槽的 u64 容量。

原 `from_bytes`、`index`、`index_slow` 继续服务 Opt1；两个旧 u32 索引入口对非 Opt1 硬失败，避免静默截断。Opt1 的 NEON 路径以编译期 `WITH_EO=false` 省去翻转计算；Opt2–9 通过同样的两个字节 shuffle 和 complement LUT 计算排列部分，并加入共轭后的翻转位。保留纯标量规格供逐项差分。

静态恢复后，主流程已分别用九档原版小表及真实 `step1_query` 索引输出完成差分：407 固定状态、48 对称、正/逆状态、优化/标量一致，以及 Opt6–9 越过 u32 的索引；Opt1 也用通用 binary 回归通过。完整摘要和边界见 [coordinate-matrix.md](coordinate-matrix.md)。这些结果验证的是坐标与状态运算；各档大表解码、搜索和性能仍需各自证据，不能从索引一致性推出。
