-- 0114_wca_teachers.sql — WCA 选手按项目登记老师关系。
-- 普通用户只能以有效会员身份登记自己；管理员可指定任意 WCA 选手为老师。
CREATE TABLE wca_teachers (
  student_wca_id VARCHAR(20)  NOT NULL,
  event_id       VARCHAR(20)  NOT NULL,
  teacher_wca_id VARCHAR(20)  NOT NULL,
  teacher_name   VARCHAR(200) NOT NULL,
  created_by     VARCHAR(20)  NOT NULL,
  updated_by     VARCHAR(20)  NOT NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (student_wca_id, event_id),
  CHECK (student_wca_id <> teacher_wca_id)
);
CREATE INDEX idx_wca_teachers_teacher ON wca_teachers(teacher_wca_id, event_id);
CREATE TRIGGER wca_teachers_updated_at BEFORE UPDATE ON wca_teachers
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
