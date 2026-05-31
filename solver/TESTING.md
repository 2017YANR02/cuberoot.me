# TESTING

solver-rust 的测试与基准对比入口。给未来的 AI / 维护者:**先读这页**。

## TL;DR

```powershell
cargo test --release          # 单元 + 轻量 e2e(秒级,不碰 huge 表)
pwsh verify.ps1               # 全 5 analyzer × scramble_5/100,计时 + diff golden
pwsh verify.ps1 -Generate     # 重建 golden 基线(改了算法、确认更优后)
```

## 两层测试

| 层 | 跑法 | 覆盖 | 需要 huge 表 |
|:--|:--|:--|:--:|
| **cargo 单元 / e2e** | `cargo test --release` | 各 solver 内部逻辑 + Cross/XCross e2e | 否 |
| **analyzer 端到端** | `pwsh verify.ps1` | 全 5 analyzer 全 cascade × scramble_5/100,bit-exact + 计时 | **是** |

`cargo test` 默认套件秒级、不依赖大表,适合每次改动跑。
`--ignored` 额外跑中表(pt_cross_C4E0 52MB)+ pseudo 单测/e2e。

全 cascade(std XXCross+ / pair / eo / pseudo_pair)依赖 ~20 GB huge 表
(`pt_cross_C4C5E0E1` + `pt_cross_C4C6E0E2` 各 10 GB + `mt_edge6` 3 GB),不进 cargo
默认套件,统一由 `verify.ps1` 驱动。

## verify.ps1

```powershell
pwsh verify.ps1                          # scramble_5 + scramble_100,对照 golden
pwsh verify.ps1 -Generate                # 把当前输出写成 golden(建/更新基线)
pwsh verify.ps1 -Inputs scramble_5.txt   # 只跑某个输入
pwsh verify.ps1 -TableDir D:\my-tables   # 覆盖表目录(默认 ./tables)
```

逐 analyzer 打印 `耗时 / 行数 / 状态(OK|FAIL|GEN|NO-GOLDEN)`,末尾汇总;有 FAIL 退出码 1。

## 测试输入

| 文件 | 行数 | 用途 |
|:--|--:|:--|
| `testdata/scramble_5.txt` | 5 | 快速冒烟(也是 cargo e2e 源) |
| `testdata/scramble_100.txt` | 100 | 主回归基线 |

两者均取自上游 `D:\cube\solver`,LF / UTF-8 无 BOM,前 20 行 id = 22001..41001。

## golden 由来(可信度)

`testdata/golden/<base>_<analyzer>.csv` = **本程序的受信任输出**。可信依据:每个 analyzer 的
**前 20 行与上游 C++ golden 逐字 bit-exact**(上游 golden 只提供前 20 行;余下由本程序产出)。
上游对照源:

| analyzer | 上游 golden |
|:--|:--|
| std | `D:\cube\solver\golden\scramble_1000_std.txt` |
| pseudo | `…\scramble_1000_pseudo.txt` |
| pair | `…\scramble_1000_pair.txt` |
| pseudo_pair | `…\scramble_100_pseudo_pair.txt` |
| eo | `…\scramble_20_eo.txt` |

改算法后若想更新基线:跑 `verify.ps1 -Generate`,再人工确认前 20 行仍 == 上游(本仓库
`git diff` 应只动你预期的行)。

## 实测耗时(基线)

机器:32 GB RAM,`-C target-cpu=native`(AVX2),huge 表已在 `./tables/` 且 mmap 复用
(不含首次建表)。全 cascade × 6 旋转。

| analyzer | 列数 | scramble_5 | scramble_100 | 量级 |
|:--|--:|--:|--:|:--|
| std(全 30 列) | 31 | 42.8s | 52.5s | ~0.5s/scramble |
| pseudo | 25 | 0.5s | 1.2s | 秒级 |
| pair | 25 | 0.7s | 5.5s | 秒级 |
| pseudo_pair | 25 | 11.8s | 11.4s | ~0.1s/scramble |
| **eo** | 31 | 200.5s | 148.3s | **最慢,~1-40s/scramble** |

> eo 耗时与 scramble 难度强相关(scramble_5 那 5 个恰好偏难,单位耗时反而比 100 高)。
> 跑大批量时优先排 eo 的预算。

## 与上游 C++ 性能对照

上游 README 记录(scramble_1000,表加载另计):std ~6s、pseudo ~3s、pair ~1.3s、
pseudo_pair ~3s(scramble_100)、eo 7.9s(scramble_20)。C++ 用 OpenMP,Rust 用 rayon;
两者均最优解、结果 bit-exact,性能口径不同(scramble 数 / 旋转 / 是否含表加载),不直接可比。
要严格对比,固定同一 scramble 文件 + 同样"表就绪后纯计算"口径各跑一遍。
