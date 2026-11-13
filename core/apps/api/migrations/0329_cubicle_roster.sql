-- Maintainer roster supplied 2026-11-12. All 14 identities confirmed:
-- docs/data-imports/cubicle-2026-11-12.md
-- Add retailer sponsorships without replacing any manufacturer/team assignment.
INSERT INTO wca_teams (name) VALUES ('Cubicle') ON CONFLICT (lower(name)) DO NOTHING;

INSERT INTO wca_person_teams (wca_id, team_id)
SELECT roster.wca_id, team.id
FROM (VALUES
  ('2019WANY36'), -- 王艺衡
  ('2021ZHAN01'), -- 张博藩
  ('2023GENG02'), -- 耿暄一
  ('2023CAOQ01'), -- 曹岂娴
  ('2015QUAN03'), -- Ng Jia Quan
  ('2023YILU01'), -- Luis Tan Hong Yi
  ('2022KAOE01'), -- Emmanuel Kao
  ('2017WANY29'), -- 王逸帆
  ('2023XIUY01'), -- 杨品修
  ('2023GUOK01'), -- 郭铠希（维护者确认图片中的郭恺希）
  ('2023LIUY04'), -- 刘烨宁
  ('2019JIAN54'), -- 姜凌坤
  ('2023DONG20'), -- 董一泽
  ('2019LIZH07') -- 李志权
) AS roster(wca_id)
CROSS JOIN wca_teams team
WHERE lower(team.name) = 'cubicle'
ON CONFLICT (wca_id, team_id) DO NOTHING;
