-- WCA 绑定账号的展示名以 WCA 官方资料为准；空缓存留待下次 WCA 登录刷新。
UPDATE app_users AS u
SET display_name = BTRIM(w.name)
FROM wca_users AS w
WHERE u.wca_id = w.wca_id
  AND NULLIF(BTRIM(w.name), '') IS NOT NULL
  AND u.display_name IS DISTINCT FROM BTRIM(w.name);
