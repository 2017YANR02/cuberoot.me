-- GAN战队名单20261102V1(1).xlsx, Sheet1; sourceRow preserves the workbook row.
-- Maintainer confirmed on 2026-11-02 that these 38 members have not competed.
-- No WCA identities or results are fabricated. Applied only by the release runner.
WITH roster AS (
  SELECT * FROM jsonb_to_recordset($roster$[
  {"name":"刘欣彤","team":"宇宙爆速社-领航队","sourceRow":108},
  {"name":"陈倪哲","team":"宇宙爆速社-启航队","sourceRow":139},
  {"name":"黄逸宸","team":"宇宙爆速社-启航队","sourceRow":150},
  {"name":"姜亦何","team":"宇宙爆速社-启航队","sourceRow":151},
  {"name":"曹朱熠","team":"宇宙爆速社-启航队","sourceRow":168},
  {"name":"刘周弟","team":"宇宙爆速社-启航队","sourceRow":170},
  {"name":"水奕昕","team":"宇宙爆速社-启航队","sourceRow":176},
  {"name":"严章阳","team":"宇宙爆速社-启航队","sourceRow":177},
  {"name":"林盈希","team":"宇宙爆速社-启航队","sourceRow":179},
  {"name":"张殊语","team":"宇宙爆速社-启航队","sourceRow":182},
  {"name":"缪霁","team":"宇宙爆速社-启航队","sourceRow":183},
  {"name":"沈淑婷","team":"宇宙爆速社-启航队","sourceRow":185},
  {"name":"秦思博","team":"宇宙爆速社-启航队","sourceRow":193},
  {"name":"徐雅婧","team":"宇宙爆速社-启航队","sourceRow":195},
  {"name":"高翊宸","team":"宇宙爆速社-启航队","sourceRow":197},
  {"name":"季暄然","team":"宇宙爆速社-启航队","sourceRow":198},
  {"name":"李欣玥","team":"宇宙爆速社-启航队","sourceRow":199},
  {"name":"马骁","team":"宇宙爆速社-启航队","sourceRow":201},
  {"name":"赵陈翔","team":"宇宙爆速社-启航队","sourceRow":204},
  {"name":"杨哲玺","team":"宇宙爆速社-启航队","sourceRow":209},
  {"name":"黄怀瑾","team":"宇宙爆速社-启航队","sourceRow":210},
  {"name":"王皓泽","team":"宇宙爆速社-启航队","sourceRow":212},
  {"name":"陈芃烁","team":"宇宙爆速社-启航队","sourceRow":215},
  {"name":"付宸睿","team":"宇宙爆速社-启航队","sourceRow":216},
  {"name":"秦靖煊","team":"宇宙爆速社-启航队","sourceRow":217},
  {"name":"冉赵莫嗔","team":"宇宙爆速社-启航队","sourceRow":222},
  {"name":"曹铭泽","team":"宇宙爆速社-启航队","sourceRow":225},
  {"name":"丁俊兮","team":"宇宙爆速社-启航队","sourceRow":226},
  {"name":"马祎祎","team":"宇宙爆速社-启航队","sourceRow":232},
  {"name":"钟意初","team":"宇宙爆速社-启航队","sourceRow":234},
  {"name":"陈显俊","team":"宇宙爆速社-启航队","sourceRow":235},
  {"name":"刘锦辰","team":"宇宙爆速社-启航队","sourceRow":236},
  {"name":"白熙尧","team":"宇宙爆速社-启航队","sourceRow":242},
  {"name":"吕思辰","team":"宇宙爆速社-启航队","sourceRow":246},
  {"name":"熊天烁","team":"宇宙爆速社-启航队","sourceRow":248},
  {"name":"叶永波","team":"宇宙爆速社-启航队","sourceRow":249},
  {"name":"包辰骁","team":"宇宙爆速社-启航队","sourceRow":251},
  {"name":"帅亦翎","team":"宇宙爆速社-启航队","sourceRow":256}
]$roster$::jsonb)
    AS r(name text, team text, "sourceRow" integer)
), teams AS (
  INSERT INTO wca_teams (name) SELECT DISTINCT team FROM roster
  ON CONFLICT (lower(name)) DO UPDATE SET name = wca_teams.name
  RETURNING id, name
)
INSERT INTO wca_person_teams (name, team_id)
SELECT r.name, t.id FROM roster r JOIN teams t ON lower(t.name) = lower(r.team)
WHERE NOT EXISTS (
  SELECT 1 FROM wca_person_teams a
  WHERE a.team_id = t.id AND a.wca_id IS NULL AND a.name = r.name
);
