-- 共同完成者:除主选手(person/person_id)外的额外合作者,JSON 数组 [{name,id,country},...]。
-- 两人合作还原等场景用;成绩归属仍是主选手,co_persons 只作署名展示。
ALTER TABLE recons ADD COLUMN IF NOT EXISTS co_persons TEXT;
