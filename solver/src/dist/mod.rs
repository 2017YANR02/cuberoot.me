//! dist: 分布计算共享模块
//!
//! 与 solver 系列(IDA* + prune table)平行的另一组功能 — 在受限状态空间上做
//! 完整 BFS 并枚举所有起点统计深度分布,移植自 D:\cube\solver_wip\*\\*.cpp。
//!
//! 抽出的共享 helper 跟着第 N 个 bin 一并补充,先放最稳的两个:
//!   - bfs:        通用 byte-valued BFS 距离表 (raw byte race-permit)
//!   - mask:       28 个 popcount==2 的 8-bit mask + 不相交邻接表
//!
//! 下一次有 dist bin 需要新 helper 时,直接在 dist/ 下加文件,不在 bin 里重复造。

pub mod bfs;
pub mod combo;
pub mod mask;
pub mod packed4;
