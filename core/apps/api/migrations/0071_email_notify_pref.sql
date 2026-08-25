-- 邮件通知开关(退订)。默认开:老用户行为不变,退订是显式动作。
-- 只关邮件 —— 站内通知(notifications 表)照写,红点照亮。
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email_notify BOOLEAN NOT NULL DEFAULT TRUE;
