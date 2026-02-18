# TODO

## 增量更新优化

历史世界纪录数据是不可变的（如 WR History），每次全量重新生成浪费算力。

### 方案

1. **首次全量生成**：完整查询结果存为 JSON 缓存
2. **后续增量追加**：只查 `export_date > 上次生成日期` 的新纪录，追加到缓存
3. **从缓存渲染**：生成 Markdown 时读缓存，不查数据库

### 适用统计（数据不可变）

- `wr_single_history` / `wr_average_history`
- `longest_standing_records`
- 其他历史快照类

### 不适用（数据会变）

- `wr_current`、`best_round`、`wr_dominance` 等排名类
