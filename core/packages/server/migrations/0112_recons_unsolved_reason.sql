-- 未完整复原的复盘只有在提交者明确说明原因后才允许保存。
ALTER TABLE recons ADD COLUMN IF NOT EXISTS unsolved_reason TEXT;
