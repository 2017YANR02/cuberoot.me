-- Update the wrap-up prompt after the repository guidance moved to Codex-native files.
UPDATE ops_commands
SET desc_zh = $dzh$任务结束跑这套清单,确保未来 Codex 凭现有 AGENTS.md / skill / memory / hook 能接手同类任务。$dzh$,
    desc_en = $den$Run this at end of task to ensure a future Codex session can pick up similar work from current AGENTS.md, skills, memories, and hooks.$den$,
    cmd = $cmd$收尾审查:
1. AGENTS.md / skill / memory / hook 是否需要更新?要更新必须极简
2. 用 git add 指定路径只提交你改的文件 (不要 -A)
3. 一句话总结本次工作 + 1-2 条未来注意事项
4. 自检:仅凭现有 AGENTS.md / skill / memory / hook,未来 Codex 能独立接手同类任务吗?$cmd$
WHERE id = 'prompt-wrap-up';
