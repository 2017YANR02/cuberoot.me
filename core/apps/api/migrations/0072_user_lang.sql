-- 用户的站点语言,用于按收件人语言发通知邮件(此前统一中文标题 + 中英混排正文)。
--
-- NULL = 还不知道(这人自 0072 上线后没在站上出现过)。此时邮件回落双语 —— 不猜。
-- 语言只能在用户自己逛站时得知:未读角标轮询搭车上报(utils/notify.ts 的 rememberLang)。
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS lang VARCHAR(8);
