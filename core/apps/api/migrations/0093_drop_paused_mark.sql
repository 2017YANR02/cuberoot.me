-- 退役「搁置」标记(alg_case_marks.status = 'paused')。
-- 勾选与否本身就是「练不练这个 case」的开关,再来一套「搁置」只是第二条互相打架的路径。
-- 存量:只有状态没星标的整行删掉(= 回到「未学」,与客户端的清除语义一致);
-- 带星标的留行,只清状态。updated_at 推到现在,老设备本地那份「搁置」在 LWW 里输给它。
UPDATE alg_case_marks
   SET status = NULL, updated_at = (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
 WHERE status = 'paused' AND starred;

DELETE FROM alg_case_marks WHERE status = 'paused';

ALTER TABLE alg_case_marks DROP CONSTRAINT IF EXISTS alg_case_marks_status_check;
ALTER TABLE alg_case_marks
  ADD CONSTRAINT alg_case_marks_status_check CHECK (status IN ('learning', 'mastered'));
