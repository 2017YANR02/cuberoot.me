-- Import LowCubes' FTO last-three-triangles methods and Raul Low's Megaminx Full PLL.
-- Source snapshot audited on 2026-08-12. Case/group order, image metadata, and every algorithm
-- are preserved from the upstream Next.js payload; algorithms are kept in upstream order.

INSERT INTO alg_sets (puzzle, set_slug, source, scraped_at) VALUES
  ('fto', 'pf', 'LowCubes / Raul Low: https://www.lowcubes.com/fto/pf; https://www.youtube.com/watch?v=PZplG7lLmik', NOW()),
  ('fto', 'tl', 'LowCubes / Raul Low: https://www.lowcubes.com/fto/tl; https://www.youtube.com/watch?v=PZplG7lLmik', NOW()),
  ('fto', 'lt', 'LowCubes / Raul Low: https://www.lowcubes.com/fto/lt; https://www.youtube.com/watch?v=PZplG7lLmik', NOW()),
  ('fto', 'tcp', 'LowCubes / Raul Low: https://www.lowcubes.com/fto/tcp; https://www.youtube.com/watch?v=32iOmmvgGlU', NOW()),
  ('fto', '1l3t', 'LowCubes / Raul Low: https://www.lowcubes.com/fto/1l3t; https://www.youtube.com/watch?v=32iOmmvgGlU', NOW()),
  ('megaminx', 'full-pll', 'LowCubes / Raul Low: https://www.lowcubes.com/megaminx/full-pll; https://www.youtube.com/watch?v=ykvJMsnzfSw; https://drive.google.com/file/d/1UXCYx-72fwarrNWcoqB1JTCuMgVkCx59', NOW())
ON CONFLICT (puzzle, set_slug) DO UPDATE
SET source = EXCLUDED.source, scraped_at = EXCLUDED.scraped_at;

WITH payload AS (
  SELECT $lowcubes_fto_pf$[
  {
    "position": 0,
    "name": "PF 1",
    "subgroup": "",
    "setup": "F' S'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "1",
        "image": "cases/fto/pf/1.webp",
        "imageAlt": "PF (Pair Formation) 1",
        "imageWidth": "474",
        "imageHeight": "512",
        "sourcePosition": "U"
      }
    },
    "algs": [
      [
        {
          "alg": "S F",
          "source": "LowCubes / Raul Low",
          "setup": "F' S'"
        }
      ]
    ]
  },
  {
    "position": 1,
    "name": "PF 2",
    "subgroup": "",
    "setup": "F' H' F S",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "2",
        "image": "cases/fto/pf/2.webp",
        "imageAlt": "PF (Pair Formation) 2",
        "imageWidth": "474",
        "imageHeight": "512",
        "sourcePosition": "U"
      }
    },
    "algs": [
      [
        {
          "alg": "S' F' H F",
          "source": "LowCubes / Raul Low",
          "setup": "F' H' F S"
        }
      ]
    ]
  },
  {
    "position": 2,
    "name": "PF 3",
    "subgroup": "",
    "setup": "F' S F S",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "3",
        "image": "cases/fto/pf/3.webp",
        "imageAlt": "PF (Pair Formation) 3",
        "imageWidth": "474",
        "imageHeight": "512",
        "sourcePosition": "U"
      }
    },
    "algs": [
      [
        {
          "alg": "S' F' S' F",
          "source": "LowCubes / Raul Low",
          "setup": "F' S F S"
        }
      ]
    ]
  },
  {
    "position": 3,
    "name": "PF 4",
    "subgroup": "",
    "setup": "F S F S",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4",
        "image": "cases/fto/pf/4.webp",
        "imageAlt": "PF (Pair Formation) 4",
        "imageWidth": "474",
        "imageHeight": "512",
        "sourcePosition": "L"
      }
    },
    "algs": [
      [
        {
          "alg": "S' F' S' F'",
          "source": "LowCubes / Raul Low",
          "setup": "F S F S"
        }
      ]
    ]
  },
  {
    "position": 4,
    "name": "PF 5",
    "subgroup": "",
    "setup": "F S'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "5",
        "image": "cases/fto/pf/5.webp",
        "imageAlt": "PF (Pair Formation) 5",
        "imageWidth": "474",
        "imageHeight": "512",
        "sourcePosition": "L"
      }
    },
    "algs": [
      [
        {
          "alg": "S F'",
          "source": "LowCubes / Raul Low",
          "setup": "F S'"
        }
      ]
    ]
  },
  {
    "position": 5,
    "name": "PF 6",
    "subgroup": "",
    "setup": "F' S",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6",
        "image": "cases/fto/pf/6.webp",
        "imageAlt": "PF (Pair Formation) 6",
        "imageWidth": "474",
        "imageHeight": "512",
        "sourcePosition": "R"
      }
    },
    "algs": [
      [
        {
          "alg": "S' F",
          "source": "LowCubes / Raul Low",
          "setup": "F' S"
        }
      ]
    ]
  },
  {
    "position": 6,
    "name": "PF 7",
    "subgroup": "",
    "setup": "F' S'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "7",
        "image": "cases/fto/pf/7.webp",
        "imageAlt": "PF (Pair Formation) 7",
        "imageWidth": "474",
        "imageHeight": "512",
        "sourcePosition": "R"
      }
    },
    "algs": [
      [
        {
          "alg": "S F",
          "source": "LowCubes / Raul Low",
          "setup": "F' S'"
        }
      ]
    ]
  },
  {
    "position": 7,
    "name": "PF 8",
    "subgroup": "",
    "setup": "F S",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "8",
        "image": "cases/fto/pf/8.webp",
        "imageAlt": "PF (Pair Formation) 8",
        "imageWidth": "474",
        "imageHeight": "512",
        "sourcePosition": "L"
      }
    },
    "algs": [
      [
        {
          "alg": "S' F'",
          "source": "LowCubes / Raul Low",
          "setup": "F S"
        }
      ]
    ]
  },
  {
    "position": 8,
    "name": "PF 9",
    "subgroup": "",
    "setup": "F H F S",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "9",
        "image": "cases/fto/pf/9.webp",
        "imageAlt": "PF (Pair Formation) 9",
        "imageWidth": "474",
        "imageHeight": "512",
        "sourcePosition": "R"
      }
    },
    "algs": [
      [
        {
          "alg": "S' F' H' F'",
          "source": "LowCubes / Raul Low",
          "setup": "F H F S"
        }
      ]
    ]
  },
  {
    "position": 9,
    "name": "PF 10",
    "subgroup": "",
    "setup": "F' H' F S F S",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "10",
        "image": "cases/fto/pf/10.webp",
        "imageAlt": "PF (Pair Formation) 10",
        "imageWidth": "474",
        "imageHeight": "512",
        "sourcePosition": "U"
      }
    },
    "algs": [
      [
        {
          "alg": "S' F' S' F' H F",
          "source": "LowCubes / Raul Low",
          "setup": "F' H' F S F S"
        }
      ]
    ]
  }
]$lowcubes_fto_pf$::jsonb AS body
)
INSERT INTO alg_cases (puzzle, set_slug, position, name, subgroup, setup, sticker, algs)
SELECT
  'fto',
  'pf',
  (item ->> 'position')::integer,
  item ->> 'name',
  item ->> 'subgroup',
  item ->> 'setup',
  item -> 'sticker',
  item -> 'algs'
FROM payload
CROSS JOIN LATERAL jsonb_array_elements(payload.body) AS entry(item)
WHERE NOT EXISTS (
  SELECT 1
  FROM alg_cases existing
  WHERE existing.puzzle = 'fto'
    AND existing.set_slug = 'pf'
    AND existing.name = item ->> 'name'
);

WITH payload AS (
  SELECT $lowcubes_fto_tl$[
  {
    "position": 0,
    "name": "TL 1",
    "subgroup": "",
    "setup": "S'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "1",
        "image": "cases/fto/tl/1.webp",
        "imageAlt": "TL (Top Layer) 1",
        "imageWidth": "474",
        "imageHeight": "512"
      }
    },
    "algs": [
      [
        {
          "alg": "S",
          "source": "LowCubes / Raul Low",
          "setup": "S'"
        }
      ]
    ]
  },
  {
    "position": 1,
    "name": "TL 2",
    "subgroup": "",
    "setup": "H'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "2",
        "image": "cases/fto/tl/2.webp",
        "imageAlt": "TL (Top Layer) 2",
        "imageWidth": "474",
        "imageHeight": "512"
      }
    },
    "algs": [
      [
        {
          "alg": "H",
          "source": "LowCubes / Raul Low",
          "setup": "H'"
        }
      ]
    ]
  },
  {
    "position": 2,
    "name": "TL 3",
    "subgroup": "",
    "setup": "S' H'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "3",
        "image": "cases/fto/tl/3.webp",
        "imageAlt": "TL (Top Layer) 3",
        "imageWidth": "474",
        "imageHeight": "512"
      }
    },
    "algs": [
      [
        {
          "alg": "H S",
          "source": "LowCubes / Raul Low",
          "setup": "S' H'"
        }
      ]
    ]
  },
  {
    "position": 3,
    "name": "TL 4",
    "subgroup": "",
    "setup": "H' S",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4",
        "image": "cases/fto/tl/4.webp",
        "imageAlt": "TL (Top Layer) 4",
        "imageWidth": "474",
        "imageHeight": "512"
      }
    },
    "algs": [
      [
        {
          "alg": "S' H",
          "source": "LowCubes / Raul Low",
          "setup": "H' S"
        }
      ]
    ]
  },
  {
    "position": 4,
    "name": "TL 5",
    "subgroup": "",
    "setup": "S' H",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "5",
        "image": "cases/fto/tl/5.webp",
        "imageAlt": "TL (Top Layer) 5",
        "imageWidth": "474",
        "imageHeight": "512"
      }
    },
    "algs": [
      [
        {
          "alg": "H' S",
          "source": "LowCubes / Raul Low",
          "setup": "S' H"
        }
      ]
    ]
  }
]$lowcubes_fto_tl$::jsonb AS body
)
INSERT INTO alg_cases (puzzle, set_slug, position, name, subgroup, setup, sticker, algs)
SELECT
  'fto',
  'tl',
  (item ->> 'position')::integer,
  item ->> 'name',
  item ->> 'subgroup',
  item ->> 'setup',
  item -> 'sticker',
  item -> 'algs'
FROM payload
CROSS JOIN LATERAL jsonb_array_elements(payload.body) AS entry(item)
WHERE NOT EXISTS (
  SELECT 1
  FROM alg_cases existing
  WHERE existing.puzzle = 'fto'
    AND existing.set_slug = 'tl'
    AND existing.name = item ->> 'name'
);

WITH payload AS (
  SELECT $lowcubes_fto_lt$[
  {
    "position": 0,
    "name": "LT 1",
    "subgroup": "",
    "setup": "Uo R U R' U' Rw R' U R U' Rw' Uo'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "1",
        "image": "cases/fto/lt/1.webp",
        "imageAlt": "LT (Last Triangles) 1",
        "imageWidth": "474",
        "imageHeight": "512"
      }
    },
    "algs": [
      [
        {
          "alg": "Uo Rw U R' U' R Rw' U R U' R' Uo'",
          "source": "LowCubes / Raul Low",
          "setup": "Uo R U R' U' Rw R' U R U' Rw' Uo'"
        }
      ]
    ]
  },
  {
    "position": 1,
    "name": "LT 2",
    "subgroup": "",
    "setup": "U Rw R' U R U' Rw' R U R' U",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "2",
        "image": "cases/fto/lt/2.webp",
        "imageAlt": "LT (Last Triangles) 2",
        "imageWidth": "474",
        "imageHeight": "512"
      }
    },
    "algs": [
      [
        {
          "alg": "U' R U' R' Rw U R' U' R Rw' U'",
          "source": "LowCubes / Raul Low",
          "setup": "U Rw R' U R U' Rw' R U R' U"
        }
      ]
    ]
  },
  {
    "position": 2,
    "name": "LT 3",
    "subgroup": "",
    "setup": "U' R U' R' Rw U R' U' R Rw' U'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "3",
        "image": "cases/fto/lt/3.webp",
        "imageAlt": "LT (Last Triangles) 3",
        "imageWidth": "474",
        "imageHeight": "512"
      }
    },
    "algs": [
      [
        {
          "alg": "U Rw R' U R U' Rw' R U R' U",
          "source": "LowCubes / Raul Low",
          "setup": "U' R U' R' Rw U R' U' R Rw' U'"
        }
      ]
    ]
  }
]$lowcubes_fto_lt$::jsonb AS body
)
INSERT INTO alg_cases (puzzle, set_slug, position, name, subgroup, setup, sticker, algs)
SELECT
  'fto',
  'lt',
  (item ->> 'position')::integer,
  item ->> 'name',
  item ->> 'subgroup',
  item ->> 'setup',
  item -> 'sticker',
  item -> 'algs'
FROM payload
CROSS JOIN LATERAL jsonb_array_elements(payload.body) AS entry(item)
WHERE NOT EXISTS (
  SELECT 1
  FROM alg_cases existing
  WHERE existing.puzzle = 'fto'
    AND existing.set_slug = 'lt'
    AND existing.name = item ->> 'name'
);

WITH payload AS (
  SELECT $lowcubes_fto_tcp$[
  {
    "position": 0,
    "name": "A1",
    "subgroup": "",
    "setup": "R U' R' U",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "a1",
        "image": "cases/fto/tcp/a1.webp",
        "imageAlt": "TCP A1",
        "imageWidth": "474",
        "imageHeight": "512"
      }
    },
    "algs": [
      [
        {
          "alg": "U' R U R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U' R' U"
        },
        {
          "alg": "Rt2 R' U R U' Rt2",
          "source": "LowCubes / Raul Low",
          "setup": "Rt2 U R' U' R Rt2"
        }
      ]
    ]
  },
  {
    "position": 1,
    "name": "A2",
    "subgroup": "",
    "setup": "Uo' R' U R' D' R U' R' D R U R U' Uo",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "a2",
        "image": "cases/fto/tcp/a2.webp",
        "imageAlt": "TCP A2",
        "imageWidth": "474",
        "imageHeight": "512"
      }
    },
    "algs": [
      [
        {
          "alg": "Uo' U R' U' R' D' R U R' D R U' R Uo",
          "source": "LowCubes / Raul Low",
          "setup": "Uo' R' U R' D' R U' R' D R U R U' Uo"
        },
        {
          "alg": "Fo R U' R' U R U' R D R' U R D' R Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo R' D R' U' R D' R' U R' U' R U R' Fo'"
        },
        {
          "alg": "Fo R U' R' U R U' Ro' R Br R' L R Br' R2' Ro Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo Ro' R2 Br R' L' R Br' R' Ro U R' U' R U R' Fo'"
        }
      ]
    ]
  },
  {
    "position": 2,
    "name": "A3",
    "subgroup": "",
    "setup": "Fo R' D' R U' R' D' R' U R D' R Fo'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "a3",
        "image": "cases/fto/tcp/a3.webp",
        "imageAlt": "TCP A3",
        "imageWidth": "474",
        "imageHeight": "512"
      }
    },
    "algs": [
      [
        {
          "alg": "Fo R' D R' U' R D R U R' D R Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo R' D' R U' R' D' R' U R D' R Fo'"
        },
        {
          "alg": "F Uo' R D R' U R D R U' R' D R' Uo",
          "source": "LowCubes / Raul Low",
          "setup": "Uo' R D' R U R' D' R' U' R D' R' Uo F'"
        }
      ]
    ]
  },
  {
    "position": 3,
    "name": "A4",
    "subgroup": "",
    "setup": "Ro R' U R U' Lo D' R U R' D U' Rt2",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "a4",
        "image": "cases/fto/tcp/a4.webp",
        "imageAlt": "TCP A4",
        "imageWidth": "474",
        "imageHeight": "512"
      }
    },
    "algs": [
      [
        {
          "alg": "Rt2 U D' R U' R' D Lo' U R' U' R Ro'",
          "source": "LowCubes / Raul Low",
          "setup": "Ro R' U R U' Lo D' R U R' D U' Rt2"
        }
      ]
    ]
  },
  {
    "position": 4,
    "name": "A5",
    "subgroup": "",
    "setup": "Rt2 R' U R2 Rw' U' R' U Rw U' Rt2",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "a5",
        "image": "cases/fto/tcp/a5.webp",
        "imageAlt": "TCP A5",
        "imageWidth": "474",
        "imageHeight": "512"
      }
    },
    "algs": [
      [
        {
          "alg": "Rt2 U Rw' U' R U Rw R2' U' R Rt2",
          "source": "LowCubes / Raul Low",
          "setup": "Rt2 R' U R2 Rw' U' R' U Rw U' Rt2"
        }
      ]
    ]
  },
  {
    "position": 5,
    "name": "A6",
    "subgroup": "",
    "setup": "Rt2 U' Rw' R U' R' U R' Rw U R Rt2",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "a6",
        "image": "cases/fto/tcp/a6.webp",
        "imageAlt": "TCP A6",
        "imageWidth": "474",
        "imageHeight": "512"
      }
    },
    "algs": [
      [
        {
          "alg": "Rt2 R' U' Rw' R U' R U R' Rw U Rt2",
          "source": "LowCubes / Raul Low",
          "setup": "Rt2 U' Rw' R U' R' U R' Rw U R Rt2"
        }
      ]
    ]
  },
  {
    "position": 6,
    "name": "B1",
    "subgroup": "",
    "setup": "Fo U' R U R' Fo'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "b1",
        "image": "cases/fto/tcp/b1.webp",
        "imageAlt": "TCP B1",
        "imageWidth": "474",
        "imageHeight": "512"
      }
    },
    "algs": [
      [
        {
          "alg": "Fo R U' R' U Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo U' R U R' Fo'"
        },
        {
          "alg": "Uo' U R' U' R Uo",
          "source": "LowCubes / Raul Low",
          "setup": "Uo' R' U R U' Uo"
        }
      ]
    ]
  },
  {
    "position": 7,
    "name": "B2",
    "subgroup": "",
    "setup": "R U' R D R' U R D' R' U' R' U",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "b2",
        "image": "cases/fto/tcp/b2.webp",
        "imageAlt": "TCP B2",
        "imageWidth": "474",
        "imageHeight": "512"
      }
    },
    "algs": [
      [
        {
          "alg": "U' R U R D R' U' R D' R' U R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U' R D R' U R D' R' U' R' U"
        },
        {
          "alg": "Rt2 R' U R U' R' U R' D' R U' R' D R2 Rt2",
          "source": "LowCubes / Raul Low",
          "setup": "Rt2 R D' R U R' D R U' R U R' U' R Rt2"
        }
      ]
    ]
  },
  {
    "position": 8,
    "name": "B3",
    "subgroup": "",
    "setup": "R' D R' U' R D R U R' D R F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "b3",
        "image": "cases/fto/tcp/b3.webp",
        "imageAlt": "TCP B3",
        "imageWidth": "474",
        "imageHeight": "512"
      }
    },
    "algs": [
      [
        {
          "alg": "F' R' D' R U' R' D' R' U R D' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' D R' U' R D R U R' D R F"
        }
      ]
    ]
  },
  {
    "position": 9,
    "name": "B4",
    "subgroup": "",
    "setup": "Rt2 U R' U' R Ro' D R' U' R D' U Fo'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "b4",
        "image": "cases/fto/tcp/b4.webp",
        "imageAlt": "TCP B4",
        "imageWidth": "474",
        "imageHeight": "512"
      }
    },
    "algs": [
      [
        {
          "alg": "Fo U' D R' U R D' Ro R' U R U' Rt2",
          "source": "LowCubes / Raul Low",
          "setup": "Rt2 U R' U' R Ro' D R' U' R D' U Fo'"
        }
      ]
    ]
  },
  {
    "position": 10,
    "name": "B5",
    "subgroup": "",
    "setup": "Fo R U' R Rw U R U' Rw' U Fo'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "b5",
        "image": "cases/fto/tcp/b5.webp",
        "imageAlt": "TCP B5",
        "imageWidth": "474",
        "imageHeight": "512"
      }
    },
    "algs": [
      [
        {
          "alg": "Fo U' Rw U R' U' Rw2 R' U R' Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo R U' R Rw U R U' Rw' U Fo'"
        }
      ]
    ]
  },
  {
    "position": 11,
    "name": "B6",
    "subgroup": "",
    "setup": "Fo U Rw R' U R U' Rw' R U' R' Fo'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "b6",
        "image": "cases/fto/tcp/b6.webp",
        "imageAlt": "TCP B6",
        "imageWidth": "474",
        "imageHeight": "512"
      }
    },
    "algs": [
      [
        {
          "alg": "Fo R U R' Rw U R' U' R Rw' U' Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo U Rw R' U R U' Rw' R U' R' Fo'"
        }
      ]
    ]
  },
  {
    "position": 12,
    "name": "C1",
    "subgroup": "",
    "setup": "R' D R' U' R D' R U",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "c1",
        "image": "cases/fto/tcp/c1.webp",
        "imageAlt": "TCP C1",
        "imageWidth": "474",
        "imageHeight": "512"
      }
    },
    "algs": [
      [
        {
          "alg": "U' R' D R' U R D' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' D R' U' R D' R U"
        },
        {
          "alg": "Rt2 Br R D' R U R' D R' U' Rt2",
          "source": "LowCubes / Raul Low",
          "setup": "Rt2 U R D' R U' R' D R' Br' Rt2"
        }
      ]
    ]
  },
  {
    "position": 13,
    "name": "C2",
    "subgroup": "",
    "setup": "Uo' R D' R U R' D R' U' Uo",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "c2",
        "image": "cases/fto/tcp/c2.webp",
        "imageAlt": "TCP C2",
        "imageWidth": "474",
        "imageHeight": "512"
      }
    },
    "algs": [
      [
        {
          "alg": "Uo' U R D' R U' R' D R' Uo",
          "source": "LowCubes / Raul Low",
          "setup": "Uo' R D' R U R' D R' U' Uo"
        },
        {
          "alg": "Fo F' R' D R' U' R D' R U Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo U' R' D R' U R D' R F Fo'"
        }
      ]
    ]
  },
  {
    "position": 14,
    "name": "C3",
    "subgroup": "",
    "setup": "Fo' R' L R2 Br R' L' R Br' R' F' Fo",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "c3",
        "image": "cases/fto/tcp/c3.webp",
        "imageAlt": "TCP C3",
        "imageWidth": "474",
        "imageHeight": "512"
      }
    },
    "algs": [
      [
        {
          "alg": "Fo' F R Br R' L R Br' R2' L' R Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' R' L R2 Br R' L' R Br' R' F' Fo"
        },
        {
          "alg": "F Uo' R D R' U R D' R U' R Uo",
          "source": "LowCubes / Raul Low",
          "setup": "Uo' R' U R' D R' U' R D' R' Uo F'"
        }
      ]
    ]
  },
  {
    "position": 15,
    "name": "C4",
    "subgroup": "",
    "setup": "R U' R D' R U R' D R F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "c4",
        "image": "cases/fto/tcp/c4.webp",
        "imageAlt": "TCP C4",
        "imageWidth": "474",
        "imageHeight": "512"
      }
    },
    "algs": [
      [
        {
          "alg": "F' R' D' R U' R' D R2 U R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U' R D' R U R' D R F"
        }
      ]
    ]
  },
  {
    "position": 16,
    "name": "C5",
    "subgroup": "",
    "setup": "Uo R' U R D' R U R' D R' U R Uo'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "c5",
        "image": "cases/fto/tcp/c5.webp",
        "imageAlt": "TCP C5",
        "imageWidth": "474",
        "imageHeight": "512"
      }
    },
    "algs": [
      [
        {
          "alg": "Uo R' U' R D' R U' R' D R' U' R Uo'",
          "source": "LowCubes / Raul Low",
          "setup": "Uo R' U R D' R U R' D R' U R Uo'"
        }
      ]
    ]
  },
  {
    "position": 17,
    "name": "C6",
    "subgroup": "",
    "setup": "Ro U R' U' R Ro' U' R U R'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "c6",
        "image": "cases/fto/tcp/c6.webp",
        "imageAlt": "TCP C6",
        "imageWidth": "474",
        "imageHeight": "512"
      }
    },
    "algs": [
      [
        {
          "alg": "R U' R' U Ro R' U R U' Ro'",
          "source": "LowCubes / Raul Low",
          "setup": "Ro U R' U' R Ro' U' R U R'"
        },
        {
          "alg": "Uo' R' U R U' Ro' R U' R' U",
          "source": "LowCubes / Raul Low",
          "setup": "U' R U R' Ro U R' U' R Uo"
        },
        {
          "alg": "Rt2 U R' L R' L' R U' R Rt2",
          "source": "LowCubes / Raul Low",
          "setup": "Rt2 R' U R' L R L' R U' Rt2"
        }
      ]
    ]
  }
]$lowcubes_fto_tcp$::jsonb AS body
)
INSERT INTO alg_cases (puzzle, set_slug, position, name, subgroup, setup, sticker, algs)
SELECT
  'fto',
  'tcp',
  (item ->> 'position')::integer,
  item ->> 'name',
  item ->> 'subgroup',
  item ->> 'setup',
  item -> 'sticker',
  item -> 'algs'
FROM payload
CROSS JOIN LATERAL jsonb_array_elements(payload.body) AS entry(item)
WHERE NOT EXISTS (
  SELECT 1
  FROM alg_cases existing
  WHERE existing.puzzle = 'fto'
    AND existing.set_slug = 'tcp'
    AND existing.name = item ->> 'name'
);

WITH payload AS (
  SELECT $lowcubes_fto_1l3t$[
  {
    "position": 1,
    "name": "1.E.1",
    "subgroup": "OLP 1: Even",
    "setup": "",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "1-e-1",
        "image": "cases/fto/1l3t/olp-1/1-e-1.webp",
        "imageAlt": "1.E.1",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      []
    ]
  },
  {
    "position": 2,
    "name": "1.E.2",
    "subgroup": "OLP 1: Even",
    "setup": "Ro R D' R U R' D R U' R Ro'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "1-e-2",
        "image": "cases/fto/1l3t/olp-1/1-e-2.webp",
        "imageAlt": "1.E.2",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Ro R' U R' D' R U' R' D R' Ro'",
          "source": "LowCubes / Raul Low",
          "setup": "Ro R D' R U R' D R U' R Ro'"
        }
      ]
    ]
  },
  {
    "position": 3,
    "name": "1.E.3",
    "subgroup": "OLP 1: Even",
    "setup": "Ro R' U R' D' R U' R' D R' Ro'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "1-e-3",
        "image": "cases/fto/1l3t/olp-1/1-e-3.webp",
        "imageAlt": "1.E.3",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Ro R D' R U R' D R U' R Ro'",
          "source": "LowCubes / Raul Low",
          "setup": "Ro R' U R' D' R U' R' D R' Ro'"
        }
      ]
    ]
  },
  {
    "position": 4,
    "name": "1.E.4",
    "subgroup": "OLP 1: Even",
    "setup": "Ro U R' U Rs' U' R U Rs U Ro'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "1-e-4",
        "image": "cases/fto/1l3t/olp-1/1-e-4.webp",
        "imageAlt": "1.E.4",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Ro U' Rs' U' R' U Rs U' R U' Ro'",
          "source": "LowCubes / Raul Low",
          "setup": "Ro U R' U Rs' U' R U Rs U Ro'"
        },
        {
          "alg": "Lo' U' R U Rw' U' R U Rw' U' R U Lo",
          "source": "LowCubes / Raul Low",
          "setup": "Lo' U' R' U Rw U' R' U Rw U' R' U Lo"
        }
      ]
    ]
  },
  {
    "position": 5,
    "name": "1.E.5",
    "subgroup": "OLP 1: Even",
    "setup": "U' R U R L R L'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "1-e-5",
        "image": "cases/fto/1l3t/olp-1/1-e-5.webp",
        "imageAlt": "1.E.5",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "L R' L' R' U' R' U",
          "source": "LowCubes / Raul Low",
          "setup": "U' R U R L R L'"
        }
      ]
    ]
  },
  {
    "position": 6,
    "name": "1.E.6",
    "subgroup": "OLP 1: Even",
    "setup": "Uo' R D' R U R' D R' Uo U R U R'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "1-e-6",
        "image": "cases/fto/1l3t/olp-1/1-e-6.webp",
        "imageAlt": "1.E.6",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "R U' R' U' Uo' R D' R U' R' D R' Uo",
          "source": "LowCubes / Raul Low",
          "setup": "Uo' R D' R U R' D R' Uo U R U R'"
        }
      ]
    ]
  },
  {
    "position": 7,
    "name": "1.E.7",
    "subgroup": "OLP 1: Even",
    "setup": "Lo' U R U' Rw' U R U' Rw' U R U' Lo",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "1-e-7",
        "image": "cases/fto/1l3t/olp-1/1-e-7.webp",
        "imageAlt": "1.E.7",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Lo' U R' U' Rw U R' U' Rw U R' U' Lo",
          "source": "LowCubes / Raul Low",
          "setup": "Lo' U R U' Rw' U R U' Rw' U R U' Lo"
        },
        {
          "alg": "Ro U R' U Rs' U' R U Rs U Ro'",
          "source": "LowCubes / Raul Low",
          "setup": "Ro U' Rs' U' R' U Rs U' R U' Ro'"
        }
      ]
    ]
  },
  {
    "position": 8,
    "name": "1.E.8",
    "subgroup": "OLP 1: Even",
    "setup": "R' D R' U' R D' R U' L' U' L",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "1-e-8",
        "image": "cases/fto/1l3t/olp-1/1-e-8.webp",
        "imageAlt": "1.E.8",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "L' U L U R' D R' U R D' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' D R' U' R D' R U' L' U' L"
        }
      ]
    ]
  },
  {
    "position": 9,
    "name": "1.E.9",
    "subgroup": "OLP 1: Even",
    "setup": "L R' L' R' U' R' U",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "1-e-9",
        "image": "cases/fto/1l3t/olp-1/1-e-9.webp",
        "imageAlt": "1.E.9",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "U' R U R L R L'",
          "source": "LowCubes / Raul Low",
          "setup": "L R' L' R' U' R' U"
        }
      ]
    ]
  },
  {
    "position": 10,
    "name": "1.O.1",
    "subgroup": "OLP 1: Odd",
    "setup": "Uo R U R' U' Rs U R U' Rw' Uo'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "1-o-1",
        "image": "cases/fto/1l3t/olp-1/1-o-1.webp",
        "imageAlt": "1.O.1",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Uo Rw U R' U' Rs' U R U' R' Uo'",
          "source": "LowCubes / Raul Low",
          "setup": "Uo R U R' U' Rs U R U' Rw' Uo'"
        }
      ]
    ]
  },
  {
    "position": 11,
    "name": "1.O.2",
    "subgroup": "OLP 1: Odd",
    "setup": "Brw' F R' L' U L U' R F' Brw",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "1-o-2",
        "image": "cases/fto/1l3t/olp-1/1-o-2.webp",
        "imageAlt": "1.O.2",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Brw' F R' U L' U' L R F' Brw",
          "source": "LowCubes / Raul Low",
          "setup": "Brw' F R' L' U L U' R F' Brw"
        },
        {
          "alg": "Uo' R' F U' S' U F' R Uo",
          "source": "LowCubes / Raul Low",
          "setup": "Uo' R' F U' S U F' R Uo"
        }
      ]
    ]
  },
  {
    "position": 12,
    "name": "1.O.3",
    "subgroup": "OLP 1: Odd",
    "setup": "Blw F' L H L' F Blw'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "1-o-3",
        "image": "cases/fto/1l3t/olp-1/1-o-3.webp",
        "imageAlt": "1.O.3",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Blw F' L H' L' F Blw'",
          "source": "LowCubes / Raul Low",
          "setup": "Blw F' L H L' F Blw'"
        }
      ]
    ]
  },
  {
    "position": 13,
    "name": "2.E.1",
    "subgroup": "OLP 2: Even",
    "setup": "Rt B' R' F' S' H' F R B Rt'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "2-e-1",
        "image": "cases/fto/1l3t/olp-2/2-e-1.webp",
        "imageAlt": "2.E.1",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Rt B' R' F' H S F R B Rt'",
          "source": "LowCubes / Raul Low",
          "setup": "Rt B' R' F' S' H' F R B Rt'"
        }
      ]
    ]
  },
  {
    "position": 14,
    "name": "2.E.2",
    "subgroup": "OLP 2: Even",
    "setup": "S' F' S' F' S' F' S' F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "2-e-2",
        "image": "cases/fto/1l3t/olp-2/2-e-2.webp",
        "imageAlt": "2.E.2",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F S F S F S F S",
          "source": "LowCubes / Raul Low",
          "setup": "S' F' S' F' S' F' S' F'"
        }
      ]
    ]
  },
  {
    "position": 15,
    "name": "2.E.3",
    "subgroup": "OLP 2: Even",
    "setup": "S F S F S F S F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "2-e-3",
        "image": "cases/fto/1l3t/olp-2/2-e-3.webp",
        "imageAlt": "2.E.3",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' S' F' S' F' S' F' S'",
          "source": "LowCubes / Raul Low",
          "setup": "S F S F S F S F"
        }
      ]
    ]
  },
  {
    "position": 16,
    "name": "2.E.4",
    "subgroup": "OLP 2: Even",
    "setup": "S F' S' F S' F' S F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "2-e-4",
        "image": "cases/fto/1l3t/olp-2/2-e-4.webp",
        "imageAlt": "2.E.4",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F S' F S F' S F S'",
          "source": "LowCubes / Raul Low",
          "setup": "S F' S' F S' F' S F'"
        }
      ]
    ]
  },
  {
    "position": 17,
    "name": "2.E.5",
    "subgroup": "OLP 2: Even",
    "setup": "U' R' U L R L' R' F' L R' L' R F R",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "2-e-5",
        "image": "cases/fto/1l3t/olp-2/2-e-5.webp",
        "imageAlt": "2.E.5",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "R' F' R' L R L' F R L R' L' U' R U",
          "source": "LowCubes / Raul Low",
          "setup": "U' R' U L R L' R' F' L R' L' R F R"
        }
      ]
    ]
  },
  {
    "position": 18,
    "name": "2.E.6",
    "subgroup": "OLP 2: Even",
    "setup": "Blw L' F' S' F' S' F' Blw' U F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "2-e-6",
        "image": "cases/fto/1l3t/olp-2/2-e-6.webp",
        "imageAlt": "2.E.6",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F U' Blw F S F S F L Blw'",
          "source": "LowCubes / Raul Low",
          "setup": "Blw L' F' S' F' S' F' Blw' U F'"
        },
        {
          "alg": "F S F S F S F H",
          "source": "LowCubes / Raul Low",
          "setup": "H' F' S' F' S' F' S' F'"
        }
      ]
    ]
  },
  {
    "position": 19,
    "name": "2.E.7",
    "subgroup": "OLP 2: Even",
    "setup": "S' F S F' S F S' F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "2-e-7",
        "image": "cases/fto/1l3t/olp-2/2-e-7.webp",
        "imageAlt": "2.E.7",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' S F' S' F S' F' S",
          "source": "LowCubes / Raul Low",
          "setup": "S' F S F' S F S' F"
        }
      ]
    ]
  },
  {
    "position": 20,
    "name": "2.E.8",
    "subgroup": "OLP 2: Even",
    "setup": "U' Blw F S F S F L Blw'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "2-e-8",
        "image": "cases/fto/1l3t/olp-2/2-e-8.webp",
        "imageAlt": "2.E.8",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Blw L' F' S' F' S' F' Blw' U",
          "source": "LowCubes / Raul Low",
          "setup": "U' Blw F S F S F L Blw'"
        },
        {
          "alg": "F' U Brw' F' S' F' S' F' R' Brw",
          "source": "LowCubes / Raul Low",
          "setup": "Brw' R F S F S F Brw U' F"
        },
        {
          "alg": "H F' H F' H F' S",
          "source": "LowCubes / Raul Low",
          "setup": "S' F H' F H' F H'"
        },
        {
          "alg": "Fo' Br' R' F' R F R U' R' U F' R' F R Br Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' Br' R' F' R F U' R U R' F' R' F R Br Fo"
        }
      ]
    ]
  },
  {
    "position": 21,
    "name": "2.E.9",
    "subgroup": "OLP 2: Even",
    "setup": "U L U' R' L' R L F R' L R L' F' L'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "2-e-9",
        "image": "cases/fto/1l3t/olp-2/2-e-9.webp",
        "imageAlt": "2.E.9",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "L F L R' L' R F' L' R' L R U L' U'",
          "source": "LowCubes / Raul Low",
          "setup": "U L U' R' L' R L F R' L R L' F' L'"
        }
      ]
    ]
  },
  {
    "position": 22,
    "name": "2.O.1",
    "subgroup": "OLP 2: Odd",
    "setup": "Fo S F' R Rw' L R' L' Rw Fo' F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "2-o-1",
        "image": "cases/fto/1l3t/olp-2/2-o-1.webp",
        "imageAlt": "2.O.1",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Fo Rw' L R L' Rw R' F S' Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo S F' R Rw' L R' L' Rw Fo' F'"
        }
      ]
    ]
  },
  {
    "position": 23,
    "name": "2.O.2",
    "subgroup": "OLP 2: Odd",
    "setup": "U' Blw F H F' L Blw' F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "2-o-2",
        "image": "cases/fto/1l3t/olp-2/2-o-2.webp",
        "imageAlt": "2.O.2",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' Blw L' F H' F' Blw' U",
          "source": "LowCubes / Raul Low",
          "setup": "U' Blw F H F' L Blw' F"
        },
        {
          "alg": "F Fo' H F' S F S Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' S' F' S' F H' Fo F'"
        }
      ]
    ]
  },
  {
    "position": 24,
    "name": "2.O.3",
    "subgroup": "OLP 2: Odd",
    "setup": "Blw L' F H' F' Blw' U",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "2-o-3",
        "image": "cases/fto/1l3t/olp-2/2-o-3.webp",
        "imageAlt": "2.O.3",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "U' Blw F H F' L Blw'",
          "source": "LowCubes / Raul Low",
          "setup": "Blw L' F H' F' Blw' U"
        },
        {
          "alg": "F' S F H F' H",
          "source": "LowCubes / Raul Low",
          "setup": "H' F H' F' S' F"
        }
      ]
    ]
  },
  {
    "position": 25,
    "name": "3.E.1",
    "subgroup": "OLP 3: Even",
    "setup": "Ro Rw U R' U' R Rw' U R U' R' Ro' F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "3-e-1",
        "image": "cases/fto/1l3t/olp-3/3-e-1.webp",
        "imageAlt": "3.E.1",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Ro R U R' U' Rw R' U R U' Rw' Ro'",
          "source": "LowCubes / Raul Low",
          "setup": "Ro Rw U R' U' R Rw' U R U' R' Ro' F'"
        }
      ]
    ]
  },
  {
    "position": 26,
    "name": "3.E.2",
    "subgroup": "OLP 3: Even",
    "setup": "Fo S F H' Fo' F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "3-e-2",
        "image": "cases/fto/1l3t/olp-3/3-e-2.webp",
        "imageAlt": "3.E.2",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' Fo H F' S' Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo S F H' Fo' F"
        }
      ]
    ]
  },
  {
    "position": 27,
    "name": "3.E.3",
    "subgroup": "OLP 3: Even",
    "setup": "Fo H F' S' Fo' F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "3-e-3",
        "image": "cases/fto/1l3t/olp-3/3-e-3.webp",
        "imageAlt": "3.E.3",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Fo S F H' Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo H F' S' Fo' F'"
        }
      ]
    ]
  },
  {
    "position": 28,
    "name": "3.E.4",
    "subgroup": "OLP 3: Even",
    "setup": "S F' H F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "3-e-4",
        "image": "cases/fto/1l3t/olp-3/3-e-4.webp",
        "imageAlt": "3.E.4",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F H' F S'",
          "source": "LowCubes / Raul Low",
          "setup": "S F' H F'"
        }
      ]
    ]
  },
  {
    "position": 29,
    "name": "3.E.5",
    "subgroup": "OLP 3: Even",
    "setup": "R U' R' U R' D R' U' R D' R U F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "3-e-5",
        "image": "cases/fto/1l3t/olp-3/3-e-5.webp",
        "imageAlt": "3.E.5",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' U' R' D R' U R D' R U' R U R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U' R' U R' D R' U' R D' R U F"
        }
      ]
    ]
  },
  {
    "position": 30,
    "name": "3.E.6",
    "subgroup": "OLP 3: Even",
    "setup": "Fo S' F S' Fo' F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "3-e-6",
        "image": "cases/fto/1l3t/olp-3/3-e-6.webp",
        "imageAlt": "3.E.6",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' Fo S F' S Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo S' F S' Fo' F"
        }
      ]
    ]
  },
  {
    "position": 31,
    "name": "3.E.7",
    "subgroup": "OLP 3: Even",
    "setup": "Fo H' F S' Fo' F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "3-e-7",
        "image": "cases/fto/1l3t/olp-3/3-e-7.webp",
        "imageAlt": "3.E.7",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' Fo S F' H Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo H' F S' Fo' F"
        }
      ]
    ]
  },
  {
    "position": 32,
    "name": "3.E.8",
    "subgroup": "OLP 3: Even",
    "setup": "Fo' S F' S Fo F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "3-e-8",
        "image": "cases/fto/1l3t/olp-3/3-e-8.webp",
        "imageAlt": "3.E.8",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Fo' S' F S' Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' S F' S Fo F'"
        }
      ]
    ]
  },
  {
    "position": 33,
    "name": "3.E.9",
    "subgroup": "OLP 3: Even",
    "setup": "Fo U' R' D R' U R D' R U' R U R' Fo' F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "3-e-9",
        "image": "cases/fto/1l3t/olp-3/3-e-9.webp",
        "imageAlt": "3.E.9",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Fo R U' R' U R' D R' U' R D' R U Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo U' R' D R' U R D' R U' R U R' Fo' F'"
        }
      ]
    ]
  },
  {
    "position": 34,
    "name": "3.O.1",
    "subgroup": "OLP 3: Odd",
    "setup": "Fo' R U' Br R' U R U' Br R' U R U' Br R' U Fo F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "3-o-1",
        "image": "cases/fto/1l3t/olp-3/3-o-1.webp",
        "imageAlt": "3.O.1",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Fo' U' R Br' U R' U' R Br' U R' U' R Br' U R' Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' R U' Br R' U R U' Br R' U R U' Br R' U Fo F'"
        }
      ]
    ]
  },
  {
    "position": 35,
    "name": "3.O.2",
    "subgroup": "OLP 3: Odd",
    "setup": "U R Br' U' R' U R Br R' U'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "3-o-2",
        "image": "cases/fto/1l3t/olp-3/3-o-2.webp",
        "imageAlt": "3.O.2",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "U R Br' R' U' R U Br R' U'",
          "source": "LowCubes / Raul Low",
          "setup": "U R Br' U' R' U R Br R' U'"
        }
      ]
    ]
  },
  {
    "position": 36,
    "name": "3.O.3",
    "subgroup": "OLP 3: Odd",
    "setup": "Rt R F R' F' Rw Br' Rw' F' R F' R' Rt'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "3-o-3",
        "image": "cases/fto/1l3t/olp-3/3-o-3.webp",
        "imageAlt": "3.O.3",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Rt R F R' F Rw Br Rw' F R F' R' Rt'",
          "source": "LowCubes / Raul Low",
          "setup": "Rt R F R' F' Rw Br' Rw' F' R F' R' Rt'"
        }
      ]
    ]
  },
  {
    "position": 37,
    "name": "3.O.4",
    "subgroup": "OLP 3: Odd",
    "setup": "Fo' R U Rw' R U' R' U Rw R' U' Fo F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "3-o-4",
        "image": "cases/fto/1l3t/olp-3/3-o-4.webp",
        "imageAlt": "3.O.4",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Fo' U R Rw' U' R U R' Rw U' R' Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' R U Rw' R U' R' U Rw R' U' Fo F'"
        }
      ]
    ]
  },
  {
    "position": 38,
    "name": "3.O.5",
    "subgroup": "OLP 3: Odd",
    "setup": "Fo' S' F' S F' S' Fo",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "3-o-5",
        "image": "cases/fto/1l3t/olp-3/3-o-5.webp",
        "imageAlt": "3.O.5",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Fo' S F S' F S Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' S' F' S F' S' Fo"
        }
      ]
    ]
  },
  {
    "position": 39,
    "name": "3.O.6",
    "subgroup": "OLP 3: Odd",
    "setup": "L Rw' L' R L R' Rw L' F S'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "3-o-6",
        "image": "cases/fto/1l3t/olp-3/3-o-6.webp",
        "imageAlt": "3.O.6",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "S F' L Rw' R L' R' L Rw L'",
          "source": "LowCubes / Raul Low",
          "setup": "L Rw' L' R L R' Rw L' F S'"
        }
      ]
    ]
  },
  {
    "position": 40,
    "name": "3.O.7",
    "subgroup": "OLP 3: Odd",
    "setup": "Fo U R Rw' U' R U R' Rw U' R' Fo' F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "3-o-7",
        "image": "cases/fto/1l3t/olp-3/3-o-7.webp",
        "imageAlt": "3.O.7",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' Fo R U Rw' R U' R' U Rw R' U' Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo U R Rw' U' R U R' Rw U' R' Fo' F"
        }
      ]
    ]
  },
  {
    "position": 41,
    "name": "3.O.8",
    "subgroup": "OLP 3: Odd",
    "setup": "Uo' R' U R U' Br' U Rw' R U' R' U Rw U' Uo F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "3-o-8",
        "image": "cases/fto/1l3t/olp-3/3-o-8.webp",
        "imageAlt": "3.O.8",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Uo' U Rw' U' R U R' Rw U' Br U R' U' R Uo",
          "source": "LowCubes / Raul Low",
          "setup": "Uo' R' U R U' Br' U Rw' R U' R' U Rw U' Uo F'"
        }
      ]
    ]
  },
  {
    "position": 42,
    "name": "3.O.9",
    "subgroup": "OLP 3: Odd",
    "setup": "Fo S F S' F S Fo'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "3-o-9",
        "image": "cases/fto/1l3t/olp-3/3-o-9.webp",
        "imageAlt": "3.O.9",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Fo S' F' S F' S' Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo S F S' F S Fo'"
        }
      ]
    ]
  },
  {
    "position": 43,
    "name": "4a.E.1",
    "subgroup": "OLP 4a: Even",
    "setup": "Fo U' R Br Rw' U R U' R' Rw Br' U R' Fo' F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4a-e-1",
        "image": "cases/fto/1l3t/olp-4a/4a-e-1.webp",
        "imageAlt": "4a.E.1",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' Fo R U' Br Rw' R U R' U' Rw Br' R' U Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo U' R Br Rw' U R U' R' Rw Br' U R' Fo' F"
        },
        {
          "alg": "F' Uo' Rw' U R U' R' Rw Br Rw' R U R' U' Rw Uo",
          "source": "LowCubes / Raul Low",
          "setup": "Uo' Rw' U R U' R' Rw Br' Rw' R U R' U' Rw Uo F"
        },
        {
          "alg": "Lo' R' Br' R U' R' U R' L R L' Br R Lo",
          "source": "LowCubes / Raul Low",
          "setup": "Lo' R' Br' L R' L' R U' R U R' Br R Lo"
        },
        {
          "alg": "Fo' R F U R' L R' L' R U' R F' R' Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' R F R' U R' L R L' R U' F' R' Fo"
        }
      ]
    ]
  },
  {
    "position": 44,
    "name": "4a.E.2",
    "subgroup": "OLP 4a: Even",
    "setup": "Rt' Br R' Rw F' Rw' R Br' R' Rw F Rw' Rt F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4a-e-2",
        "image": "cases/fto/1l3t/olp-4a/4a-e-2.webp",
        "imageAlt": "4a.E.2",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Rt' Rw F' Rw' R Br R' Rw F Rw' R Br' Rt",
          "source": "LowCubes / Raul Low",
          "setup": "Rt' Br R' Rw F' Rw' R Br' R' Rw F Rw' Rt F'"
        },
        {
          "alg": "H F' S F' S",
          "source": "LowCubes / Raul Low",
          "setup": "S' F S' F H'"
        }
      ]
    ]
  },
  {
    "position": 45,
    "name": "4a.E.3",
    "subgroup": "OLP 4a: Even",
    "setup": "Fo U' R' D' R U R' D R Fo' F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4a-e-3",
        "image": "cases/fto/1l3t/olp-4a/4a-e-3.webp",
        "imageAlt": "4a.E.3",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Fo R' D' R U' R' D R U Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo U' R' D' R U R' D R Fo' F'"
        },
        {
          "alg": "F Rt2 U R D R' U' R D' R' Rt2",
          "source": "LowCubes / Raul Low",
          "setup": "Rt2 R D R' U R D' R' U' Rt2 F'"
        }
      ]
    ]
  },
  {
    "position": 46,
    "name": "4a.E.4",
    "subgroup": "OLP 4a: Even",
    "setup": "Fo' Rw' D R' U' R D' R U R' Rw Fo",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4a-e-4",
        "image": "cases/fto/1l3t/olp-4a/4a-e-4.webp",
        "imageAlt": "4a.E.4",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Fo' Rw' R U' R' D R' U R D' Rw Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' Rw' D R' U' R D' R U R' Rw Fo"
        },
        {
          "alg": "Fo S' F S' F S' Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo S F' S F' S Fo'"
        }
      ]
    ]
  },
  {
    "position": 47,
    "name": "4a.E.5",
    "subgroup": "OLP 4a: Even",
    "setup": "Uo' R' U F L R' L' R F' R U' Uo F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4a-e-5",
        "image": "cases/fto/1l3t/olp-4a/4a-e-5.webp",
        "imageAlt": "4a.E.5",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Uo' U R' F R' L R L' F' U' R Uo",
          "source": "LowCubes / Raul Low",
          "setup": "Uo' R' U F L R' L' R F' R U' Uo F'"
        },
        {
          "alg": "F' L R' L' R F' R Rw' F' R U' R' U F Rw R'",
          "source": "LowCubes / Raul Low",
          "setup": "R Rw' F' U' R U R' F Rw R' F R' L R L' F"
        }
      ]
    ]
  },
  {
    "position": 48,
    "name": "4a.E.6",
    "subgroup": "OLP 4a: Even",
    "setup": "Fo H F S F S Fo'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4a-e-6",
        "image": "cases/fto/1l3t/olp-4a/4a-e-6.webp",
        "imageAlt": "4a.E.6",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Fo S' F' S' F' H' Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo H F S F S Fo'"
        },
        {
          "alg": "H F' S F' H",
          "source": "LowCubes / Raul Low",
          "setup": "H' F S' F H'"
        }
      ]
    ]
  },
  {
    "position": 49,
    "name": "4a.E.7",
    "subgroup": "OLP 4a: Even",
    "setup": "Ro R Rw U R' D R' U' R D' Rw' Ro' F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4a-e-7",
        "image": "cases/fto/1l3t/olp-4a/4a-e-7.webp",
        "imageAlt": "4a.E.7",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' Ro Rw D R' U R D' R U' Rw' R' Ro'",
          "source": "LowCubes / Raul Low",
          "setup": "Ro R Rw U R' D R' U' R D' Rw' Ro' F"
        },
        {
          "alg": "H F' H F' S'",
          "source": "LowCubes / Raul Low",
          "setup": "S F H' F H'"
        },
        {
          "alg": "S F' H' F' H'",
          "source": "LowCubes / Raul Low",
          "setup": "H F H F S'"
        }
      ]
    ]
  },
  {
    "position": 50,
    "name": "4a.E.8",
    "subgroup": "OLP 4a: Even",
    "setup": "Fo' S' F' S' F' H' Fo F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4a-e-8",
        "image": "cases/fto/1l3t/olp-4a/4a-e-8.webp",
        "imageAlt": "4a.E.8",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' Fo' H F S F S Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' S' F' S' F' H' Fo F"
        },
        {
          "alg": "H F S F H'",
          "source": "LowCubes / Raul Low",
          "setup": "H F' S' F' H'"
        },
        {
          "alg": "S F H' F S'",
          "source": "LowCubes / Raul Low",
          "setup": "S F' H F' S'"
        },
        {
          "alg": "Ro U R D R' U' R D' R' Br U R' U' R Ro'",
          "source": "LowCubes / Raul Low",
          "setup": "Ro R' U R U' Br' R D R' U R D' R' U' Ro'"
        }
      ]
    ]
  },
  {
    "position": 51,
    "name": "4a.E.9",
    "subgroup": "OLP 4a: Even",
    "setup": "Ro U R' F R' L R L' F' U' R Ro' F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4a-e-9",
        "image": "cases/fto/1l3t/olp-4a/4a-e-9.webp",
        "imageAlt": "4a.E.9",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Ro R' U F L R' L' R F' R U' Ro'",
          "source": "LowCubes / Raul Low",
          "setup": "Ro U R' F R' L R L' F' U' R Ro' F'"
        }
      ]
    ]
  },
  {
    "position": 52,
    "name": "4a.O.1",
    "subgroup": "OLP 4a: Odd",
    "setup": "R' F L R L' R U' R' U R' F' R",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4a-o-1",
        "image": "cases/fto/1l3t/olp-4a/4a-o-1.webp",
        "imageAlt": "4a.O.1",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "R' F R U' R U R' L R' L' F' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' F L R L' R U' R' U R' F' R"
        },
        {
          "alg": "R' F L R L' R U' R' U R' F' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' F R U' R U R' L R' L' F' R"
        },
        {
          "alg": "Lo' U' Rw U' R' U R' L R L' R Rw' U Lo",
          "source": "LowCubes / Raul Low",
          "setup": "Lo' U' Rw R' L R' L' R U' R U Rw' U Lo"
        }
      ]
    ]
  },
  {
    "position": 53,
    "name": "4a.O.2",
    "subgroup": "OLP 4a: Odd",
    "setup": "Fo H' F' S Fo' F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4a-o-2",
        "image": "cases/fto/1l3t/olp-4a/4a-o-2.webp",
        "imageAlt": "4a.O.2",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Fo S' F H Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo H' F' S Fo' F'"
        }
      ]
    ]
  },
  {
    "position": 54,
    "name": "4a.O.3",
    "subgroup": "OLP 4a: Odd",
    "setup": "Fo' U' Rw U R' U' Rs' U Fo F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4a-o-3",
        "image": "cases/fto/1l3t/olp-4a/4a-o-3.webp",
        "imageAlt": "4a.O.3",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Fo' U' Rs U R U' Rw' U Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' U' Rw U R' U' Rs' U Fo F'"
        },
        {
          "alg": "F' Rs' F' S' F Rs",
          "source": "LowCubes / Raul Low",
          "setup": "Rs' F' S F Rs F"
        }
      ]
    ]
  },
  {
    "position": 55,
    "name": "4a.O.4",
    "subgroup": "OLP 4a: Odd",
    "setup": "S F' S' F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4a-o-4",
        "image": "cases/fto/1l3t/olp-4a/4a-o-4.webp",
        "imageAlt": "4a.O.4",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F S F S'",
          "source": "LowCubes / Raul Low",
          "setup": "S F' S' F'"
        }
      ]
    ]
  },
  {
    "position": 56,
    "name": "4a.O.5",
    "subgroup": "OLP 4a: Odd",
    "setup": "Lt2 U' R' D R U' R' D' R U' Lt2 F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4a-o-5",
        "image": "cases/fto/1l3t/olp-4a/4a-o-5.webp",
        "imageAlt": "4a.O.5",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Lt2 U R' D R U R' D' R U Lt2",
          "source": "LowCubes / Raul Low",
          "setup": "Lt2 U' R' D R U' R' D' R U' Lt2 F'"
        }
      ]
    ]
  },
  {
    "position": 57,
    "name": "4a.O.6",
    "subgroup": "OLP 4a: Odd",
    "setup": "R U' Br' R' U R U' Br R' U F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4a-o-6",
        "image": "cases/fto/1l3t/olp-4a/4a-o-6.webp",
        "imageAlt": "4a.O.6",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' U' R Br' U R' U' R Br U R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U' Br' R' U R U' Br R' U F"
        }
      ]
    ]
  },
  {
    "position": 58,
    "name": "4a.O.7",
    "subgroup": "OLP 4a: Odd",
    "setup": "Rt2 L D' R U R' D R' U' R L' Rt2 F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4a-o-7",
        "image": "cases/fto/1l3t/olp-4a/4a-o-7.webp",
        "imageAlt": "4a.O.7",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Rt2 L R' U R D' R U' R' D L' Rt2",
          "source": "LowCubes / Raul Low",
          "setup": "Rt2 L D' R U R' D R' U' R L' Rt2 F'"
        },
        {
          "alg": "F Fo Br' D' R U' R' D R' U R Br Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo Br' R' U' R D' R U R' D Br Fo' F'"
        },
        {
          "alg": "Rt' F Rw F Rw' U Rw' Br' Rw U' F' Rt",
          "source": "LowCubes / Raul Low",
          "setup": "Rt' F U Rw' Br Rw U' Rw F' Rw' F' Rt"
        }
      ]
    ]
  },
  {
    "position": 59,
    "name": "4a.O.8",
    "subgroup": "OLP 4a: Odd",
    "setup": "Fo' U' R Br' U R' U' R Br U R' Fo F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4a-o-8",
        "image": "cases/fto/1l3t/olp-4a/4a-o-8.webp",
        "imageAlt": "4a.O.8",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' Fo' R U' Br' R' U R U' Br R' U Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' U' R Br' U R' U' R Br U R' Fo F"
        }
      ]
    ]
  },
  {
    "position": 60,
    "name": "4a.O.9",
    "subgroup": "OLP 4a: Odd",
    "setup": "Fo' S' F' H Fo F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4a-o-9",
        "image": "cases/fto/1l3t/olp-4a/4a-o-9.webp",
        "imageAlt": "4a.O.9",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Fo' H' F S Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' S' F' H Fo F'"
        }
      ]
    ]
  },
  {
    "position": 61,
    "name": "4b.E.1",
    "subgroup": "OLP 4b: Even",
    "setup": "Fo R U' Br R Rw' U R' U' Rw Br' R' U Fo' F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4b-e-1",
        "image": "cases/fto/1l3t/olp-4b/4b-e-1.webp",
        "imageAlt": "4b.E.1",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Fo U' R Br Rw' U R U' Rw R' Br' U R' Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo R U' Br R Rw' U R' U' Rw Br' R' U Fo' F'"
        },
        {
          "alg": "R' F' L' R U' R U R' L R' F R",
          "source": "LowCubes / Raul Low",
          "setup": "R' F' R L' R U' R' U R' L F R"
        },
        {
          "alg": "B Rw R U' R' U R' L R L' Rw' B'",
          "source": "LowCubes / Raul Low",
          "setup": "B Rw L R' L' R U' R U R' Rw' B'"
        }
      ]
    ]
  },
  {
    "position": 62,
    "name": "4b.E.2",
    "subgroup": "OLP 4b: Even",
    "setup": "Fo R' D' R U' R' D R U Fo' F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4b-e-2",
        "image": "cases/fto/1l3t/olp-4b/4b-e-2.webp",
        "imageAlt": "4b.E.2",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' Fo U' R' D' R U R' D R Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo R' D' R U' R' D R U Fo' F"
        }
      ]
    ]
  },
  {
    "position": 63,
    "name": "4b.E.3",
    "subgroup": "OLP 4b: Even",
    "setup": "Fo' H' F' H' F' S' Fo",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4b-e-3",
        "image": "cases/fto/1l3t/olp-4b/4b-e-3.webp",
        "imageAlt": "4b.E.3",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Fo' S F H F H Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' H' F' H' F' S' Fo"
        },
        {
          "alg": "F' Rt' Br R' Rw F' Rw' R Br' R' Rw F Rw' Rt",
          "source": "LowCubes / Raul Low",
          "setup": "Rt' Rw F' Rw' R Br R' Rw F Rw' R Br' Rt F"
        }
      ]
    ]
  },
  {
    "position": 64,
    "name": "4b.E.4",
    "subgroup": "OLP 4b: Even",
    "setup": "Fo' Rw' R' U' R D' R U R' D Rw Fo F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4b-e-4",
        "image": "cases/fto/1l3t/olp-4b/4b-e-4.webp",
        "imageAlt": "4b.E.4",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Fo' Rw' D' R U' R' D R' U R Rw Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' Rw' R' U' R D' R U R' D Rw Fo F'"
        }
      ]
    ]
  },
  {
    "position": 65,
    "name": "4b.E.5",
    "subgroup": "OLP 4b: Even",
    "setup": "Fo' U' Blw F' H F L Blw' Fo F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4b-e-5",
        "image": "cases/fto/1l3t/olp-4b/4b-e-5.webp",
        "imageAlt": "4b.E.5",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' Fo' Blw L' F' H' F Blw' U Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' U' Blw F' H F L Blw' Fo F"
        }
      ]
    ]
  },
  {
    "position": 66,
    "name": "4b.E.6",
    "subgroup": "OLP 4b: Even",
    "setup": "H' F H' F S' F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4b-e-6",
        "image": "cases/fto/1l3t/olp-4b/4b-e-6.webp",
        "imageAlt": "4b.E.6",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F S F' H F' H",
          "source": "LowCubes / Raul Low",
          "setup": "H' F H' F S' F'"
        }
      ]
    ]
  },
  {
    "position": 67,
    "name": "4b.E.7",
    "subgroup": "OLP 4b: Even",
    "setup": "Ro Rw D' R U R' D R' U' R Rw' Ro'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4b-e-7",
        "image": "cases/fto/1l3t/olp-4b/4b-e-7.webp",
        "imageAlt": "4b.E.7",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Ro Rw R' U R D' R U' R' D Rw' Ro'",
          "source": "LowCubes / Raul Low",
          "setup": "Ro Rw D' R U R' D R' U' R Rw' Ro'"
        }
      ]
    ]
  },
  {
    "position": 68,
    "name": "4b.E.8",
    "subgroup": "OLP 4b: Even",
    "setup": "Fo' Rw' D R' U' R D' R U Rw U' R' U Fo",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4b-e-8",
        "image": "cases/fto/1l3t/olp-4b/4b-e-8.webp",
        "imageAlt": "4b.E.8",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Fo' U' R U Rw' U' R' D R' U R D' Rw Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' Rw' D R' U' R D' R U Rw U' R' U Fo"
        }
      ]
    ]
  },
  {
    "position": 69,
    "name": "4b.E.9",
    "subgroup": "OLP 4b: Even",
    "setup": "Blw L' F' H' F Blw' U F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4b-e-9",
        "image": "cases/fto/1l3t/olp-4b/4b-e-9.webp",
        "imageAlt": "4b.E.9",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' U' Blw F' H F L Blw'",
          "source": "LowCubes / Raul Low",
          "setup": "Blw L' F' H' F Blw' U F"
        }
      ]
    ]
  },
  {
    "position": 70,
    "name": "4b.O.1",
    "subgroup": "OLP 4b: Odd",
    "setup": "Fo' R F' U' R' U R' L R L' R F R' Fo",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4b-o-1",
        "image": "cases/fto/1l3t/olp-4b/4b-o-1.webp",
        "imageAlt": "4b.O.1",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Fo' R F' R' L R' L' R U' R U F R' Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' R F' U' R' U R' L R L' R F R' Fo"
        }
      ]
    ]
  },
  {
    "position": 71,
    "name": "4b.O.2",
    "subgroup": "OLP 4b: Odd",
    "setup": "Ro U Rw' U' R U R' Rw U' Ro' F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4b-o-2",
        "image": "cases/fto/1l3t/olp-4b/4b-o-2.webp",
        "imageAlt": "4b.O.2",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' Ro U Rw' R U' R' U Rw U' Ro'",
          "source": "LowCubes / Raul Low",
          "setup": "Ro U Rw' U' R U R' Rw U' Ro' F"
        }
      ]
    ]
  },
  {
    "position": 72,
    "name": "4b.O.3",
    "subgroup": "OLP 4b: Odd",
    "setup": "Fo S' F H Fo' F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4b-o-3",
        "image": "cases/fto/1l3t/olp-4b/4b-o-3.webp",
        "imageAlt": "4b.O.3",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' Fo H' F' S Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo S' F H Fo' F"
        }
      ]
    ]
  },
  {
    "position": 73,
    "name": "4b.O.4",
    "subgroup": "OLP 4b: Odd",
    "setup": "Uo' L' R' U R D' R U' R' D L Uo F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4b-o-4",
        "image": "cases/fto/1l3t/olp-4b/4b-o-4.webp",
        "imageAlt": "4b.O.4",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' Uo' L' D' R U R' D R' U' R L Uo",
          "source": "LowCubes / Raul Low",
          "setup": "Uo' L' R' U R D' R U' R' D L Uo F"
        },
        {
          "alg": "F' L F R' B R F' R B' R' L'",
          "source": "LowCubes / Raul Low",
          "setup": "L R B R' F R' B' R F' L' F"
        },
        {
          "alg": "F' Fo Rt F' Rw' Br' Rw U' Rw F Rw' U F Rt' Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo Rt F' U' Rw F' Rw' U Rw' Br Rw F Rt' Fo' F"
        }
      ]
    ]
  },
  {
    "position": 74,
    "name": "4b.O.5",
    "subgroup": "OLP 4b: Odd",
    "setup": "H' F S F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4b-o-5",
        "image": "cases/fto/1l3t/olp-4b/4b-o-5.webp",
        "imageAlt": "4b.O.5",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' S' F' H",
          "source": "LowCubes / Raul Low",
          "setup": "H' F S F"
        }
      ]
    ]
  },
  {
    "position": 75,
    "name": "4b.O.6",
    "subgroup": "OLP 4b: Odd",
    "setup": "Fo' R U' Br R' U R U' Br' R' U Fo F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4b-o-6",
        "image": "cases/fto/1l3t/olp-4b/4b-o-6.webp",
        "imageAlt": "4b.O.6",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Fo' U' R Br U R' U' R Br' U R' Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' R U' Br R' U R U' Br' R' U Fo F'"
        }
      ]
    ]
  },
  {
    "position": 76,
    "name": "4b.O.7",
    "subgroup": "OLP 4b: Odd",
    "setup": "S' F S F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4b-o-7",
        "image": "cases/fto/1l3t/olp-4b/4b-o-7.webp",
        "imageAlt": "4b.O.7",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' S' F' S",
          "source": "LowCubes / Raul Low",
          "setup": "S' F S F"
        }
      ]
    ]
  },
  {
    "position": 77,
    "name": "4b.O.8",
    "subgroup": "OLP 4b: Odd",
    "setup": "Fo U' R Br U R' U' R Br' U R' Fo' F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4b-o-8",
        "image": "cases/fto/1l3t/olp-4b/4b-o-8.webp",
        "imageAlt": "4b.O.8",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Fo R U' Br R' U R U' Br' R' U Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo U' R Br U R' U' R Br' U R' Fo' F'"
        }
      ]
    ]
  },
  {
    "position": 78,
    "name": "4b.O.9",
    "subgroup": "OLP 4b: Odd",
    "setup": "Lo' U R D' R' U R D R' U Lo F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4b-o-9",
        "image": "cases/fto/1l3t/olp-4b/4b-o-9.webp",
        "imageAlt": "4b.O.9",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' Lo' U' R D' R' U' R D R' U' Lo",
          "source": "LowCubes / Raul Low",
          "setup": "Lo' U R D' R' U R D R' U Lo F"
        }
      ]
    ]
  },
  {
    "position": 79,
    "name": "4c.E.1",
    "subgroup": "OLP 4c: Even",
    "setup": "Fo' S Fo F H' F' S F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4c-e-1",
        "image": "cases/fto/1l3t/olp-4c/4c-e-1.webp",
        "imageAlt": "4c.E.1",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F S' F H F' Fo' S' Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' S Fo F H' F' S F'"
        }
      ]
    ]
  },
  {
    "position": 80,
    "name": "4c.E.2",
    "subgroup": "OLP 4c: Even",
    "setup": "Br' D R' U' R D' R' U R Br F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4c-e-2",
        "image": "cases/fto/1l3t/olp-4c/4c-e-2.webp",
        "imageAlt": "4c.E.2",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Br' R' U' R D R' U R D' Br",
          "source": "LowCubes / Raul Low",
          "setup": "Br' D R' U' R D' R' U R Br F'"
        },
        {
          "alg": "F Ro' F' R' F' R B R' F R B' F Ro",
          "source": "LowCubes / Raul Low",
          "setup": "Ro' F' B R' F' R B' R' F R F Ro F'"
        }
      ]
    ]
  },
  {
    "position": 81,
    "name": "4c.E.3",
    "subgroup": "OLP 4c: Even",
    "setup": "Uo' B' F R F R' B R F' R' F' Uo F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4c-e-3",
        "image": "cases/fto/1l3t/olp-4c/4c-e-3.webp",
        "imageAlt": "4c.E.3",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' Uo' F R F R' B' R F' R' F' B Uo",
          "source": "LowCubes / Raul Low",
          "setup": "Uo' B' F R F R' B R F' R' F' Uo F"
        },
        {
          "alg": "F' Ft2 Br R B R' F' R B' R' F Br' Ft2",
          "source": "LowCubes / Raul Low",
          "setup": "Ft2 Br F' R B R' F R B' R' Br' Ft2 F"
        }
      ]
    ]
  },
  {
    "position": 82,
    "name": "4c.E.4",
    "subgroup": "OLP 4c: Even",
    "setup": "U' R Br' U R' U' R Br U R' U' R U R' F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4c-e-4",
        "image": "cases/fto/1l3t/olp-4c/4c-e-4.webp",
        "imageAlt": "4c.E.4",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' R U' R' U R U' Br' R' U R U' Br R' U",
          "source": "LowCubes / Raul Low",
          "setup": "U' R Br' U R' U' R Br U R' U' R U R' F"
        },
        {
          "alg": "F' U' R U R' U' R Br' R' U R U' Br R' U",
          "source": "LowCubes / Raul Low",
          "setup": "U' R Br' U R' U' R Br R' U R U' R' U F"
        },
        {
          "alg": "F' Fo' U' R U R' U' R Br' U R' U' R Br U R' Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' R U' Br' R' U R U' Br R' U R U' R' U Fo F"
        },
        {
          "alg": "F' Fo' R U' R' U R U' Br' U R' U' R Br U R' Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' R U' Br' R' U R U' Br U R' U' R U R' Fo F"
        }
      ]
    ]
  },
  {
    "position": 83,
    "name": "4c.E.5",
    "subgroup": "OLP 4c: Even",
    "setup": "S' F' S F S' F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4c-e-5",
        "image": "cases/fto/1l3t/olp-4c/4c-e-5.webp",
        "imageAlt": "4c.E.5",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' S F' S' F S",
          "source": "LowCubes / Raul Low",
          "setup": "S' F' S F S' F"
        }
      ]
    ]
  },
  {
    "position": 84,
    "name": "4c.E.6",
    "subgroup": "OLP 4c: Even",
    "setup": "R Rw' F' R U' R' U F L R' L' Rw F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4c-e-6",
        "image": "cases/fto/1l3t/olp-4c/4c-e-6.webp",
        "imageAlt": "4c.E.6",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' Rw' L R L' F' U' R U R' F Rw R'",
          "source": "LowCubes / Raul Low",
          "setup": "R Rw' F' R U' R' U F L R' L' Rw F"
        },
        {
          "alg": "F Ft2 R L' R U' R' U F L R' L' R F' L R' Ft2",
          "source": "LowCubes / Raul Low",
          "setup": "Ft2 R L' F R' L R L' F' U' R U R' L R' Ft2 F'"
        },
        {
          "alg": "F' Fo R U' Br R' U R U' Br' Rw' R U R' U' Rw R' U Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo U' R Rw' U R U' R' Rw Br U R' U' R Br' U R' Fo' F"
        },
        {
          "alg": "F Fo' S F' S F S F S' Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' S F' S' F' S' F S' Fo F'"
        }
      ]
    ]
  },
  {
    "position": 85,
    "name": "4c.E.7",
    "subgroup": "OLP 4c: Even",
    "setup": "Fo' U' R Br U R' U' R Br' U R' U' R U R' Fo F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4c-e-7",
        "image": "cases/fto/1l3t/olp-4c/4c-e-7.webp",
        "imageAlt": "4c.E.7",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Fo' R U' R' U R U' Br R' U R U' Br' R' U Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' U' R Br U R' U' R Br' U R' U' R U R' Fo F'"
        },
        {
          "alg": "F Fo R U' R' U R U' Br U R' U' R Br' U R' Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo R U' Br R' U R U' Br' U R' U' R U R' Fo' F'"
        },
        {
          "alg": "F Fo U' R U R' U' R Br U R' U' R Br' U R' Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo R U' Br R' U R U' Br' R' U R U' R' U Fo' F'"
        },
        {
          "alg": "F Fo' U' R U R' U' R Br R' U R U' Br' R' U Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' U' R Br U R' U' R Br' R' U R U' R' U Fo F'"
        },
        {
          "alg": "F Fo' R U' R' U R U' Br R' U R U' Br' R' U Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' U' R Br U R' U' R Br' U R' U' R U R' Fo F'"
        }
      ]
    ]
  },
  {
    "position": 86,
    "name": "4c.E.8",
    "subgroup": "OLP 4c: Even",
    "setup": "Fo' Rs F S F' U' R U Rw' Fo F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4c-e-8",
        "image": "cases/fto/1l3t/olp-4c/4c-e-8.webp",
        "imageAlt": "4c.E.8",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Fo' Rw U' R' U F S' F' Rs' Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' Rs F S F' U' R U Rw' Fo F'"
        }
      ]
    ]
  },
  {
    "position": 87,
    "name": "4c.E.9",
    "subgroup": "OLP 4c: Even",
    "setup": "S F S' F' S F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4c-e-9",
        "image": "cases/fto/1l3t/olp-4c/4c-e-9.webp",
        "imageAlt": "4c.E.9",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F S' F S F' S'",
          "source": "LowCubes / Raul Low",
          "setup": "S F S' F' S F'"
        }
      ]
    ]
  },
  {
    "position": 88,
    "name": "4c.O.1",
    "subgroup": "OLP 4c: Odd",
    "setup": "S' F' S' F' H F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4c-o-1",
        "image": "cases/fto/1l3t/olp-4c/4c-o-1.webp",
        "imageAlt": "4c.O.1",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' H' F S F S",
          "source": "LowCubes / Raul Low",
          "setup": "S' F' S' F' H F"
        }
      ]
    ]
  },
  {
    "position": 89,
    "name": "4c.O.2",
    "subgroup": "OLP 4c: Odd",
    "setup": "Fo Br' R F' S F R' Br Fo' F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4c-o-2",
        "image": "cases/fto/1l3t/olp-4c/4c-o-2.webp",
        "imageAlt": "4c.O.2",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' Fo Br' R F' S' F R' Br Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo Br' R F' S F R' Br Fo' F"
        },
        {
          "alg": "F' Rt2 D' R Br' U R' U' R Br R' D Rt2",
          "source": "LowCubes / Raul Low",
          "setup": "Rt2 D' R Br' R' U R U' Br R' D Rt2 F"
        },
        {
          "alg": "F Lt2 D R' Br U' R' U R Br' R D' Lt2",
          "source": "LowCubes / Raul Low",
          "setup": "Lt2 D R' Br R' U' R U Br' R D' Lt2 F'"
        },
        {
          "alg": "F Ro U Rw' U' Rw R' U R U' Rw' U Rw U' Ro'",
          "source": "LowCubes / Raul Low",
          "setup": "Ro U Rw' U' Rw U R' U' R Rw' U Rw U' Ro' F'"
        }
      ]
    ]
  },
  {
    "position": 90,
    "name": "4c.O.3",
    "subgroup": "OLP 4c: Odd",
    "setup": "Fo' Bl L' F S' F' L Bl' Fo F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4c-o-3",
        "image": "cases/fto/1l3t/olp-4c/4c-o-3.webp",
        "imageAlt": "4c.O.3",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Fo' Bl L' F S F' L Bl' Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' Bl L' F S' F' L Bl' Fo F'"
        },
        {
          "alg": "F Fo' Rw U' Br R' U R U' Br' U Rw' Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' Rw U' Br U R' U' R Br' U Rw' Fo F'"
        },
        {
          "alg": "Ro Rw' R Br' Rw' R U R' U' Rw Br Rw R' Ro'",
          "source": "LowCubes / Raul Low",
          "setup": "Ro R Rw' Br' Rw' U R U' R' Rw Br R' Rw Ro'"
        }
      ]
    ]
  },
  {
    "position": 91,
    "name": "4c.O.4",
    "subgroup": "OLP 4c: Odd",
    "setup": "U' Rw' D' R U R' D R' U' R Rw U F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4c-o-4",
        "image": "cases/fto/1l3t/olp-4c/4c-o-4.webp",
        "imageAlt": "4c.O.4",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F U' Rw' R' U R D' R U' R' D Rw U",
          "source": "LowCubes / Raul Low",
          "setup": "U' Rw' D' R U R' D R' U' R Rw U F'"
        },
        {
          "alg": "F Fo' U' R U R' Rw U Br U' R' U R Br' U' Rw' Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' Rw U Br R' U' R U Br' U' Rw' R U' R' U Fo F'"
        },
        {
          "alg": "F Ro Rw' R U' R' U Rw U Br R' U' R U Br' U' Ro'",
          "source": "LowCubes / Raul Low",
          "setup": "Ro U Br U' R' U R Br' U' Rw' U' R U R' Rw Ro' F'"
        },
        {
          "alg": "F R U' R' U Rw U Br R' U' R U Br' U' Rw'",
          "source": "LowCubes / Raul Low",
          "setup": "Rw U Br U' R' U R Br' U' Rw' U' R U R' F'"
        }
      ]
    ]
  },
  {
    "position": 92,
    "name": "4c.O.5",
    "subgroup": "OLP 4c: Odd",
    "setup": "Fo' Rw' L R L' F S F' Rs Fo",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4c-o-5",
        "image": "cases/fto/1l3t/olp-4c/4c-o-5.webp",
        "imageAlt": "4c.O.5",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Fo' Rs' F S' F' L R' L' Rw Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' Rw' L R L' F S F' Rs Fo"
        },
        {
          "alg": "Fo' R Rw' F L R' L' R F' L R' L' Rw Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' Rw' L R L' F R' L R L' F' Rw R' Fo"
        },
        {
          "alg": "F Lt2 U R' U R U Rw' D' U R' U' R D Lt2",
          "source": "LowCubes / Raul Low",
          "setup": "Lt2 D' R' U R U' D Rw U' R' U' R U' Lt2 F'"
        }
      ]
    ]
  },
  {
    "position": 93,
    "name": "4c.O.6",
    "subgroup": "OLP 4c: Odd",
    "setup": "Fo S F S F S' Fo' F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4c-o-6",
        "image": "cases/fto/1l3t/olp-4c/4c-o-6.webp",
        "imageAlt": "4c.O.6",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Fo S F' S' F' S' Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo S F S F S' Fo' F'"
        }
      ]
    ]
  },
  {
    "position": 94,
    "name": "4c.O.7",
    "subgroup": "OLP 4c: Odd",
    "setup": "Rs' L R' L' Rw F Rw' L R L' Rs F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4c-o-7",
        "image": "cases/fto/1l3t/olp-4c/4c-o-7.webp",
        "imageAlt": "4c.O.7",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Rs' L R' L' Rw F' Rw' L R L' Rs",
          "source": "LowCubes / Raul Low",
          "setup": "Rs' L R' L' Rw F Rw' L R L' Rs F'"
        },
        {
          "alg": "F Ro Rw' R U R' U' Rw Br' Rw' U R U' Rw R' Ro'",
          "source": "LowCubes / Raul Low",
          "setup": "Ro R Rw' U R' U' Rw Br Rw' U R U' R' Rw Ro' F'"
        },
        {
          "alg": "Rw R' U' R Br' R' U R U' Br U Rw'",
          "source": "LowCubes / Raul Low",
          "setup": "Rw U' Br' U R' U' R Br R' U R Rw'"
        }
      ]
    ]
  },
  {
    "position": 95,
    "name": "4c.O.8",
    "subgroup": "OLP 4c: Odd",
    "setup": "Fo' S' F' S' F' S Fo F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4c-o-8",
        "image": "cases/fto/1l3t/olp-4c/4c-o-8.webp",
        "imageAlt": "4c.O.8",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' Fo' S' F S F S Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' S' F' S' F' S Fo F"
        }
      ]
    ]
  },
  {
    "position": 96,
    "name": "4c.O.9",
    "subgroup": "OLP 4c: Odd",
    "setup": "Rw U' R' U F' H F Rs'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "4c-o-9",
        "image": "cases/fto/1l3t/olp-4c/4c-o-9.webp",
        "imageAlt": "4c.O.9",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Rs F' H' F U' R U Rw'",
          "source": "LowCubes / Raul Low",
          "setup": "Rw U' R' U F' H F Rs'"
        },
        {
          "alg": "Rw R' F' U' R U R' F U' R U Rw'",
          "source": "LowCubes / Raul Low",
          "setup": "Rw U' R' U F' R U' R' U F R Rw'"
        }
      ]
    ]
  },
  {
    "position": 97,
    "name": "5.E.1",
    "subgroup": "OLP 5: Even",
    "setup": "S' F S' F H' F' H' F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "5-e-1",
        "image": "cases/fto/1l3t/olp-5/5-e-1.webp",
        "imageAlt": "5.E.1",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F H F H F' S F' S",
          "source": "LowCubes / Raul Low",
          "setup": "S' F S' F H' F' H' F'"
        }
      ]
    ]
  },
  {
    "position": 98,
    "name": "5.E.2",
    "subgroup": "OLP 5: Even",
    "setup": "Fo' H' F' S' F' S' Fo F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "5-e-2",
        "image": "cases/fto/1l3t/olp-5/5-e-2.webp",
        "imageAlt": "5.E.2",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Fo' S F S F H Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' H' F' S' F' S' Fo F'"
        }
      ]
    ]
  },
  {
    "position": 99,
    "name": "5.E.3",
    "subgroup": "OLP 5: Even",
    "setup": "S' F H' F H' F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "5-e-3",
        "image": "cases/fto/1l3t/olp-5/5-e-3.webp",
        "imageAlt": "5.E.3",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' H F' H F' S",
          "source": "LowCubes / Raul Low",
          "setup": "S' F H' F H' F"
        }
      ]
    ]
  },
  {
    "position": 100,
    "name": "5.E.4",
    "subgroup": "OLP 5: Even",
    "setup": "Fo S F S F S Fo' F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "5-e-4",
        "image": "cases/fto/1l3t/olp-5/5-e-4.webp",
        "imageAlt": "5.E.4",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' Fo S' F' S' F' S' Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo S F S F S Fo' F"
        }
      ]
    ]
  },
  {
    "position": 101,
    "name": "5.E.5",
    "subgroup": "OLP 5: Even",
    "setup": "Ft2 F' Blw' F' L R L' R' F Blw F Ft2 F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "5-e-5",
        "image": "cases/fto/1l3t/olp-5/5-e-5.webp",
        "imageAlt": "5.E.5",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Ft2 F' Blw' F' R L R' L' F Blw F Ft2",
          "source": "LowCubes / Raul Low",
          "setup": "Ft2 F' Blw' F' L R L' R' F Blw F Ft2 F'"
        }
      ]
    ]
  },
  {
    "position": 102,
    "name": "5.E.6",
    "subgroup": "OLP 5: Even",
    "setup": "Fo' S F' H' F' S' Fo F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "5-e-6",
        "image": "cases/fto/1l3t/olp-5/5-e-6.webp",
        "imageAlt": "5.E.6",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Fo' S F H F S' Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' S F' H' F' S' Fo F'"
        }
      ]
    ]
  },
  {
    "position": 103,
    "name": "5.E.7",
    "subgroup": "OLP 5: Even",
    "setup": "Fo' S' F' S' F' S' Fo F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "5-e-7",
        "image": "cases/fto/1l3t/olp-5/5-e-7.webp",
        "imageAlt": "5.E.7",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Fo' S F S F S Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' S' F' S' F' S' Fo F'"
        }
      ]
    ]
  },
  {
    "position": 104,
    "name": "5.E.8",
    "subgroup": "OLP 5: Even",
    "setup": "R Rw L R L' R Rw' F' S F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "5-e-8",
        "image": "cases/fto/1l3t/olp-5/5-e-8.webp",
        "imageAlt": "5.E.8",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F S' F Rw R' L R' L' Rw' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R Rw L R L' R Rw' F' S F'"
        }
      ]
    ]
  },
  {
    "position": 105,
    "name": "5.E.9",
    "subgroup": "OLP 5: Even",
    "setup": "Ro' F' Blw' F' R L R' L' F Blw F Ro F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "5-e-9",
        "image": "cases/fto/1l3t/olp-5/5-e-9.webp",
        "imageAlt": "5.E.9",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Ro' F' Blw' F' L R L' R' F Blw F Ro",
          "source": "LowCubes / Raul Low",
          "setup": "Ro' F' Blw' F' R L R' L' F Blw F Ro F'"
        }
      ]
    ]
  },
  {
    "position": 106,
    "name": "5.O.1",
    "subgroup": "OLP 5: Odd",
    "setup": "S F' H' F S",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "5-o-1",
        "image": "cases/fto/1l3t/olp-5/5-o-1.webp",
        "imageAlt": "5.O.1",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "S' F' H F S'",
          "source": "LowCubes / Raul Low",
          "setup": "S F' H' F S"
        }
      ]
    ]
  },
  {
    "position": 107,
    "name": "5.O.2",
    "subgroup": "OLP 5: Odd",
    "setup": "Fo' Br' R' F' Rw R' L R L' Rw' F R Br Fo F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "5-o-2",
        "image": "cases/fto/1l3t/olp-5/5-o-2.webp",
        "imageAlt": "5.O.2",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Fo' Br' R' F' Rw L R' L' R Rw' F R Br Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' Br' R' F' Rw R' L R L' Rw' F R Br Fo F'"
        }
      ]
    ]
  },
  {
    "position": 108,
    "name": "5.O.3",
    "subgroup": "OLP 5: Odd",
    "setup": "R' Rw' U' R' U R' Rw F' S'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "5-o-3",
        "image": "cases/fto/1l3t/olp-5/5-o-3.webp",
        "imageAlt": "5.O.3",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "S F Rw' R U' R U Rw R",
          "source": "LowCubes / Raul Low",
          "setup": "R' Rw' U' R' U R' Rw F' S'"
        }
      ]
    ]
  },
  {
    "position": 109,
    "name": "5.O.4",
    "subgroup": "OLP 5: Odd",
    "setup": "U' Blw F L' U L U' F' L Blw' F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "5-o-4",
        "image": "cases/fto/1l3t/olp-5/5-o-4.webp",
        "imageAlt": "5.O.4",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' Blw L' F U L' U' L F' Blw' U",
          "source": "LowCubes / Raul Low",
          "setup": "U' Blw F L' U L U' F' L Blw' F"
        }
      ]
    ]
  },
  {
    "position": 110,
    "name": "5.O.5",
    "subgroup": "OLP 5: Odd",
    "setup": "Fo' U' Blw F S F' Blw' U Fo",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "5-o-5",
        "image": "cases/fto/1l3t/olp-5/5-o-5.webp",
        "imageAlt": "5.O.5",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Fo' U' Blw F S' F' Blw' U Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' U' Blw F S F' Blw' U Fo"
        }
      ]
    ]
  },
  {
    "position": 111,
    "name": "5.O.6",
    "subgroup": "OLP 5: Odd",
    "setup": "Fo S' F' S F S Fo' F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "5-o-6",
        "image": "cases/fto/1l3t/olp-5/5-o-6.webp",
        "imageAlt": "5.O.6",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Fo S' F' S' F S Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo S' F' S F S Fo' F'"
        }
      ]
    ]
  },
  {
    "position": 112,
    "name": "5.O.7",
    "subgroup": "OLP 5: Odd",
    "setup": "L Blw' F S' F' U' Blw",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "5-o-7",
        "image": "cases/fto/1l3t/olp-5/5-o-7.webp",
        "imageAlt": "5.O.7",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Blw' U F S F' Blw L'",
          "source": "LowCubes / Raul Low",
          "setup": "L Blw' F S' F' U' Blw"
        }
      ]
    ]
  },
  {
    "position": 113,
    "name": "5.O.8",
    "subgroup": "OLP 5: Odd",
    "setup": "S' F' S' F S",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "5-o-8",
        "image": "cases/fto/1l3t/olp-5/5-o-8.webp",
        "imageAlt": "5.O.8",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "S' F' S F S",
          "source": "LowCubes / Raul Low",
          "setup": "S' F' S' F S"
        }
      ]
    ]
  },
  {
    "position": 114,
    "name": "5.O.9",
    "subgroup": "OLP 5: Odd",
    "setup": "Fo U' Blw F S' F' Blw' U Fo' F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "5-o-9",
        "image": "cases/fto/1l3t/olp-5/5-o-9.webp",
        "imageAlt": "5.O.9",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' Fo U' Blw F S F' Blw' U Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo U' Blw F S' F' Blw' U Fo' F"
        }
      ]
    ]
  },
  {
    "position": 115,
    "name": "6a.E.1",
    "subgroup": "OLP 6a: Even",
    "setup": "Fo U' R' D' R U R' D R' U' R' U Fo' F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6a-e-1",
        "image": "cases/fto/1l3t/olp-6a/6a-e-1.webp",
        "imageAlt": "6a.E.1",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' Fo U' R U R D' R U' R' D R U Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo U' R' D' R U R' D R' U' R' U Fo' F"
        }
      ]
    ]
  },
  {
    "position": 116,
    "name": "6a.E.2",
    "subgroup": "OLP 6a: Even",
    "setup": "U' R Br R Br' U' Br R' Br' U' R' F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6a-e-2",
        "image": "cases/fto/1l3t/olp-6a/6a-e-2.webp",
        "imageAlt": "6a.E.2",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F R U Br R Br' U Br R' Br' R' U",
          "source": "LowCubes / Raul Low",
          "setup": "U' R Br R Br' U' Br R' Br' U' R' F'"
        }
      ]
    ]
  },
  {
    "position": 117,
    "name": "6a.E.3",
    "subgroup": "OLP 6a: Even",
    "setup": "Fo S' F' S F H' Fo' F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6a-e-3",
        "image": "cases/fto/1l3t/olp-6a/6a-e-3.webp",
        "imageAlt": "6a.E.3",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Fo H F' S' F S Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo S' F' S F H' Fo' F'"
        },
        {
          "alg": "F' Lt2 U' D R U R Rw' U R' U' R' Rw D' Lt2",
          "source": "LowCubes / Raul Low",
          "setup": "Lt2 D Rw' R U R U' Rw R' U' R' D' U Lt2 F"
        }
      ]
    ]
  },
  {
    "position": 118,
    "name": "6a.E.4",
    "subgroup": "OLP 6a: Even",
    "setup": "R U' Br' U R' F R U' Br' R' U",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6a-e-4",
        "image": "cases/fto/1l3t/olp-6a/6a-e-4.webp",
        "imageAlt": "6a.E.4",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "U' R Br U R' F' R U' Br U R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U' Br' U R' F R U' Br' R' U"
        }
      ]
    ]
  },
  {
    "position": 119,
    "name": "6a.E.5",
    "subgroup": "OLP 6a: Even",
    "setup": "Fo' L Bl' F S F' Bl L' Fo F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6a-e-5",
        "image": "cases/fto/1l3t/olp-6a/6a-e-5.webp",
        "imageAlt": "6a.E.5",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Fo' L Bl' F S' F' Bl L' Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' L Bl' F S F' Bl L' Fo F'"
        }
      ]
    ]
  },
  {
    "position": 120,
    "name": "6a.E.6",
    "subgroup": "OLP 6a: Even",
    "setup": "R U' Br U R' U' R Br' U R' F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6a-e-6",
        "image": "cases/fto/1l3t/olp-6a/6a-e-6.webp",
        "imageAlt": "6a.E.6",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' R U' Br R' U R U' Br' U R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U' Br U R' U' R Br' U R' F"
        },
        {
          "alg": "F U' R Br' R' U R U' Br R' U",
          "source": "LowCubes / Raul Low",
          "setup": "U' R Br' U R' U' R Br R' U F'"
        }
      ]
    ]
  },
  {
    "position": 121,
    "name": "6a.E.7",
    "subgroup": "OLP 6a: Even",
    "setup": "Blw' U F' S F Blw L' F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6a-e-7",
        "image": "cases/fto/1l3t/olp-6a/6a-e-7.webp",
        "imageAlt": "6a.E.7",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F L Blw' F' S' F U' Blw",
          "source": "LowCubes / Raul Low",
          "setup": "Blw' U F' S F Blw L' F'"
        },
        {
          "alg": "F' Blw L' F H F' R' Brw",
          "source": "LowCubes / Raul Low",
          "setup": "Brw' R F H' F' L Blw' F"
        }
      ]
    ]
  },
  {
    "position": 122,
    "name": "6a.E.8",
    "subgroup": "OLP 6a: Even",
    "setup": "Rt' F' R Br' Rw' F R F Rw Br' R F Rt F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6a-e-8",
        "image": "cases/fto/1l3t/olp-6a/6a-e-8.webp",
        "imageAlt": "6a.E.8",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' Rt' F' R' Br Rw' F' R' F' Rw Br R' F Rt",
          "source": "LowCubes / Raul Low",
          "setup": "Rt' F' R Br' Rw' F R F Rw Br' R F Rt F"
        }
      ]
    ]
  },
  {
    "position": 123,
    "name": "6a.E.9",
    "subgroup": "OLP 6a: Even",
    "setup": "Fo R' F' R U' Br' R Br U R' Fo' F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6a-e-9",
        "image": "cases/fto/1l3t/olp-6a/6a-e-9.webp",
        "imageAlt": "6a.E.9",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' Fo R U' Br' R' Br U R' F R Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo R' F' R U' Br' R Br U R' Fo' F"
        }
      ]
    ]
  },
  {
    "position": 124,
    "name": "6a.O.1",
    "subgroup": "OLP 6a: Odd",
    "setup": "Fo' R U' Br' U R' U' R Br R' U Fo",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6a-o-1",
        "image": "cases/fto/1l3t/olp-6a/6a-o-1.webp",
        "imageAlt": "6a.O.1",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Fo' U' R Br' R' U R U' Br U R' Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' R U' Br' U R' U' R Br R' U Fo"
        }
      ]
    ]
  },
  {
    "position": 125,
    "name": "6a.O.2",
    "subgroup": "OLP 6a: Odd",
    "setup": "Lt2 U' R' F' R' L' R L F R U Lt2 F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6a-o-2",
        "image": "cases/fto/1l3t/olp-6a/6a-o-2.webp",
        "imageAlt": "6a.O.2",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' Lt2 U' R' F' L' R' L R F R U Lt2",
          "source": "LowCubes / Raul Low",
          "setup": "Lt2 U' R' F' R' L' R L F R U Lt2 F"
        },
        {
          "alg": "F' Rt' F' Rw R' Br F Br' F' Rw' R F Rt",
          "source": "LowCubes / Raul Low",
          "setup": "Rt' F' R' Rw F Br F' Br' R Rw' F Rt F"
        },
        {
          "alg": "F' R U' R' U' Rw' U' R' U' R U' Rw U'",
          "source": "LowCubes / Raul Low",
          "setup": "U Rw' U R' U R U Rw U R U R' F"
        }
      ]
    ]
  },
  {
    "position": 126,
    "name": "6a.O.3",
    "subgroup": "OLP 6a: Odd",
    "setup": "S' F' S' F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6a-o-3",
        "image": "cases/fto/1l3t/olp-6a/6a-o-3.webp",
        "imageAlt": "6a.O.3",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' S F S",
          "source": "LowCubes / Raul Low",
          "setup": "S' F' S' F"
        }
      ]
    ]
  },
  {
    "position": 127,
    "name": "6a.O.4",
    "subgroup": "OLP 6a: Odd",
    "setup": "Fo S' F S' F' S' Fo' F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6a-o-4",
        "image": "cases/fto/1l3t/olp-6a/6a-o-4.webp",
        "imageAlt": "6a.O.4",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' Fo S F S F' S Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo S' F S' F' S' Fo' F"
        },
        {
          "alg": "F' Fo L' U L Rw' U' R' U' R U' Rw U' Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo U Rw' U R' U R U Rw L' U' L Fo' F"
        }
      ]
    ]
  },
  {
    "position": 128,
    "name": "6a.O.5",
    "subgroup": "OLP 6a: Odd",
    "setup": "S F' H' F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6a-o-5",
        "image": "cases/fto/1l3t/olp-6a/6a-o-5.webp",
        "imageAlt": "6a.O.5",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' H F S'",
          "source": "LowCubes / Raul Low",
          "setup": "S F' H' F"
        }
      ]
    ]
  },
  {
    "position": 129,
    "name": "6a.O.6",
    "subgroup": "OLP 6a: Odd",
    "setup": "Fo' R Rw L R L' Rs' Fo F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6a-o-6",
        "image": "cases/fto/1l3t/olp-6a/6a-o-6.webp",
        "imageAlt": "6a.O.6",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' Fo' Rs L R' L' Rw2 R' Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' R Rw L R L' Rs' Fo F"
        }
      ]
    ]
  },
  {
    "position": 130,
    "name": "6a.O.7",
    "subgroup": "OLP 6a: Odd",
    "setup": "H' F' S' F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6a-o-7",
        "image": "cases/fto/1l3t/olp-6a/6a-o-7.webp",
        "imageAlt": "6a.O.7",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' S F H",
          "source": "LowCubes / Raul Low",
          "setup": "H' F' S' F"
        },
        {
          "alg": "F' Fo S' F H' Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo H F' S Fo' F"
        }
      ]
    ]
  },
  {
    "position": 131,
    "name": "6a.O.8",
    "subgroup": "OLP 6a: Odd",
    "setup": "Fo' L Blw' F' S F Blw L' Fo",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6a-o-8",
        "image": "cases/fto/1l3t/olp-6a/6a-o-8.webp",
        "imageAlt": "6a.O.8",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Fo' L Blw' F' S' F Blw L' Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' L Blw' F' S F Blw L' Fo"
        }
      ]
    ]
  },
  {
    "position": 132,
    "name": "6a.O.9",
    "subgroup": "OLP 6a: Odd",
    "setup": "Ro' F R F' L' R' L R F R' F' Ro F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6a-o-9",
        "image": "cases/fto/1l3t/olp-6a/6a-o-9.webp",
        "imageAlt": "6a.O.9",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' Ro' F R F' R' L' R L F R' F' Ro",
          "source": "LowCubes / Raul Low",
          "setup": "Ro' F R F' L' R' L R F R' F' Ro F"
        }
      ]
    ]
  },
  {
    "position": 133,
    "name": "6b.E.1",
    "subgroup": "OLP 6b: Even",
    "setup": "Rt2 U R D R' U' R D' R U R U' Rt2 F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6b-e-1",
        "image": "cases/fto/1l3t/olp-6b/6b-e-1.webp",
        "imageAlt": "6b.E.1",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Rt2 U R' U' R' D R' U R D' R' U' Rt2",
          "source": "LowCubes / Raul Low",
          "setup": "Rt2 U R D R' U' R D' R U R U' Rt2 F'"
        }
      ]
    ]
  },
  {
    "position": 134,
    "name": "6b.E.2",
    "subgroup": "OLP 6b: Even",
    "setup": "S' F S F' H F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6b-e-2",
        "image": "cases/fto/1l3t/olp-6b/6b-e-2.webp",
        "imageAlt": "6b.E.2",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' H' F S' F' S",
          "source": "LowCubes / Raul Low",
          "setup": "S' F S F' H F"
        },
        {
          "alg": "Lo' D' U R' U' R' Rw U' R U R Rw' D Lo",
          "source": "LowCubes / Raul Low",
          "setup": "Lo' D' Rw R' U' R' U Rw' R U R U' D Lo"
        },
        {
          "alg": "Fo' U Rw' U Br' R' U R U' Br U' Rw U' Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' U Rw' U Br' U R' U' R Br U' Rw U' Fo"
        }
      ]
    ]
  },
  {
    "position": 135,
    "name": "6b.E.3",
    "subgroup": "OLP 6b: Even",
    "setup": "Ro' Rw' U R' F L' R' L R F' R U' Rw Ro",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6b-e-3",
        "image": "cases/fto/1l3t/olp-6b/6b-e-3.webp",
        "imageAlt": "6b.E.3",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Ro' Rw' U R' F R' L' R L F' R U' Rw Ro",
          "source": "LowCubes / Raul Low",
          "setup": "Ro' Rw' U R' F L' R' L R F' R U' Rw Ro"
        }
      ]
    ]
  },
  {
    "position": 136,
    "name": "6b.E.4",
    "subgroup": "OLP 6b: Even",
    "setup": "Fo' L Blw' F' S' F U' Blw Fo F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6b-e-4",
        "image": "cases/fto/1l3t/olp-6b/6b-e-4.webp",
        "imageAlt": "6b.E.4",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Fo' Blw' U F' S F Blw L' Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' L Blw' F' S' F U' Blw Fo F'"
        }
      ]
    ]
  },
  {
    "position": 137,
    "name": "6b.E.5",
    "subgroup": "OLP 6b: Even",
    "setup": "Ro' R' L' F' U' R U R' F U' R U Ro U",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6b-e-5",
        "image": "cases/fto/1l3t/olp-6b/6b-e-5.webp",
        "imageAlt": "6b.E.5",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "U' Ro' U' R' U F' R U' R' U F L R Ro",
          "source": "LowCubes / Raul Low",
          "setup": "Ro' R' L' F' U' R U R' F U' R U Ro U"
        }
      ]
    ]
  },
  {
    "position": 138,
    "name": "6b.E.6",
    "subgroup": "OLP 6b: Even",
    "setup": "Lo F' R' L' F S F' L R F Lo' F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6b-e-6",
        "image": "cases/fto/1l3t/olp-6b/6b-e-6.webp",
        "imageAlt": "6b.E.6",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Lo F' R' L' F S' F' L R F Lo'",
          "source": "LowCubes / Raul Low",
          "setup": "Lo F' R' L' F S F' L R F Lo' F'"
        }
      ]
    ]
  },
  {
    "position": 139,
    "name": "6b.E.7",
    "subgroup": "OLP 6b: Even",
    "setup": "Fo U' R Br R' U F' U' R Br U R' Fo'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6b-e-7",
        "image": "cases/fto/1l3t/olp-6b/6b-e-7.webp",
        "imageAlt": "6b.E.7",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Fo R U' Br' R' U F U' R Br' R' U Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo U' R Br R' U F' U' R Br U R' Fo'"
        }
      ]
    ]
  },
  {
    "position": 140,
    "name": "6b.E.8",
    "subgroup": "OLP 6b: Even",
    "setup": "Fo U' R Br' R' U R U' Br R' U Fo' F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6b-e-8",
        "image": "cases/fto/1l3t/olp-6b/6b-e-8.webp",
        "imageAlt": "6b.E.8",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Fo U' R Br' U R' U' R Br R' U Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo U' R Br' R' U R U' Br R' U Fo' F'"
        }
      ]
    ]
  },
  {
    "position": 141,
    "name": "6b.E.9",
    "subgroup": "OLP 6b: Even",
    "setup": "Fo R' Br F' S' F Br' R Fo' F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6b-e-9",
        "image": "cases/fto/1l3t/olp-6b/6b-e-9.webp",
        "imageAlt": "6b.E.9",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' Fo R' Br F' S F Br' R Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo R' Br F' S' F Br' R Fo' F"
        }
      ]
    ]
  },
  {
    "position": 142,
    "name": "6b.O.1",
    "subgroup": "OLP 6b: Odd",
    "setup": "Fo' U' Blw F S F' L Blw' Fo",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6b-o-1",
        "image": "cases/fto/1l3t/olp-6b/6b-o-1.webp",
        "imageAlt": "6b.O.1",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Fo' Blw L' F S' F' Blw' U Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' U' Blw F S F' L Blw' Fo"
        }
      ]
    ]
  },
  {
    "position": 143,
    "name": "6b.O.2",
    "subgroup": "OLP 6b: Odd",
    "setup": "S F S F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6b-o-2",
        "image": "cases/fto/1l3t/olp-6b/6b-o-2.webp",
        "imageAlt": "6b.O.2",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F S' F' S'",
          "source": "LowCubes / Raul Low",
          "setup": "S F S F'"
        }
      ]
    ]
  },
  {
    "position": 144,
    "name": "6b.O.3",
    "subgroup": "OLP 6b: Odd",
    "setup": "Uo L R F R U R' U' F' R' L' Uo' F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6b-o-3",
        "image": "cases/fto/1l3t/olp-6b/6b-o-3.webp",
        "imageAlt": "6b.O.3",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Uo L R F U R U' R' F' R' L' Uo'",
          "source": "LowCubes / Raul Low",
          "setup": "Uo L R F R U R' U' F' R' L' Uo' F'"
        },
        {
          "alg": "F Ro U R' U' R Br' U R D' R U' R' D R' Ro'",
          "source": "LowCubes / Raul Low",
          "setup": "Ro R D' R U R' D R' U' Br R' U R U' Ro' F'"
        }
      ]
    ]
  },
  {
    "position": 145,
    "name": "6b.O.4",
    "subgroup": "OLP 6b: Odd",
    "setup": "Fo S F H Fo'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6b-o-4",
        "image": "cases/fto/1l3t/olp-6b/6b-o-4.webp",
        "imageAlt": "6b.O.4",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Fo H' F' S' Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo S F H Fo'"
        },
        {
          "alg": "Fo' H F' S Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' S' F H' Fo"
        }
      ]
    ]
  },
  {
    "position": 146,
    "name": "6b.O.5",
    "subgroup": "OLP 6b: Odd",
    "setup": "Uo' F' R' F U R U' R' F' R F Uo F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6b-o-5",
        "image": "cases/fto/1l3t/olp-6b/6b-o-5.webp",
        "imageAlt": "6b.O.5",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Uo' F' R' F R U R' U' F' R F Uo",
          "source": "LowCubes / Raul Low",
          "setup": "Uo' F' R' F U R U' R' F' R F Uo F'"
        }
      ]
    ]
  },
  {
    "position": 147,
    "name": "6b.O.6",
    "subgroup": "OLP 6b: Odd",
    "setup": "U' Blw F H F' Blw' U",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6b-o-6",
        "image": "cases/fto/1l3t/olp-6b/6b-o-6.webp",
        "imageAlt": "6b.O.6",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "U' Blw F H' F' Blw' U",
          "source": "LowCubes / Raul Low",
          "setup": "U' Blw F H F' Blw' U"
        }
      ]
    ]
  },
  {
    "position": 148,
    "name": "6b.O.7",
    "subgroup": "OLP 6b: Odd",
    "setup": "Fo' S F' S F S Fo F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6b-o-7",
        "image": "cases/fto/1l3t/olp-6b/6b-o-7.webp",
        "imageAlt": "6b.O.7",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Fo' S' F' S' F S' Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' S F' S F S Fo F'"
        }
      ]
    ]
  },
  {
    "position": 149,
    "name": "6b.O.8",
    "subgroup": "OLP 6b: Odd",
    "setup": "R2 Rw' U' R' U R' Rw F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6b-o-8",
        "image": "cases/fto/1l3t/olp-6b/6b-o-8.webp",
        "imageAlt": "6b.O.8",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Rw' R U' R U Rw R2'",
          "source": "LowCubes / Raul Low",
          "setup": "R2 Rw' U' R' U R' Rw F'"
        }
      ]
    ]
  },
  {
    "position": 150,
    "name": "6b.O.9",
    "subgroup": "OLP 6b: Odd",
    "setup": "Fo' H F S' Fo F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6b-o-9",
        "image": "cases/fto/1l3t/olp-6b/6b-o-9.webp",
        "imageAlt": "6b.O.9",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Fo' S F' H' Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' H F S' Fo F'"
        }
      ]
    ]
  },
  {
    "position": 151,
    "name": "6c.E.1",
    "subgroup": "OLP 6c: Even",
    "setup": "S' H'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6c-e-1",
        "image": "cases/fto/1l3t/olp-6c/6c-e-1.webp",
        "imageAlt": "6c.E.1",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "H S",
          "source": "LowCubes / Raul Low",
          "setup": "S' H'"
        }
      ]
    ]
  },
  {
    "position": 152,
    "name": "6c.E.2",
    "subgroup": "OLP 6c: Even",
    "setup": "Rt2 U' R Rw' U' R' U R' Rw U R Rt2",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6c-e-2",
        "image": "cases/fto/1l3t/olp-6c/6c-e-2.webp",
        "imageAlt": "6c.E.2",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Rt2 R' U' Rw' R U' R U Rw R' U Rt2",
          "source": "LowCubes / Raul Low",
          "setup": "Rt2 U' R Rw' U' R' U R' Rw U R Rt2"
        }
      ]
    ]
  },
  {
    "position": 153,
    "name": "6c.E.3",
    "subgroup": "OLP 6c: Even",
    "setup": "Fo U R' Rw U R U' R Rw' U' R' Fo'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6c-e-3",
        "image": "cases/fto/1l3t/olp-6c/6c-e-3.webp",
        "imageAlt": "6c.E.3",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Fo R U Rw R' U R' U' Rw' R U' Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo U R' Rw U R U' R Rw' U' R' Fo'"
        }
      ]
    ]
  },
  {
    "position": 154,
    "name": "6c.E.4",
    "subgroup": "OLP 6c: Even",
    "setup": "R' D R' U' R D' R U",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6c-e-4",
        "image": "cases/fto/1l3t/olp-6c/6c-e-4.webp",
        "imageAlt": "6c.E.4",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "U' R' D R' U R D' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' D R' U' R D' R U"
        }
      ]
    ]
  },
  {
    "position": 155,
    "name": "6c.E.5",
    "subgroup": "OLP 6c: Even",
    "setup": "H",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6c-e-5",
        "image": "cases/fto/1l3t/olp-6c/6c-e-5.webp",
        "imageAlt": "6c.E.5",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "H'",
          "source": "LowCubes / Raul Low",
          "setup": "H"
        }
      ]
    ]
  },
  {
    "position": 156,
    "name": "6c.E.6",
    "subgroup": "OLP 6c: Even",
    "setup": "R U' R D R' U R D' R' U' R' U",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6c-e-6",
        "image": "cases/fto/1l3t/olp-6c/6c-e-6.webp",
        "imageAlt": "6c.E.6",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "U' R U R D R' U' R D' R' U R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U' R D R' U R D' R' U' R' U"
        }
      ]
    ]
  },
  {
    "position": 157,
    "name": "6c.E.7",
    "subgroup": "OLP 6c: Even",
    "setup": "Uo' R D' R U R' D R' U' Uo",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6c-e-7",
        "image": "cases/fto/1l3t/olp-6c/6c-e-7.webp",
        "imageAlt": "6c.E.7",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Uo' U R D' R U' R' D R' Uo",
          "source": "LowCubes / Raul Low",
          "setup": "Uo' R D' R U R' D R' U' Uo"
        }
      ]
    ]
  },
  {
    "position": 158,
    "name": "6c.E.8",
    "subgroup": "OLP 6c: Even",
    "setup": "Uo' R' U R' D' R U' R' D R U R U' Uo",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6c-e-8",
        "image": "cases/fto/1l3t/olp-6c/6c-e-8.webp",
        "imageAlt": "6c.E.8",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Uo' U R' U' R' D' R U R' D R U' R Uo",
          "source": "LowCubes / Raul Low",
          "setup": "Uo' R' U R' D' R U' R' D R U R U' Uo"
        }
      ]
    ]
  },
  {
    "position": 159,
    "name": "6c.E.9",
    "subgroup": "OLP 6c: Even",
    "setup": "Fo' S Fo",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6c-e-9",
        "image": "cases/fto/1l3t/olp-6c/6c-e-9.webp",
        "imageAlt": "6c.E.9",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Fo' S' Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' S Fo"
        }
      ]
    ]
  },
  {
    "position": 160,
    "name": "6c.O.1",
    "subgroup": "OLP 6c: Odd",
    "setup": "Uo R' U R D' R U R' D R' U R Uo'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6c-o-1",
        "image": "cases/fto/1l3t/olp-6c/6c-o-1.webp",
        "imageAlt": "6c.O.1",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Uo R' U' R D' R U' R' D R' U' R Uo'",
          "source": "LowCubes / Raul Low",
          "setup": "Uo R' U R D' R U R' D R' U R Uo'"
        }
      ]
    ]
  },
  {
    "position": 161,
    "name": "6c.O.2",
    "subgroup": "OLP 6c: Odd",
    "setup": "Rt2 R' U R2 Rw' U' R' U Rw U' Rt2",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6c-o-2",
        "image": "cases/fto/1l3t/olp-6c/6c-o-2.webp",
        "imageAlt": "6c.O.2",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Rt2 U Rw' U' R U Rw R2' U' R Rt2",
          "source": "LowCubes / Raul Low",
          "setup": "Rt2 R' U R2 Rw' U' R' U Rw U' Rt2"
        }
      ]
    ]
  },
  {
    "position": 162,
    "name": "6c.O.3",
    "subgroup": "OLP 6c: Odd",
    "setup": "Fo R U' R Rw U R U' Rw' U Fo'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6c-o-3",
        "image": "cases/fto/1l3t/olp-6c/6c-o-3.webp",
        "imageAlt": "6c.O.3",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Fo U' Rw U R' U' Rw' R' U R' Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo R U' R Rw U R U' Rw' U Fo'"
        }
      ]
    ]
  },
  {
    "position": 163,
    "name": "6c.O.4",
    "subgroup": "OLP 6c: Odd",
    "setup": "Uo' R' U R' D R' U' R D' R' Uo F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6c-o-4",
        "image": "cases/fto/1l3t/olp-6c/6c-o-4.webp",
        "imageAlt": "6c.O.4",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Uo' R D R' U R D' R U' R Uo",
          "source": "LowCubes / Raul Low",
          "setup": "Uo' R' U R' D R' U' R D' R' Uo F'"
        }
      ]
    ]
  },
  {
    "position": 164,
    "name": "6c.O.5",
    "subgroup": "OLP 6c: Odd",
    "setup": "Uo' R D' R U R' D' R' U' R D' R' Uo F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6c-o-5",
        "image": "cases/fto/1l3t/olp-6c/6c-o-5.webp",
        "imageAlt": "6c.O.5",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F Uo' R D R' U R D R U' R' D R2 Uo",
          "source": "LowCubes / Raul Low",
          "setup": "Uo' R D' R U R' D' R' U' R D' R' Uo F'"
        }
      ]
    ]
  },
  {
    "position": 165,
    "name": "6c.O.6",
    "subgroup": "OLP 6c: Odd",
    "setup": "L Blw' F' S' F Blw L' F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6c-o-6",
        "image": "cases/fto/1l3t/olp-6c/6c-o-6.webp",
        "imageAlt": "6c.O.6",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F L Blw' F' S F Blw L'",
          "source": "LowCubes / Raul Low",
          "setup": "L Blw' F' S' F Blw L' F'"
        },
        {
          "alg": "F R F R' L R L' F' R U' R U",
          "source": "LowCubes / Raul Low",
          "setup": "U' R' U R' F L R' L' R F' R' F'"
        },
        {
          "alg": "Fo U' D R' U R D' Ro R' U R U' Ro' Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo Ro U R' U' R Ro' D R' U' R D' U Fo'"
        }
      ]
    ]
  },
  {
    "position": 166,
    "name": "6c.O.7",
    "subgroup": "OLP 6c: Odd",
    "setup": "R U' R D' R U R' D R F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6c-o-7",
        "image": "cases/fto/1l3t/olp-6c/6c-o-7.webp",
        "imageAlt": "6c.O.7",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' R' D' R U' R' D R2 U R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U' R D' R U R' D R F"
        }
      ]
    ]
  },
  {
    "position": 167,
    "name": "6c.O.8",
    "subgroup": "OLP 6c: Odd",
    "setup": "Fo' L Blw' F S F' Blw L' Fo F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6c-o-8",
        "image": "cases/fto/1l3t/olp-6c/6c-o-8.webp",
        "imageAlt": "6c.O.8",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' Fo' L Blw' F S' F' Blw L' Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' L Blw' F S F' Blw L' Fo F"
        },
        {
          "alg": "F' Fo' R' F' R U' R' U F R' L R' L' Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' L R L' R F' U' R U R' F R Fo F"
        },
        {
          "alg": "Rt2 U D' R U' R' D Ro' R U' R' U",
          "source": "LowCubes / Raul Low",
          "setup": "U' R U R' Ro D' R U R' D U' Rt2"
        }
      ]
    ]
  },
  {
    "position": 168,
    "name": "6c.O.9",
    "subgroup": "OLP 6c: Odd",
    "setup": "R' D R' U' R D R U R' D R F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "6c-o-9",
        "image": "cases/fto/1l3t/olp-6c/6c-o-9.webp",
        "imageAlt": "6c.O.9",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' R' D' R U' R' D' R' U R D' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' D R' U' R D R U R' D R F"
        }
      ]
    ]
  },
  {
    "position": 169,
    "name": "7.E.1",
    "subgroup": "OLP 7: Even",
    "setup": "H' F S F' S' F' S'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "7-e-1",
        "image": "cases/fto/1l3t/olp-7/7-e-1.webp",
        "imageAlt": "7.E.1",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "S F S F S' F' H",
          "source": "LowCubes / Raul Low",
          "setup": "H' F S F' S' F' S'"
        }
      ]
    ]
  },
  {
    "position": 170,
    "name": "7.E.2",
    "subgroup": "OLP 7: Even",
    "setup": "S F' S' F S F S F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "7-e-2",
        "image": "cases/fto/1l3t/olp-7/7-e-2.webp",
        "imageAlt": "7.E.2",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' S' F' S' F' S F S'",
          "source": "LowCubes / Raul Low",
          "setup": "S F' S' F S F S F"
        }
      ]
    ]
  },
  {
    "position": 171,
    "name": "7.E.3",
    "subgroup": "OLP 7: Even",
    "setup": "S' F S F' S' F' S' F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "7-e-3",
        "image": "cases/fto/1l3t/olp-7/7-e-3.webp",
        "imageAlt": "7.E.3",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F S F S F S' F' S",
          "source": "LowCubes / Raul Low",
          "setup": "S' F S F' S' F' S' F'"
        }
      ]
    ]
  },
  {
    "position": 172,
    "name": "7.O.1",
    "subgroup": "OLP 7: Odd",
    "setup": "S F S F S' F' H",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "7-o-1",
        "image": "cases/fto/1l3t/olp-7/7-o-1.webp",
        "imageAlt": "7.O.1",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "H' F S F' S' F' S'",
          "source": "LowCubes / Raul Low",
          "setup": "S F S F S' F' H"
        }
      ]
    ]
  },
  {
    "position": 173,
    "name": "7.O.2",
    "subgroup": "OLP 7: Odd",
    "setup": "S F S F S' F' S F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "7-o-2",
        "image": "cases/fto/1l3t/olp-7/7-o-2.webp",
        "imageAlt": "7.O.2",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' S' F S F' S' F' S'",
          "source": "LowCubes / Raul Low",
          "setup": "S F S F S' F' S F"
        }
      ]
    ]
  },
  {
    "position": 174,
    "name": "7.O.3",
    "subgroup": "OLP 7: Odd",
    "setup": "S' F' S' F' S F S' F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "7-o-3",
        "image": "cases/fto/1l3t/olp-7/7-o-3.webp",
        "imageAlt": "7.O.3",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F S F' S' F S F S",
          "source": "LowCubes / Raul Low",
          "setup": "S' F' S' F' S F S' F'"
        }
      ]
    ]
  },
  {
    "position": 175,
    "name": "8.E.1",
    "subgroup": "OLP 8: Even",
    "setup": "H' F' H' F' S F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "8-e-1",
        "image": "cases/fto/1l3t/olp-8/8-e-1.webp",
        "imageAlt": "8.E.1",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' S' F H F H",
          "source": "LowCubes / Raul Low",
          "setup": "H' F' H' F' S F"
        }
      ]
    ]
  },
  {
    "position": 176,
    "name": "8.E.2",
    "subgroup": "OLP 8: Even",
    "setup": "Fo' S' F S' F S Fo",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "8-e-2",
        "image": "cases/fto/1l3t/olp-8/8-e-2.webp",
        "imageAlt": "8.E.2",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Fo' S' F' S F' S Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' S' F S' F S Fo"
        }
      ]
    ]
  },
  {
    "position": 177,
    "name": "8.E.3",
    "subgroup": "OLP 8: Even",
    "setup": "Fo S F' S F' S' Fo'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "8-e-3",
        "image": "cases/fto/1l3t/olp-8/8-e-3.webp",
        "imageAlt": "8.E.3",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Fo S F S' F S' Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo S F' S F' S' Fo'"
        }
      ]
    ]
  },
  {
    "position": 178,
    "name": "8.O.1",
    "subgroup": "OLP 8: Odd",
    "setup": "Fo' H' F' S F' S Fo F",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "8-o-1",
        "image": "cases/fto/1l3t/olp-8/8-o-1.webp",
        "imageAlt": "8.O.1",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "F' Fo' S' F S' F H Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' H' F' S F' S Fo F"
        }
      ]
    ]
  },
  {
    "position": 179,
    "name": "8.O.2",
    "subgroup": "OLP 8: Odd",
    "setup": "Fo' S F S' F S' Fo",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "8-o-2",
        "image": "cases/fto/1l3t/olp-8/8-o-2.webp",
        "imageAlt": "8.O.2",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Fo' S F' S F' S' Fo",
          "source": "LowCubes / Raul Low",
          "setup": "Fo' S F S' F S' Fo"
        }
      ]
    ]
  },
  {
    "position": 180,
    "name": "8.O.3",
    "subgroup": "OLP 8: Odd",
    "setup": "Fo S' F' S F' S Fo'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-fto",
      "attrs": {
        "slug": "8-o-3",
        "image": "cases/fto/1l3t/olp-8/8-o-3.webp",
        "imageAlt": "8.O.3",
        "imageWidth": "512",
        "imageHeight": "552"
      }
    },
    "algs": [
      [
        {
          "alg": "Fo S' F S' F S Fo'",
          "source": "LowCubes / Raul Low",
          "setup": "Fo S' F' S F' S Fo'"
        }
      ]
    ]
  }
]$lowcubes_fto_1l3t$::jsonb AS body
)
INSERT INTO alg_cases (puzzle, set_slug, position, name, subgroup, setup, sticker, algs)
SELECT
  'fto',
  '1l3t',
  (item ->> 'position')::integer,
  item ->> 'name',
  item ->> 'subgroup',
  item ->> 'setup',
  item -> 'sticker',
  item -> 'algs'
FROM payload
CROSS JOIN LATERAL jsonb_array_elements(payload.body) AS entry(item)
WHERE NOT EXISTS (
  SELECT 1
  FROM alg_cases existing
  WHERE existing.puzzle = 'fto'
    AND existing.set_slug = '1l3t'
    AND existing.name = item ->> 'name'
);

WITH payload AS (
  SELECT $lowcubes_megaminx_full_pll$[
  {
    "position": 1,
    "name": "A1+",
    "subgroup": "A - 3 corner CP",
    "setup": "R3' D' R U2 R' D R U2' R L",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "a1p",
        "image": "cases/megaminx/full-pll/a1p.webp",
        "imageAlt": "A1+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "CPLL"
      }
    },
    "algs": [
      [
        {
          "alg": "L- R' U2 R' D' R U2' R' D R3",
          "source": "LowCubes / Raul Low",
          "setup": "R3' D' R U2 R' D R U2' R L"
        },
        {
          "alg": "F' R' F R U' R' F' R2 U R' U' R' F R",
          "source": "LowCubes / Raul Low",
          "setup": "R' F' R U R U' R2' F R U R' F' R F"
        }
      ]
    ]
  },
  {
    "position": 2,
    "name": "A1-",
    "subgroup": "A - 3 corner CP",
    "setup": "R2' U2 R' D' R U2' R' D R2 L",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "a1m",
        "image": "cases/megaminx/full-pll/a1m.webp",
        "imageAlt": "A1-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "CPLL"
      }
    },
    "algs": [
      [
        {
          "alg": "L- R2' D' R U2 R' D R U2' R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U2 R' D' R U2' R' D R2 L"
        },
        {
          "alg": "R' F' R U R U' R2' F R U R' F' R F",
          "source": "LowCubes / Raul Low",
          "setup": "F' R' F R U' R' F' R2 U R' U' R' F R"
        }
      ]
    ]
  },
  {
    "position": 3,
    "name": "A2+",
    "subgroup": "A - 3 corner CP",
    "setup": "R' U2 R' F' R U R U' R' F R U R' U2 R",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "a2p",
        "image": "cases/megaminx/full-pll/a2p.webp",
        "imageAlt": "A2+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "CPLL"
      }
    },
    "algs": [
      [
        {
          "alg": "R' U2' R U' R' F' R U R' U' R' F R U2' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2 R' F' R U R U' R' F R U R' U2 R"
        },
        {
          "alg": "BR' R' U L U' R' U L' U' R2 BR",
          "source": "LowCubes / Raul Low",
          "setup": "BR' R2' U L U' R U L' U' R BR"
        }
      ]
    ]
  },
  {
    "position": 4,
    "name": "A2-",
    "subgroup": "A - 3 corner CP",
    "setup": "R' U2' R U' R' F' R U R' U' R' F R U2' R",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "a2m",
        "image": "cases/megaminx/full-pll/a2m.webp",
        "imageAlt": "A2-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "CPLL"
      }
    },
    "algs": [
      [
        {
          "alg": "R' U2 R' F' R U R U' R' F R U R' U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' R U' R' F' R U R' U' R' F R U2' R"
        },
        {
          "alg": "BR' R2' U L U' R U L' U' R BR",
          "source": "LowCubes / Raul Low",
          "setup": "BR' R' U L U' R' U L' U' R2 BR"
        }
      ]
    ]
  },
  {
    "position": 5,
    "name": "E1",
    "subgroup": "E - 4 corner CP",
    "setup": "U R' U' R2 U R2' F' R U R U' R' F R' U R U' R U' R'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "e1",
        "image": "cases/megaminx/full-pll/e1.webp",
        "imageAlt": "E1",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "CPLL"
      }
    },
    "algs": [
      [
        {
          "alg": "R U R' U R' U' R F' R U R' U' R' F R2 U' R2' U R U'",
          "source": "LowCubes / Raul Low",
          "setup": "U R' U' R2 U R2' F' R U R U' R' F R' U R U' R U' R'"
        },
        {
          "alg": "R U R' U R' U' R F' R U R' U' R' F R2 U' R2' U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R2 U R2' F' R U R U' R' F R' U R U' R U' R'"
        },
        {
          "alg": "y2 R' U' R' DR' R U' R' DR R U R' DR' R U R' DR R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' DR' R U' R' DR R U' R' DR' R U R' DR R U R y2'"
        }
      ]
    ]
  },
  {
    "position": 6,
    "name": "E2",
    "subgroup": "E - 4 corner CP",
    "setup": "R2 U R' y R U' R' (U R U' R')x2 y' U R U' R2'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "e2",
        "image": "cases/megaminx/full-pll/e2.webp",
        "imageAlt": "E2",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "CPLL"
      }
    },
    "algs": [
      [
        {
          "alg": "R2 U R' U' y (R U R' U')x2 R U R' y' R U' R2'",
          "source": "LowCubes / Raul Low",
          "setup": "R2 U R' y R U' R' (U R U' R')x2 y' U R U' R2'"
        },
        {
          "alg": "x' R U' R' DR R U R' DR' R U R' DR R U' R' DR'",
          "source": "LowCubes / Raul Low",
          "setup": "DR R U R' DR' R U' R' DR R U' R' DR' R U R' x"
        },
        {
          "alg": "y' R2 U R' U' y R U R' U' R U R' U' R U R' F U' F2'",
          "source": "LowCubes / Raul Low",
          "setup": "F2 U F' R U' R' U R U' R' U R U' R' y' U R U' R2' y"
        },
        {
          "alg": "y' BR' R' U2 R U' R' U R' U2' R U R' U R U' R U' BR",
          "source": "LowCubes / Raul Low",
          "setup": "BR' U R' U R' U' R U' R' U2 R U' R U R' U2' R BR y"
        }
      ]
    ]
  },
  {
    "position": 7,
    "name": "E3",
    "subgroup": "E - 4 corner CP",
    "setup": "L' R U R' U R U' R' U R U' R' U R U2' R' L",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "e3",
        "image": "cases/megaminx/full-pll/e3.webp",
        "imageAlt": "E3",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "CPLL"
      }
    },
    "algs": [
      [
        {
          "alg": "L' R U2 R' U' R U R' U' R U R' U' R U' R' L",
          "source": "LowCubes / Raul Low",
          "setup": "L' R U R' U R U' R' U R U' R' U R U2' R' L"
        }
      ]
    ]
  },
  {
    "position": 8,
    "name": "K1+",
    "subgroup": "K - 5 corner CP",
    "setup": "R2' U2' R2 U' R2' U R2 U' R2' U R2 U' R2' U2' R2",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "k1p",
        "image": "cases/megaminx/full-pll/k1p.webp",
        "imageAlt": "K1+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "CPLL"
      }
    },
    "algs": [
      [
        {
          "alg": "R2' U2 R2 U R2' U' R2 U R2' U' R2 U R2' U2 R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U2' R2 U' R2' U R2 U' R2' U R2 U' R2' U2' R2"
        }
      ]
    ]
  },
  {
    "position": 9,
    "name": "K1-",
    "subgroup": "K - 5 corner CP",
    "setup": "R2 U2 R2' U R2 U' R2' U R2 U' R2' U R2 U2 R2'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "k1m",
        "image": "cases/megaminx/full-pll/k1m.webp",
        "imageAlt": "K1-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "CPLL"
      }
    },
    "algs": [
      [
        {
          "alg": "R2 U2' R2' U' R2 U R2' U' R2 U R2' U' R2 U2' R2'",
          "source": "LowCubes / Raul Low",
          "setup": "R2 U2 R2' U R2 U' R2' U R2 U' R2' U R2 U2 R2'"
        }
      ]
    ]
  },
  {
    "position": 10,
    "name": "K2+",
    "subgroup": "K - 5 corner CP",
    "setup": "R U2' R' U R U2' R' U2 R U R' U2 R U' R' U2 R U' R'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "k2p",
        "image": "cases/megaminx/full-pll/k2p.webp",
        "imageAlt": "K2+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "CPLL"
      }
    },
    "algs": [
      [
        {
          "alg": "R U R' U2' R U R' U2' R U' R' U2' R U2 R' U' R U2 R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2' R' U R U2' R' U2 R U R' U2 R U' R' U2 R U' R'"
        },
        {
          "alg": "R' U2 R U' R' U2 R U2' R' U' R U2' R' U R U2' R' U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R U2 R' U' R U2 R' U R U2 R' U2' R U R' U2' R"
        }
      ]
    ]
  },
  {
    "position": 11,
    "name": "K2-",
    "subgroup": "K - 5 corner CP",
    "setup": "F R U' R' U R U R2' F' R U R U' R U2 R2' U R2 U2 R2'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "k2m",
        "image": "cases/megaminx/full-pll/k2m.webp",
        "imageAlt": "K2-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "CPLL"
      }
    },
    "algs": [
      [
        {
          "alg": "R2 U2' R2' U' R2 U2' R' U R' U' R' F R2 U' R' U' R U R' F'",
          "source": "LowCubes / Raul Low",
          "setup": "F R U' R' U R U R2' F' R U R U' R U2 R2' U R2 U2 R2'"
        },
        {
          "alg": "R U2' R' U R U2' R' U2 R U R' U2 R U' R' U2 R U' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U R' U2' R U R' U2' R U' R' U2' R U2 R' U' R U2 R'"
        },
        {
          "alg": "y R' U' R U2 R' U' R U2 R' U R U2 R' U2' R U R' U2' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2 R U' R' U2 R U2' R' U' R U2' R' U R U2' R' U R y'"
        }
      ]
    ]
  },
  {
    "position": 12,
    "name": "H1+",
    "subgroup": "H - 5 piece EP/CP",
    "setup": "bR' R' U2' R U R' U R y R F R U R' U R U2' R' F' U",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "h1p",
        "image": "cases/megaminx/full-pll/h1p.webp",
        "imageAlt": "H1+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "CPLL"
      }
    },
    "algs": [
      [
        {
          "alg": "U' F R U2 R' U' R U' R' F' R' y' R' U' R U' R' U2 R bR",
          "source": "LowCubes / Raul Low",
          "setup": "bR' R' U2' R U R' U R y R F R U R' U R U2' R' F' U"
        },
        {
          "alg": "(R' DR' R U R' DR R U)x3",
          "source": "LowCubes / Raul Low",
          "setup": "(U' R' DR' R U' R' DR R)x3"
        },
        {
          "alg": "R U2 R' U2 R U' R' U' R U2 R' U R' F' R U R U' R' F",
          "source": "LowCubes / Raul Low",
          "setup": "F' R U R' U' R' F R U' R U2' R' U R U R' U2' R U2' R'"
        }
      ]
    ]
  },
  {
    "position": 13,
    "name": "H1-",
    "subgroup": "H - 5 piece EP/CP",
    "setup": "(R' U' R U' R U R2' U R U' R U' R' U')x2",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "h1m",
        "image": "cases/megaminx/full-pll/h1m.webp",
        "imageAlt": "H1-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "CPLL"
      }
    },
    "algs": [
      [
        {
          "alg": "(U R U R' U R' U' R2 U' R' U R' U R)x2",
          "source": "LowCubes / Raul Low",
          "setup": "(R' U' R U' R U R2' U R U' R U' R' U')x2"
        },
        {
          "alg": "(R' DR' R U' R' DR R U')x3",
          "source": "LowCubes / Raul Low",
          "setup": "(U R' DR' R U R' DR R)x3"
        },
        {
          "alg": "F' R U R' U' R' F R U' R U2' R' U R U R' U2' R U2' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2 R' U2 R U' R' U' R U2 R' U R' F' R U R U' R' F"
        }
      ]
    ]
  },
  {
    "position": 14,
    "name": "H2+",
    "subgroup": "H - 5 piece EP/CP",
    "setup": "U R2' U2' R2 U R2' U R2 y R2 U R2' U R2 U2' R2'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "h2p",
        "image": "cases/megaminx/full-pll/h2p.webp",
        "imageAlt": "H2+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "CPLL"
      }
    },
    "algs": [
      [
        {
          "alg": "R2 U2 R2' U' R2 U' R2' y' R2' U' R2 U' R2' U2 R2 U'",
          "source": "LowCubes / Raul Low",
          "setup": "U R2' U2' R2 U R2' U R2 y R2 U R2' U R2 U2' R2'"
        },
        {
          "alg": "R2 U2 R2' U' R2 U' R2' y' R2' U' R2 U' R2' U2 R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U2' R2 U R2' U R2 y R2 U R2' U R2 U2' R2'"
        }
      ]
    ]
  },
  {
    "position": 15,
    "name": "H2-",
    "subgroup": "H - 5 piece EP/CP",
    "setup": "U' R2 U2 R2' U' R2 U' R2' y' R2' U' R2 U' R2' U2 R2",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "h2m",
        "image": "cases/megaminx/full-pll/h2m.webp",
        "imageAlt": "H2-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "CPLL"
      }
    },
    "algs": [
      [
        {
          "alg": "R2' U2' R2 U R2' U R2 y R2 U R2' U R2 U2' R2' U",
          "source": "LowCubes / Raul Low",
          "setup": "U' R2 U2 R2' U' R2 U' R2' y' R2' U' R2 U' R2' U2 R2"
        },
        {
          "alg": "R2' U2' R2 U R2' U R2 y R2 U R2' U R2 U2' R2'",
          "source": "LowCubes / Raul Low",
          "setup": "R2 U2 R2' U' R2 U' R2' y' R2' U' R2 U' R2' U2 R2"
        }
      ]
    ]
  },
  {
    "position": 16,
    "name": "U1+",
    "subgroup": "U - 3 edge EP",
    "setup": "U2' R U R' U R' U' R2 U' R' U R' U R",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "u1p",
        "image": "cases/megaminx/full-pll/u1p.webp",
        "imageAlt": "U1+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "EPLL"
      }
    },
    "algs": [
      [
        {
          "alg": "R' U' R U' R U R2' U R U' R U' R' U2",
          "source": "LowCubes / Raul Low",
          "setup": "U2' R U R' U R' U' R2 U' R' U R' U R"
        },
        {
          "alg": "R' U' R U' R U R2' U R U' R U' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U R' U R' U' R2 U' R' U R' U R"
        }
      ]
    ]
  },
  {
    "position": 17,
    "name": "U1-",
    "subgroup": "U - 3 edge EP",
    "setup": "R' U' R U' R U R2' U R U' R U' R' U2",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "u1m",
        "image": "cases/megaminx/full-pll/u1m.webp",
        "imageAlt": "U1-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "EPLL"
      }
    },
    "algs": [
      [
        {
          "alg": "U2' R U R' U R' U' R2 U' R' U R' U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R U' R U R2' U R U' R U' R' U2"
        },
        {
          "alg": "R U R' U R' U' R2 U' R' U R' U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R U' R U R2' U R U' R U' R'"
        }
      ]
    ]
  },
  {
    "position": 18,
    "name": "U2+",
    "subgroup": "U - 3 edge EP",
    "setup": "R' U' R U2' R U R' U R' U' R2 U' R' U R' U2 R",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "u2p",
        "image": "cases/megaminx/full-pll/u2p.webp",
        "imageAlt": "U2+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "EPLL"
      }
    },
    "algs": [
      [
        {
          "alg": "R' U2' R U' R U R2' U R U' R U' R' U2 R' U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R U2' R U R' U R' U' R2 U' R' U R' U2 R"
        },
        {
          "alg": "R U R' U2 R' U' R U' R U R2' U R U' R U2' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2 R' U R' U' R2 U' R' U R' U R U2' R U' R'"
        }
      ]
    ]
  },
  {
    "position": 19,
    "name": "U2-",
    "subgroup": "U - 3 edge EP",
    "setup": "R U R' U2 R' U' R U' R U R2' U R U' R U2' R'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "u2m",
        "image": "cases/megaminx/full-pll/u2m.webp",
        "imageAlt": "U2-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "EPLL"
      }
    },
    "algs": [
      [
        {
          "alg": "R U2 R' U R' U' R2 U' R' U R' U R U2' R U' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U R' U2 R' U' R U' R U R2' U R U' R U2' R'"
        },
        {
          "alg": "R' U' R U2' R U R' U R' U' R2 U' R' U R' U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' R U' R U R2' U R U' R U' R' U2 R' U R"
        }
      ]
    ]
  },
  {
    "position": 20,
    "name": "Z1",
    "subgroup": "Z - 4 edge EP",
    "setup": "U2' F R U' R' U R U R' y' U2 R' F R' F' R2 U2' R'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "z1",
        "image": "cases/megaminx/full-pll/z1.webp",
        "imageAlt": "Z1",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "EPLL"
      }
    },
    "algs": [
      [
        {
          "alg": "R U2 R2' F R F' R U2' y R U' R' U' R U R' F' U2",
          "source": "LowCubes / Raul Low",
          "setup": "U2' F R U' R' U R U R' y' U2 R' F R' F' R2 U2' R'"
        },
        {
          "alg": "R' U' F R U' R' U' R U2 R' F' R F U' F' R' U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' R F U F' R' F R U2' R' U R U R' F' U R"
        },
        {
          "alg": "R' U' R' U' R F R' F' U R F' U' F U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' F' U F R' U' F R F' R' U R U R"
        }
      ]
    ]
  },
  {
    "position": 21,
    "name": "Z2",
    "subgroup": "Z - 4 edge EP",
    "setup": "L U' R U2 R' L' y' R' U' L' U2' R L F U2 F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "z2",
        "image": "cases/megaminx/full-pll/z2.webp",
        "imageAlt": "Z2",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "EPLL"
      }
    },
    "algs": [
      [
        {
          "alg": "F U2' F' L' R' U2 L U R y L R U2' R' U L'",
          "source": "LowCubes / Raul Low",
          "setup": "L U' R U2 R' L' y' R' U' L' U2' R L F U2 F'"
        },
        {
          "alg": "R' U2' R' U' R F R' F' U R F' U' F U2' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2 F' U F R' U' F R F' R' U R U2 R"
        }
      ]
    ]
  },
  {
    "position": 22,
    "name": "Z3",
    "subgroup": "Z - 4 edge EP",
    "setup": "L U R U2 R' L' y' R' U' L' U2' R L",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "z3",
        "image": "cases/megaminx/full-pll/z3.webp",
        "imageAlt": "Z3",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "EPLL"
      }
    },
    "algs": [
      [
        {
          "alg": "L' R' U2 L U R y L R U2' R' U' L'",
          "source": "LowCubes / Raul Low",
          "setup": "L U R U2 R' L' y' R' U' L' U2' R L"
        },
        {
          "alg": "R' L' U2 L U R BR F U2' BR' U' F'",
          "source": "LowCubes / Raul Low",
          "setup": "F U BR U2 F' BR' R' U' L' U2' L R"
        }
      ]
    ]
  },
  {
    "position": 23,
    "name": "Q1+",
    "subgroup": "Q - 5 edge EP",
    "setup": "U R2' U2' R2 U' R2' U2' R2 U R2' U2' R2 U' R2' U2' R2",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "q1p",
        "image": "cases/megaminx/full-pll/q1p.webp",
        "imageAlt": "Q1+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "EPLL"
      }
    },
    "algs": [
      [
        {
          "alg": "R2' U2 R2 U R2' U2 R2 U' R2' U2 R2 U R2' U2 R2 U'",
          "source": "LowCubes / Raul Low",
          "setup": "U R2' U2' R2 U' R2' U2' R2 U R2' U2' R2 U' R2' U2' R2"
        },
        {
          "alg": "R2' U2 R2 U R2' U2 R2 U' R2' U2 R2 U R2' U2 R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U2' R2 U' R2' U2' R2 U R2' U2' R2 U' R2' U2' R2"
        },
        {
          "alg": "R' U R U R' U2' R y U2' R U' R' U' R U2 R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2' R' U R U R' U2 y' R' U2 R U' R' U' R"
        },
        {
          "alg": "F' R' F U F' R F U R' U2 R U' R' U' R U2 R' U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R U2' R' U R U R' U2' R U' F' R' F U' F' R F"
        }
      ]
    ]
  },
  {
    "position": 24,
    "name": "Q1-",
    "subgroup": "Q - 5 edge EP",
    "setup": "U' R2 U2 R2' U R2 U2 R2' U' R2 U2 R2' U R2 U2 R2'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "q1m",
        "image": "cases/megaminx/full-pll/q1m.webp",
        "imageAlt": "Q1-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "EPLL"
      }
    },
    "algs": [
      [
        {
          "alg": "R2 U2' R2' U' R2 U2' R2' U R2 U2' R2' U' R2 U2' R2' U",
          "source": "LowCubes / Raul Low",
          "setup": "U' R2 U2 R2' U R2 U2 R2' U' R2 U2 R2' U R2 U2 R2'"
        },
        {
          "alg": "R2 U2' R2' U' R2 U2' R2' U R2 U2' R2' U' R2 U2' R2'",
          "source": "LowCubes / Raul Low",
          "setup": "R2 U2 R2' U R2 U2 R2' U' R2 U2 R2' U R2 U2 R2'"
        },
        {
          "alg": "R U' R' U' R U2 R' y' U2 R' U R U R' U2' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2 R U' R' U' R U2' y R U2' R' U R U R'"
        }
      ]
    ]
  },
  {
    "position": 25,
    "name": "Q2+",
    "subgroup": "Q - 5 edge EP",
    "setup": "U2 R U2 R' U R U2 R2' U2 R U R' U2 R",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "q2p",
        "image": "cases/megaminx/full-pll/q2p.webp",
        "imageAlt": "Q2+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "EPLL"
      }
    },
    "algs": [
      [
        {
          "alg": "R' U2' R U' R' U2' R2 U2' R' U' R U2' R' U2'",
          "source": "LowCubes / Raul Low",
          "setup": "U2 R U2 R' U R U2 R2' U2 R U R' U2 R"
        },
        {
          "alg": "R' U2' R U' R' U2' R2 U2' R' U' R U2' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2 R' U R U2 R2' U2 R U R' U2 R"
        }
      ]
    ]
  },
  {
    "position": 26,
    "name": "Q2-",
    "subgroup": "Q - 5 edge EP",
    "setup": "R' U2 R U R' U2 R U2 R U2 R' U R U2 R'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "q2m",
        "image": "cases/megaminx/full-pll/q2m.webp",
        "imageAlt": "Q2-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "EPLL"
      }
    },
    "algs": [
      [
        {
          "alg": "R U2' R' U' R U2' R' U2' R' U2' R U' R' U2' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2 R U R' U2 R U2 R U2 R' U R U2 R'"
        },
        {
          "alg": "R U2 R' U R U2 R2' U2 R U R' U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' R U' R' U2' R2 U2' R' U' R U2' R'"
        }
      ]
    ]
  },
  {
    "position": 27,
    "name": "J1+",
    "subgroup": "J - J block",
    "setup": "R U R2' F' R U R U' R' F R U' R'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "j1p",
        "image": "cases/megaminx/full-pll/j1p.webp",
        "imageAlt": "J1+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "3x1 Line"
      }
    },
    "algs": [
      [
        {
          "alg": "R U R' F' R U R' U' R' F R2 U' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U R2' F' R U R U' R' F R U' R'"
        },
        {
          "alg": "y2' R U R2' F' R U R U' R' F R U' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U R' F' R U R' U' R' F R2 U' R' y2"
        }
      ]
    ]
  },
  {
    "position": 28,
    "name": "J1-",
    "subgroup": "J - J block",
    "setup": "F R U' R' F R U' R' U R U R2' F' R U F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "j1m",
        "image": "cases/megaminx/full-pll/j1m.webp",
        "imageAlt": "J1-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "3x1 Line"
      }
    },
    "algs": [
      [
        {
          "alg": "F U' R' F R2 U' R' U' R U R' F' R U R' F'",
          "source": "LowCubes / Raul Low",
          "setup": "F R U' R' F R U' R' U R U R2' F' R U F'"
        }
      ]
    ]
  },
  {
    "position": 29,
    "name": "J2+",
    "subgroup": "J - J block",
    "setup": "R U R2' F' R U R U' R' F U R' U' R2 U' R' U R' U R U2'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "j2p",
        "image": "cases/megaminx/full-pll/j2p.webp",
        "imageAlt": "J2+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "3x1 Line"
      }
    },
    "algs": [
      [
        {
          "alg": "U2 R' U' R U' R U R2' U R U' F' R U R' U' R' F R2 U' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U R2' F' R U R U' R' F U R' U' R2 U' R' U R' U R U2'"
        },
        {
          "alg": "R' U2' R U2 R' U R U R U2 R' U' R U' R2' U' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U R2 U R' U R U2' R' U' R' U' R U2' R' U2 R"
        }
      ]
    ]
  },
  {
    "position": 30,
    "name": "J2-",
    "subgroup": "J - J block",
    "setup": "R U' R2' U' R U' R' U2 R U R U R' U2 R U2' R'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "j2m",
        "image": "cases/megaminx/full-pll/j2m.webp",
        "imageAlt": "J2-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "3x1 Line"
      }
    },
    "algs": [
      [
        {
          "alg": "R U2 R' U2' R U' R' U' R' U2' R U R' U R2 U R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U' R2' U' R U' R' U2 R U R U R' U2 R U2' R'"
        },
        {
          "alg": "y2' R U2 R' U R2' U' R U' R U R' U R2 U2 R' U R' U' R' U R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U' R U R U' R U2' R2' U' R U' R' U R' U R2 U' R U2' R' y2"
        }
      ]
    ]
  },
  {
    "position": 31,
    "name": "J3+",
    "subgroup": "J - J block",
    "setup": "U2 R' U' R U' R U R2' U R U' F' R U R' U' R' F R2 U' R'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "j3p",
        "image": "cases/megaminx/full-pll/j3p.webp",
        "imageAlt": "J3+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "3x1 Line"
      }
    },
    "algs": [
      [
        {
          "alg": "R U R2' F' R U R U' R' F U R' U' R2 U' R' U R' U R U2'",
          "source": "LowCubes / Raul Low",
          "setup": "U2 R' U' R U' R U R2' U R U' F' R U R' U' R' F R2 U' R'"
        },
        {
          "alg": "R U R' U' R' U2' R U R U R2' U R2 U2 R2' U2' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2 R2 U2' R2' U' R2 U' R' U' R' U2 R U R U' R'"
        },
        {
          "alg": "R' U R2 U R' U R U2' R' U' R' U' R U2' R' U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' R U2 R' U R U R U2 R' U' R U' R2' U' R"
        }
      ]
    ]
  },
  {
    "position": 32,
    "name": "J3-",
    "subgroup": "J - J block",
    "setup": "R U2 R' U2' R U' R' U' R' U2' R U R' U R2 U R'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "j3m",
        "image": "cases/megaminx/full-pll/j3m.webp",
        "imageAlt": "J3-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "3x1 Line"
      }
    },
    "algs": [
      [
        {
          "alg": "R U' R2' U' R U' R' U2 R U R U R' U2 R U2' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2 R' U2' R U' R' U' R' U2' R U R' U R2 U R'"
        },
        {
          "alg": "y2 F U F' R2' F U' F U' R2 U R2' U F2' R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' F2 U' R2 U' R2' U F' U F' R2 F U' F' y2'"
        }
      ]
    ]
  },
  {
    "position": 33,
    "name": "D+",
    "subgroup": "D - 3x1 and 2x2",
    "setup": "R U2' R' U2' R U2 R' U' R U' R' U R U2' R'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "dp",
        "image": "cases/megaminx/full-pll/dp.webp",
        "imageAlt": "D+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "3x1 Line"
      }
    },
    "algs": [
      [
        {
          "alg": "R U2 R' U' R U R' U R U2' R' U2 R U2 R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2' R' U2' R U2 R' U' R U' R' U R U2' R'"
        }
      ]
    ]
  },
  {
    "position": 34,
    "name": "D-",
    "subgroup": "D - 3x1 and 2x2",
    "setup": "R' U2 R U2 R' U2' R U R' U R U' R' U2 R",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "dm",
        "image": "cases/megaminx/full-pll/dm.webp",
        "imageAlt": "D-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "3x1 Line"
      }
    },
    "algs": [
      [
        {
          "alg": "R' U2' R U R' U' R U' R' U2 R U2' R' U2' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2 R U2 R' U2' R U R' U R U' R' U2 R"
        }
      ]
    ]
  },
  {
    "position": 35,
    "name": "M",
    "subgroup": "M - 2 3x1s",
    "setup": "R U R' U2' R' U2' R U R' U R2 U' R' U2 R U' R' U R U' R'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "m",
        "image": "cases/megaminx/full-pll/m.webp",
        "imageAlt": "M",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "3x1 Line"
      }
    },
    "algs": [
      [
        {
          "alg": "R U R' U' R U R' U2' R U R2' U' R U' R' U2 R U2 R U' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U R' U2' R' U2' R U R' U R2 U' R' U2 R U' R' U R U' R'"
        },
        {
          "alg": "R' U2 R U2 R' U' F R2 U R2' U R2 U2' R2' F' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' F R2 U2 R2' U' R2 U' R2' F' U R U2' R' U2' R"
        },
        {
          "alg": "y2' R U R' U2' R' U2' R U R' U R2 U' R' U2 R U' R' U R U' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U R' U' R U R' U2' R U R2' U' R U' R' U2 R U2 R U' R' y2"
        }
      ]
    ]
  },
  {
    "position": 36,
    "name": "F1+",
    "subgroup": "F - 3x1 and 1 or 2 2x1s or R block",
    "setup": "R2' U2' R2 U' R2' U2' R2",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "f1p",
        "image": "cases/megaminx/full-pll/f1p.webp",
        "imageAlt": "F1+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "3x1 Line"
      }
    },
    "algs": [
      [
        {
          "alg": "R2' U2 R2 U R2' U2 R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U2' R2 U' R2' U2' R2"
        },
        {
          "alg": "R2 U2 R2' U R2 U2 R2'",
          "source": "LowCubes / Raul Low",
          "setup": "R2 U2' R2' U' R2 U2' R2'"
        }
      ]
    ]
  },
  {
    "position": 37,
    "name": "F1-",
    "subgroup": "F - 3x1 and 1 or 2 2x1s or R block",
    "setup": "R2 U2 R2' U R2 U2 R2'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "f1m",
        "image": "cases/megaminx/full-pll/f1m.webp",
        "imageAlt": "F1-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "3x1 Line"
      }
    },
    "algs": [
      [
        {
          "alg": "R2 U2' R2' U' R2 U2' R2'",
          "source": "LowCubes / Raul Low",
          "setup": "R2 U2 R2' U R2 U2 R2'"
        }
      ]
    ]
  },
  {
    "position": 38,
    "name": "F2+",
    "subgroup": "F - 3x1 and 1 or 2 2x1s or R block",
    "setup": "R' U2' R U' R U R2' U2 R U2' R U' R'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "f2p",
        "image": "cases/megaminx/full-pll/f2p.webp",
        "imageAlt": "F2+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "3x1 Line"
      }
    },
    "algs": [
      [
        {
          "alg": "R U R' U2 R' U2' R2 U' R' U R' U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' R U' R U R2' U2 R U2' R U' R'"
        }
      ]
    ]
  },
  {
    "position": 39,
    "name": "F2-",
    "subgroup": "F - 3x1 and 1 or 2 2x1s or R block",
    "setup": "R U2 R' U R' U' R2 U2' R' U2 R' U R U2",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "f2m",
        "image": "cases/megaminx/full-pll/f2m.webp",
        "imageAlt": "F2-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "3x1 Line"
      }
    },
    "algs": [
      [
        {
          "alg": "U2' R' U' R U2' R U2 R2' U R U' R U2' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2 R' U R' U' R2 U2' R' U2 R' U R U2"
        },
        {
          "alg": "R' U' R U2' R U2 R2' U R U' R U2' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2 R' U R' U' R2 U2' R' U2 R' U R"
        }
      ]
    ]
  },
  {
    "position": 40,
    "name": "F3+",
    "subgroup": "F - 3x1 and 1 or 2 2x1s or R block",
    "setup": "R U R' U2 R' U2' R2 U' R' U R' U2 R U2",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "f3p",
        "image": "cases/megaminx/full-pll/f3p.webp",
        "imageAlt": "F3+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "3x1 Line"
      }
    },
    "algs": [
      [
        {
          "alg": "U2' R' U2' R U' R U R2' U2 R U2' R U' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U R' U2 R' U2' R2 U' R' U R' U2 R U2"
        },
        {
          "alg": "R' U2' R U' R U R2' U2 R U2' R U' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U R' U2 R' U2' R2 U' R' U R' U2 R"
        }
      ]
    ]
  },
  {
    "position": 41,
    "name": "F3-",
    "subgroup": "F - 3x1 and 1 or 2 2x1s or R block",
    "setup": "R' U' R U2' R U2 R2' U R U' R U2' R'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "f3m",
        "image": "cases/megaminx/full-pll/f3m.webp",
        "imageAlt": "F3-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "3x1 Line"
      }
    },
    "algs": [
      [
        {
          "alg": "R U2 R' U R' U' R2 U2' R' U2 R' U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R U2' R U2 R2' U R U' R U2' R'"
        }
      ]
    ]
  },
  {
    "position": 42,
    "name": "F4+",
    "subgroup": "F - 3x1 and 1 or 2 2x1s or R block",
    "setup": "R U2 R U2' R' U2' R' U2 R2 U2 R2' U' R U' R'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "f4p",
        "image": "cases/megaminx/full-pll/f4p.webp",
        "imageAlt": "F4+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "3x1 Line"
      }
    },
    "algs": [
      [
        {
          "alg": "R U R' U R2 U2' R2' U2' R U2 R U2 R' U2' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2 R U2' R' U2' R' U2 R2 U2 R2' U' R U' R'"
        }
      ]
    ]
  },
  {
    "position": 43,
    "name": "F4-",
    "subgroup": "F - 3x1 and 1 or 2 2x1s or R block",
    "setup": "R' U2' R' U2 R U2 R U2' R2' U2' R2 U R' U R",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "f4m",
        "image": "cases/megaminx/full-pll/f4m.webp",
        "imageAlt": "F4-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "3x1 Line"
      }
    },
    "algs": [
      [
        {
          "alg": "R' U' R U' R2' U2 R2 U2 R' U2' R' U2' R U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' R' U2 R U2 R U2' R2' U2' R2 U R' U R"
        }
      ]
    ]
  },
  {
    "position": 44,
    "name": "F5+",
    "subgroup": "F - 3x1 and 1 or 2 2x1s or R block",
    "setup": "R U R' U R2 U2' R2' U2' R U2 R U2 R' U2' R'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "f5p",
        "image": "cases/megaminx/full-pll/f5p.webp",
        "imageAlt": "F5+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "3x1 Line"
      }
    },
    "algs": [
      [
        {
          "alg": "R U2 R U2' R' U2' R' U2 R2 U2 R2' U' R U' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U R' U R2 U2' R2' U2' R U2 R U2 R' U2' R'"
        }
      ]
    ]
  },
  {
    "position": 45,
    "name": "F5-",
    "subgroup": "F - 3x1 and 1 or 2 2x1s or R block",
    "setup": "R' U' R U' R2' U2 R2 U2 R' U2' R' U2' R U2 R",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "f5m",
        "image": "cases/megaminx/full-pll/f5m.webp",
        "imageAlt": "F5-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "3x1 Line"
      }
    },
    "algs": [
      [
        {
          "alg": "R' U2' R' U2 R U2 R U2' R2' U2' R2 U R' U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R U' R2' U2 R2 U2 R' U2' R' U2' R U2 R"
        }
      ]
    ]
  },
  {
    "position": 46,
    "name": "Y1+",
    "subgroup": "Y - 2 2x1s in Y pattern",
    "setup": "F R' F' R U R U' R' F R U' R' U R U R' F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "y1p",
        "image": "cases/megaminx/full-pll/y1p.webp",
        "imageAlt": "Y1+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x2 Block"
      }
    },
    "algs": [
      [
        {
          "alg": "F R U' R' U' R U R' F' R U R' U' R' F R F'",
          "source": "LowCubes / Raul Low",
          "setup": "F R' F' R U R U' R' F R U' R' U R U R' F'"
        }
      ]
    ]
  },
  {
    "position": 47,
    "name": "Y1-",
    "subgroup": "Y - 2 2x1s in Y pattern",
    "setup": "F R U' R' U' R U R' F' R U R' U' R' F R F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "y1m",
        "image": "cases/megaminx/full-pll/y1m.webp",
        "imageAlt": "Y1-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x2 Block"
      }
    },
    "algs": [
      [
        {
          "alg": "F R' F' R U R U' R' F R U' R' U R U R' F'",
          "source": "LowCubes / Raul Low",
          "setup": "F R U' R' U' R U R' F' R U R' U' R' F R F'"
        }
      ]
    ]
  },
  {
    "position": 48,
    "name": "Y2+",
    "subgroup": "Y - 2 2x1s in Y pattern",
    "setup": "R2 U2 R2' U2' R2 U R2' U2' R2 U2 R2' U",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "y2p",
        "image": "cases/megaminx/full-pll/y2p.webp",
        "imageAlt": "Y2+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x2 Block"
      }
    },
    "algs": [
      [
        {
          "alg": "U' R2 U2' R2' U2 R2 U' R2' U2 R2 U2' R2'",
          "source": "LowCubes / Raul Low",
          "setup": "R2 U2 R2' U2' R2 U R2' U2' R2 U2 R2' U"
        },
        {
          "alg": "R2 U2' R2' U2 R2 U' R2' U2 R2 U2' R2'",
          "source": "LowCubes / Raul Low",
          "setup": "R2 U2 R2' U2' R2 U R2' U2' R2 U2 R2'"
        },
        {
          "alg": "R' U2' R U R U R2' U R2 U2' R2' U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' R2 U2 R2' U' R2 U' R' U' R' U2 R"
        },
        {
          "alg": "y2' R2' U2 R2 U2' R2' U2' R2 U2' R2' U2 R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U2' R2 U2 R2' U2 R2 U2 R2' U2' R2 y2"
        }
      ]
    ]
  },
  {
    "position": 49,
    "name": "Y2-",
    "subgroup": "Y - 2 2x1s in Y pattern",
    "setup": "R2' U2' R2 U2 R2' U' R2 U2 R2' U2' R2",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "y2m",
        "image": "cases/megaminx/full-pll/y2m.webp",
        "imageAlt": "Y2-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x2 Block"
      }
    },
    "algs": [
      [
        {
          "alg": "R2' U2 R2 U2' R2' U R2 U2' R2' U2 R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U2' R2 U2 R2' U' R2 U2 R2' U2' R2"
        },
        {
          "alg": "y2 R' U2' R2 U2 R2' U' R2 U' R' U' R' U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' R U R U R2' U R2 U2' R2' U2 R y2'"
        }
      ]
    ]
  },
  {
    "position": 50,
    "name": "Y3+",
    "subgroup": "Y - 2 2x1s in Y pattern",
    "setup": "R2 U2 R2' U' R2 U' R2' U2' R2 U2 R2' U' R2 U' R2' U2",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "y3p",
        "image": "cases/megaminx/full-pll/y3p.webp",
        "imageAlt": "Y3+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x2 Block"
      }
    },
    "algs": [
      [
        {
          "alg": "U2' R2 U R2' U R2 U2' R2' U2 R2 U R2' U R2 U2' R2'",
          "source": "LowCubes / Raul Low",
          "setup": "R2 U2 R2' U' R2 U' R2' U2' R2 U2 R2' U' R2 U' R2' U2"
        },
        {
          "alg": "y R2 U R2' U R2 U2' R2' U2 R2 U R2' U R2 U2' R2'",
          "source": "LowCubes / Raul Low",
          "setup": "R2 U2 R2' U' R2 U' R2' U2' R2 U2 R2' U' R2 U' R2' y'"
        },
        {
          "alg": "R2 U bR2' U R2' U R2 U' bR2 U2' R2'",
          "source": "LowCubes / Raul Low",
          "setup": "R2 U2 bR2' U R2' U' R2 U' bR2 U' R2'"
        }
      ]
    ]
  },
  {
    "position": 51,
    "name": "Y3-",
    "subgroup": "Y - 2 2x1s in Y pattern",
    "setup": "R2' U2' R2 U R2' U R2 U2 R2' U2' R2 U R2' U R2 U'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "y3m",
        "image": "cases/megaminx/full-pll/y3m.webp",
        "imageAlt": "Y3-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x2 Block"
      }
    },
    "algs": [
      [
        {
          "alg": "U R2' U' R2 U' R2' U2 R2 U2' R2' U' R2 U' R2' U2 R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U2' R2 U R2' U R2 U2 R2' U2' R2 U R2' U R2 U'"
        },
        {
          "alg": "R2' U' F2 U' R2 U' R2' U F2' U2 R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U2' F2 U' R2 U R2' U F2' U R2"
        },
        {
          "alg": "y' R2' U' R2 U' R2' U2 R2 U2' R2' U' R2 U' R2' U2 R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U2' R2 U R2' U R2 U2 R2' U2' R2 U R2' U R2 y"
        },
        {
          "alg": "y2 R2' F2' R U2' R U2 R' F R U R' U' R' F R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' F' R U R U' R' F' R U2' R' U2 R' F2 R2 y2'"
        }
      ]
    ]
  },
  {
    "position": 52,
    "name": "W",
    "subgroup": "W - 2 2x2s",
    "setup": "R' U2' R' U2 R U2 R U' R2' U2 R2 U2 R' U R",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "w",
        "image": "cases/megaminx/full-pll/w.webp",
        "imageAlt": "W",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x2 Block"
      }
    },
    "algs": [
      [
        {
          "alg": "R' U' R U2' R2' U2' R2 U R' U2' R' U2' R U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' R' U2 R U2 R U' R2' U2 R2 U2 R' U R"
        },
        {
          "alg": "R' U2' R' U2 R U2 R U' R2' U2 R2 U2 R' U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R U2' R2' U2' R2 U R' U2' R' U2' R U2 R"
        }
      ]
    ]
  },
  {
    "position": 53,
    "name": "V1+",
    "subgroup": "V - 2x2 and 2x1",
    "setup": "R' U R U R' U' R' dR' R U R' dR R U2' R",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "v1p",
        "image": "cases/megaminx/full-pll/v1p.webp",
        "imageAlt": "V1+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x2 Block"
      }
    },
    "algs": [
      [
        {
          "alg": "R' U2 R' dR' R U' R' dR R U R U' R' U' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U R U R' U' R' dR' R U R' dR R U2' R"
        }
      ]
    ]
  },
  {
    "position": 54,
    "name": "V1-",
    "subgroup": "V - 2x2 and 2x1",
    "setup": "R U R' F' U' F R U R' F R' F' R2 U2' R'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "v1m",
        "image": "cases/megaminx/full-pll/v1m.webp",
        "imageAlt": "V1-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x2 Block"
      }
    },
    "algs": [
      [
        {
          "alg": "R U2 R2' F R F' R U' R' F' U F R U' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U R' F' U' F R U R' F R' F' R2 U2' R'"
        },
        {
          "alg": "y2 R U2' R' U2 R' U2 R U2 R' U R U' R U2' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2 R' U R' U' R U2' R' U2' R U2' R U2 R' y2'"
        }
      ]
    ]
  },
  {
    "position": 55,
    "name": "V2+",
    "subgroup": "V - 2x2 and 2x1",
    "setup": "R' U2 R' dR' R U' R' dR R U R U' R' U' R",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "v2p",
        "image": "cases/megaminx/full-pll/v2p.webp",
        "imageAlt": "V2+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x2 Block"
      }
    },
    "algs": [
      [
        {
          "alg": "R' U R U R' U' R' dR' R U R' dR R U2' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2 R' dR' R U' R' dR R U R U' R' U' R"
        }
      ]
    ]
  },
  {
    "position": 56,
    "name": "V2-",
    "subgroup": "V - 2x2 and 2x1",
    "setup": "R U' R' F' U F R U' R' F R U R' U' F' R U R' U2'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "v2m",
        "image": "cases/megaminx/full-pll/v2m.webp",
        "imageAlt": "V2-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x2 Block"
      }
    },
    "algs": [
      [
        {
          "alg": "U2 R U' R' F U R U' R' F' R U R' F' U' F R U R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U' R' F' U F R U' R' F R U R' U' F' R U R' U2'"
        },
        {
          "alg": "R U' R' F U R U' R' F' R U R' F' U' F R U R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U' R' F' U F R U' R' F R U R' U' F' R U R'"
        },
        {
          "alg": "R U' R' U' R U R' U R' DR' R U' R' DR R2 U R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U' R2' DR' R U R' DR R U' R U' R' U R U R'"
        },
        {
          "alg": "y' R U R' F' U' F R U R' F R' F' R2 U2' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2 R2' F R F' R U' R' F' U F R U' R' y"
        }
      ]
    ]
  },
  {
    "position": 57,
    "name": "V3+",
    "subgroup": "V - 2x2 and 2x1",
    "setup": "R' U R' U' R2 U' R U R U' R' U R U R2' U' R'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "v3p",
        "image": "cases/megaminx/full-pll/v3p.webp",
        "imageAlt": "V3+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x2 Block"
      }
    },
    "algs": [
      [
        {
          "alg": "R U R2 U' R' U' R U R' U' R' U R2' U R U' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U R' U' R2 U' R U R U' R' U R U R2' U' R'"
        }
      ]
    ]
  },
  {
    "position": 58,
    "name": "V3-",
    "subgroup": "V - 2x2 and 2x1",
    "setup": "R U' R U R2' U R' U' R' U R U' R' U' R2 U R",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "v3m",
        "image": "cases/megaminx/full-pll/v3m.webp",
        "imageAlt": "V3-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x2 Block"
      }
    },
    "algs": [
      [
        {
          "alg": "R' U' R2' U R U R' U' R U R U' R2 U' R' U R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U' R U R2' U R' U' R' U R U' R' U' R2 U R"
        },
        {
          "alg": "R' U2' R U R U' R' F R' U2 R U2' F' R U R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U' R' F U2 R' U2' R F' R U R' U' R' U2 R"
        }
      ]
    ]
  },
  {
    "position": 59,
    "name": "V4+",
    "subgroup": "V - 2x2 and 2x1",
    "setup": "R U R2 U' R' U' R U R' U' R' U R2' U R U' R",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "v4p",
        "image": "cases/megaminx/full-pll/v4p.webp",
        "imageAlt": "V4+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x2 Block"
      }
    },
    "algs": [
      [
        {
          "alg": "R' U R' U' R2 U' R U R U' R' U R U R2' U' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U R2 U' R' U' R U R' U' R' U R2' U R U' R"
        },
        {
          "alg": "y' R U R' U' R' U F R U R U' R' F' U R' U2' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2 R U' F R U R' U' R' F' U' R U R U' R' y"
        }
      ]
    ]
  },
  {
    "position": 60,
    "name": "V4-",
    "subgroup": "V - 2x2 and 2x1",
    "setup": "R' U' R2' U R U R' U' R U R U' R2 U' R' U R'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "v4m",
        "image": "cases/megaminx/full-pll/v4m.webp",
        "imageAlt": "V4-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x2 Block"
      }
    },
    "algs": [
      [
        {
          "alg": "R U' R U R2' U R' U' R' U R U' R' U' R2 U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R2' U R U R' U' R U R U' R2 U' R' U R'"
        },
        {
          "alg": "R U' R' F U2 R' U2' R F' R U R' U' R' U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' R U R U' R' F R' U2 R U2' F' R U R'"
        }
      ]
    ]
  },
  {
    "position": 61,
    "name": "B1+",
    "subgroup": "B - Double R block",
    "setup": "R' U2' R2 U R' U' R' U2 R U R U' R'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "b1p",
        "image": "cases/megaminx/full-pll/b1p.webp",
        "imageAlt": "B1+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "R Block"
      }
    },
    "algs": [
      [
        {
          "alg": "R U R' U' R' U2' R U R U' R2' U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' R2 U R' U' R' U2 R U R U' R'"
        },
        {
          "alg": "y2 R' U2' R2 U R' U' R' U2 R U R U' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U R' U' R' U2' R U R U' R2' U2 R y2'"
        }
      ]
    ]
  },
  {
    "position": 62,
    "name": "B1-",
    "subgroup": "B - Double R block",
    "setup": "R U2 R2' U' R U R U2' R' U' R' U R",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "b1m",
        "image": "cases/megaminx/full-pll/b1m.webp",
        "imageAlt": "B1-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "R Block"
      }
    },
    "algs": [
      [
        {
          "alg": "R' U' R U R U2 R' U' R' U R2 U2' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2 R2' U' R U R U2' R' U' R' U R"
        },
        {
          "alg": "y2' R U2 R2' U' R U R U2' R' U' R' U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R U R U2 R' U' R' U R2 U2' R' y2"
        }
      ]
    ]
  },
  {
    "position": 63,
    "name": "B2+",
    "subgroup": "B - Double R block",
    "setup": "R U' R' U2' R2 U R' U R U' R' U2 R' U2' R2 U' R2'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "b2p",
        "image": "cases/megaminx/full-pll/b2p.webp",
        "imageAlt": "B2+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "R Block"
      }
    },
    "algs": [
      [
        {
          "alg": "R2 U R2' U2 R U2' R U R' U' R U' R2' U2 R U R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U' R' U2' R2 U R' U R U' R' U2 R' U2' R2 U' R2'"
        },
        {
          "alg": "y2' R U' R' U2' R2 U R' U R U' R' U2 R' U2' R2 U' R2'",
          "source": "LowCubes / Raul Low",
          "setup": "R2 U R2' U2 R U2' R U R' U' R U' R2' U2 R U R' y2"
        }
      ]
    ]
  },
  {
    "position": 64,
    "name": "B2-",
    "subgroup": "B - Double R block",
    "setup": "R' U R U2 R2' U' R U' R' U R U2' R U2 R2' U R2",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "b2m",
        "image": "cases/megaminx/full-pll/b2m.webp",
        "imageAlt": "B2-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "R Block"
      }
    },
    "algs": [
      [
        {
          "alg": "R2' U' R2 U2' R' U2 R' U' R U R' U R2 U2' R' U' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U R U2 R2' U' R U' R' U R U2' R U2 R2' U R2"
        },
        {
          "alg": "y2 R' U R U2 R2' U' R U' R' U R U2' R U2 R2' U R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U' R2 U2' R' U2 R' U' R U R' U R2 U2' R' U' R y2'"
        }
      ]
    ]
  },
  {
    "position": 65,
    "name": "R1+",
    "subgroup": "R - R block and 2x1",
    "setup": "R' U R' U2 R U R U' R2' U2' R2 U R' U2' R",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "r1p",
        "image": "cases/megaminx/full-pll/r1p.webp",
        "imageAlt": "R1+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "R Block"
      }
    },
    "algs": [
      [
        {
          "alg": "R' U2 R U' R2' U2 R2 U R' U' R' U2' R U' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U R' U2 R U R U' R2' U2' R2 U R' U2' R"
        }
      ]
    ]
  },
  {
    "position": 66,
    "name": "R1-",
    "subgroup": "R - R block and 2x1",
    "setup": "R U' R U2' R' U' R' U R2 U2 R2' U' R U2 R' U2",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "r1m",
        "image": "cases/megaminx/full-pll/r1m.webp",
        "imageAlt": "R1-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "R Block"
      }
    },
    "algs": [
      [
        {
          "alg": "U2' R U2' R' U R2 U2' R2' U' R U R U2 R' U R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U' R U2' R' U' R' U R2 U2 R2' U' R U2 R' U2"
        },
        {
          "alg": "R U2' R' U R2 U2' R2' U' R U R U2 R' U R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U' R U2' R' U' R' U R2 U2 R2' U' R U2 R'"
        }
      ]
    ]
  },
  {
    "position": 67,
    "name": "R2+",
    "subgroup": "R - R block and 2x1",
    "setup": "R' U2 R U' R2' U2 R2 U R' U' R' U2' R U' R",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "r2p",
        "image": "cases/megaminx/full-pll/r2p.webp",
        "imageAlt": "R2+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "R Block"
      }
    },
    "algs": [
      [
        {
          "alg": "R' U R' U2 R U R U' R2' U2' R2 U R' U2' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2 R U' R2' U2 R2 U R' U' R' U2' R U' R"
        }
      ]
    ]
  },
  {
    "position": 68,
    "name": "R2-",
    "subgroup": "R - R block and 2x1",
    "setup": "R U2' R' U R2 U2' R2' U' R U R U2 R' U R' U2",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "r2m",
        "image": "cases/megaminx/full-pll/r2m.webp",
        "imageAlt": "R2-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "R Block"
      }
    },
    "algs": [
      [
        {
          "alg": "U2' R U' R U2' R' U' R' U R2 U2 R2' U' R U2 R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2' R' U R2 U2' R2' U' R U R U2 R' U R' U2"
        },
        {
          "alg": "R U' R U2' R' U' R' U R2 U2 R2' U' R U2 R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2' R' U R2 U2' R2' U' R U R U2 R' U R'"
        }
      ]
    ]
  },
  {
    "position": 69,
    "name": "R3+",
    "subgroup": "R - R block and 2x1",
    "setup": "R' U' R U R' U R2 U R' U R U R' U' R' U' R2 U' R' U2",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "r3p",
        "image": "cases/megaminx/full-pll/r3p.webp",
        "imageAlt": "R3+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "R Block"
      }
    },
    "algs": [
      [
        {
          "alg": "U2' R U R2' U R U R U' R' U' R U' R2' U' R U' R' U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R U R' U R2 U R' U R U R' U' R' U' R2 U' R' U2"
        },
        {
          "alg": "R U R2' U R U R U' R' U' R U' R2' U' R U' R' U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R U R' U R2 U R' U R U R' U' R' U' R2 U' R'"
        }
      ]
    ]
  },
  {
    "position": 70,
    "name": "R3-",
    "subgroup": "R - R block and 2x1",
    "setup": "R U R' U' R U' R2' U' R U' R' U' R U R U R2' U R",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "r3m",
        "image": "cases/megaminx/full-pll/r3m.webp",
        "imageAlt": "R3-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "R Block"
      }
    },
    "algs": [
      [
        {
          "alg": "R' U' R2 U' R' U' R' U R U R' U R2 U R' U R U' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U R' U' R U' R2' U' R U' R' U' R U R U R2' U R"
        }
      ]
    ]
  },
  {
    "position": 71,
    "name": "R4+",
    "subgroup": "R - R block and 2x1",
    "setup": "R U R2' U R U R U' R' U' R U' R2' U' R U' R' U R U'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "r4p",
        "image": "cases/megaminx/full-pll/r4p.webp",
        "imageAlt": "R4+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "R Block"
      }
    },
    "algs": [
      [
        {
          "alg": "U R' U' R U R' U R2 U R' U R U R' U' R' U' R2 U' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U R2' U R U R U' R' U' R U' R2' U' R U' R' U R U'"
        },
        {
          "alg": "R' U' R U R' U R2 U R' U R U R' U' R' U' R2 U' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U R2' U R U R U' R' U' R U' R2' U' R U' R' U R"
        }
      ]
    ]
  },
  {
    "position": 72,
    "name": "R4-",
    "subgroup": "R - R block and 2x1",
    "setup": "R' U' R2 U' R' U' R' U R U R' U R2 U R' U R U' R' U2'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "r4m",
        "image": "cases/megaminx/full-pll/r4m.webp",
        "imageAlt": "R4-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "R Block"
      }
    },
    "algs": [
      [
        {
          "alg": "U2 R U R' U' R U' R2' U' R U' R' U' R U R U R2' U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R2 U' R' U' R' U R U R' U R2 U R' U R U' R' U2'"
        },
        {
          "alg": "R U R' U' R U' R2' U' R U' R' U' R U R U R2' U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R2 U' R' U' R' U R U R' U R2 U R' U R U' R'"
        }
      ]
    ]
  },
  {
    "position": 73,
    "name": "P1+",
    "subgroup": "P - R block",
    "setup": "F R U2 R' U' R U' R2' F' L F R F' L'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "p1p",
        "image": "cases/megaminx/full-pll/p1p.webp",
        "imageAlt": "P1+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "R Block"
      }
    },
    "algs": [
      [
        {
          "alg": "L F R' F' L' F R2 U R' U R U2' R' F'",
          "source": "LowCubes / Raul Low",
          "setup": "F R U2 R' U' R U' R2' F' L F R F' L'"
        },
        {
          "alg": "R' F R2 U R' U R U2' R' U R' F' R F U' F'",
          "source": "LowCubes / Raul Low",
          "setup": "F U F' R' F R U' R U2 R' U' R U' R2' F' R"
        }
      ]
    ]
  },
  {
    "position": 74,
    "name": "P1-",
    "subgroup": "P - R block",
    "setup": "bR' R' U2' R U R' U R2 y R U R' U' R' F' R U R",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "p1m",
        "image": "cases/megaminx/full-pll/p1m.webp",
        "imageAlt": "P1-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "R Block"
      }
    },
    "algs": [
      [
        {
          "alg": "R' U' R' F R U R U' R' y' R2' U' R U' R' U2 R bR",
          "source": "LowCubes / Raul Low",
          "setup": "bR' R' U2' R U R' U R2 y R U R' U' R' F' R U R"
        },
        {
          "alg": "R' U2' F' U2 F R2 U2' R' F R' F' R2 U2 R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2' R2' F R F' R U2 R2' F' U2' F U2 R"
        },
        {
          "alg": "y2 F R' U' R2 U' R2' U2 R U' F' R' U' F' U F R",
          "source": "LowCubes / Raul Low",
          "setup": "R' F' U' F U R F U R' U2' R2 U R2' U R F' y2'"
        }
      ]
    ]
  },
  {
    "position": 75,
    "name": "P2+",
    "subgroup": "P - R block",
    "setup": "L F R' F' L' F R2 U R' U R U2' R' F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "p2p",
        "image": "cases/megaminx/full-pll/p2p.webp",
        "imageAlt": "P2+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "R Block"
      }
    },
    "algs": [
      [
        {
          "alg": "F R U2 R' U' R U' R2' F' L F R F' L'",
          "source": "LowCubes / Raul Low",
          "setup": "L F R' F' L' F R2 U R' U R U2' R' F'"
        },
        {
          "alg": "F U F' R' F R U' R U2 R' U' R U' R2' F' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' F R2 U R' U R U2' R' U R' F' R F U' F'"
        }
      ]
    ]
  },
  {
    "position": 76,
    "name": "P2-",
    "subgroup": "P - R block",
    "setup": "R' U' R' F R U R U' R' y' R2' U' R U' R' U2 R bR U2",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "p2m",
        "image": "cases/megaminx/full-pll/p2m.webp",
        "imageAlt": "P2-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "R Block"
      }
    },
    "algs": [
      [
        {
          "alg": "U2' bR' R' U2' R U R' U R2 y R U R' U' R' F' R U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R' F R U R U' R' y' R2' U' R U' R' U2 R bR U2"
        },
        {
          "alg": "BR' R' U2' R U R' U R2 x' U L' U' R' U L",
          "source": "LowCubes / Raul Low",
          "setup": "L' U' R U L U' x R2' U' R U' R' U2 R BR"
        },
        {
          "alg": "y' R U2' R2' F R F' R U2 R2' F' U2' F U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' F' U2 F R2 U2' R' F R' F' R2 U2 R' y"
        }
      ]
    ]
  },
  {
    "position": 77,
    "name": "P3+",
    "subgroup": "P - R block",
    "setup": "R2' U2' R2 U R2' U R U2' R U R U2 R2' U' R2 U' R' U2",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "p3p",
        "image": "cases/megaminx/full-pll/p3p.webp",
        "imageAlt": "P3+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "R Block"
      }
    },
    "algs": [
      [
        {
          "alg": "U2' R U R2' U R2 U2' R' U' R' U2 R' U' R2 U' R2' U2 R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U2' R2 U R2' U R U2' R U R U2 R2' U' R2 U' R' U2"
        },
        {
          "alg": "F R U' R' U' R U R U2 R' U' R U' R2' F'",
          "source": "LowCubes / Raul Low",
          "setup": "F R2 U R' U R U2' R' U' R' U R U R' F'"
        }
      ]
    ]
  },
  {
    "position": 78,
    "name": "P3-",
    "subgroup": "P - R block",
    "setup": "R2 U2 R2' U' R2 U' R' U2 R' U' R' U2' R2 U R2' U R",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "p3m",
        "image": "cases/megaminx/full-pll/p3m.webp",
        "imageAlt": "P3-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "R Block"
      }
    },
    "algs": [
      [
        {
          "alg": "R' U' R2 U' R2' U2 R U R U2' R U R2' U R2 U2' R2'",
          "source": "LowCubes / Raul Low",
          "setup": "R2 U2 R2' U' R2 U' R' U2 R' U' R' U2' R2 U R2' U R"
        },
        {
          "alg": "BR' R' U R U R' U' R' U2' R U R' U R2 BR",
          "source": "LowCubes / Raul Low",
          "setup": "BR' R2' U' R U' R' U2 R U R U' R' U' R BR"
        }
      ]
    ]
  },
  {
    "position": 79,
    "name": "P4+",
    "subgroup": "P - R block",
    "setup": "R U R2' U R2 U2' R' U' R' U2 R' U' R2 U' R2' U2 R2 U2",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "p4p",
        "image": "cases/megaminx/full-pll/p4p.webp",
        "imageAlt": "P4+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "R Block"
      }
    },
    "algs": [
      [
        {
          "alg": "U2' R2' U2' R2 U R2' U R U2' R U R U2 R2' U' R2 U' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U R2' U R2 U2' R' U' R' U2 R' U' R2 U' R2' U2 R2 U2"
        },
        {
          "alg": "F R2 U R' U R U2' R' U' R' U R U R' F'",
          "source": "LowCubes / Raul Low",
          "setup": "F R U' R' U' R U R U2 R' U' R U' R2' F'"
        }
      ]
    ]
  },
  {
    "position": 80,
    "name": "P4-",
    "subgroup": "P - R block",
    "setup": "R' U' R2 U' R2' U2 R U R U2' R U R2' U R2 U2' R2'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "p4m",
        "image": "cases/megaminx/full-pll/p4m.webp",
        "imageAlt": "P4-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "R Block"
      }
    },
    "algs": [
      [
        {
          "alg": "R2 U2 R2' U' R2 U' R' U2 R' U' R' U2' R2 U R2' U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R2 U' R2' U2 R U R U2' R U R2' U R2 U2' R2'"
        },
        {
          "alg": "BR' R2' U' R U' R' U2 R U R U' R' U' R BR",
          "source": "LowCubes / Raul Low",
          "setup": "BR' R' U R U R' U' R' U2' R U R' U R2 BR"
        }
      ]
    ]
  },
  {
    "position": 81,
    "name": "N1+",
    "subgroup": "N - 5 2x1s",
    "setup": "R U2 R2' F' R U R U' R' F R U2' R'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "n1p",
        "image": "cases/megaminx/full-pll/n1p.webp",
        "imageAlt": "N1+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s touching"
      }
    },
    "algs": [
      [
        {
          "alg": "R U2 R' F' R U R' U' R' F R2 U2' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2 R2' F' R U R U' R' F R U2' R'"
        },
        {
          "alg": "y R U2 R2' F' R U R U' R' F R U2' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2 R' F' R U R' U' R' F R2 U2' R' y'"
        },
        {
          "alg": "y2' R U2 R U2' R' U' R U2' R' U2 R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2' R U2 R' U R U2 R' U2' R' y2"
        }
      ]
    ]
  },
  {
    "position": 82,
    "name": "N1-",
    "subgroup": "N - 5 2x1s",
    "setup": "U R' U2' R' U2 R U R' U2 R U2' R",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "n1m",
        "image": "cases/megaminx/full-pll/n1m.webp",
        "imageAlt": "N1-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s touching"
      }
    },
    "algs": [
      [
        {
          "alg": "R' U2 R' U2' R U' R' U2' R U2 R U'",
          "source": "LowCubes / Raul Low",
          "setup": "U R' U2' R' U2 R U R' U2 R U2' R"
        },
        {
          "alg": "R' U2 R' U2' R U' R' U2' R U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' R' U2 R U R' U2 R U2' R"
        },
        {
          "alg": "y2 L' R' U2' R U' R' U2' R U' L",
          "source": "LowCubes / Raul Low",
          "setup": "L' U R' U2 R U R' U2 R L y2'"
        }
      ]
    ]
  },
  {
    "position": 83,
    "name": "N2+",
    "subgroup": "N - 5 2x1s",
    "setup": "U R U2' L U2' R' U L' R U' L U2' L' R'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "n2p",
        "image": "cases/megaminx/full-pll/n2p.webp",
        "imageAlt": "N2+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s touching"
      }
    },
    "algs": [
      [
        {
          "alg": "R L U2 L' U R' L U' R U2 L' U2 R' U'",
          "source": "LowCubes / Raul Low",
          "setup": "U R U2' L U2' R' U L' R U' L U2' L' R'"
        },
        {
          "alg": "R L U2 L' U R' L U' R U2 L' U2 R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2' L U2' R' U L' R U' L U2' L' R'"
        }
      ]
    ]
  },
  {
    "position": 84,
    "name": "N2-",
    "subgroup": "N - 5 2x1s",
    "setup": "U' L' R' U2' R U' L R' U L' U2' R U2' L",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "n2m",
        "image": "cases/megaminx/full-pll/n2m.webp",
        "imageAlt": "N2-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s touching"
      }
    },
    "algs": [
      [
        {
          "alg": "L' U2 R' U2 L U' R L' U R' U2 R L U",
          "source": "LowCubes / Raul Low",
          "setup": "U' L' R' U2' R U' L R' U L' U2' R U2' L"
        },
        {
          "alg": "R' L' U2' R U' L R' U L' U2' R U2' L",
          "source": "LowCubes / Raul Low",
          "setup": "L' U2 R' U2 L U' R L' U R' U2 L R"
        },
        {
          "alg": "R' U2 R U2' R2' U' R2 U' R2' U R2 U' R2' U2 R U2' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2 R' U2' R2 U R2' U' R2 U R2' U R2 U2 R' U2' R"
        }
      ]
    ]
  },
  {
    "position": 85,
    "name": "C1+",
    "subgroup": "C - 2 2x1s touching",
    "setup": "R U2 R' U2 R' U2' R2 U' R' U R' U2 R U2 R U' R' U2",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "c1p",
        "image": "cases/megaminx/full-pll/c1p.webp",
        "imageAlt": "C1+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s touching"
      }
    },
    "algs": [
      [
        {
          "alg": "U2' R U R' U2' R' U2' R U' R U R2' U2 R U2' R U2' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2 R' U2 R' U2' R2 U' R' U R' U2 R U2 R U' R' U2"
        },
        {
          "alg": "y2 R U2 R' U R F U R' U' R F' R' U R U R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U' R' U' R F R' U R U' F' R' U' R U2' R' y2'"
        },
        {
          "alg": "R U2 R' U' R U2' R' U R U R2' U' R U' R U R2' U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R2 U' R' U R' U R2 U' R' U' R U2 R' U R U2' R'"
        },
        {
          "alg": "y' R U R' U2' R' U2' R U' R U R2' U2 R U2' R U2' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2 R' U2 R' U2' R2 U' R' U R' U2 R U2 R U' R' y"
        }
      ]
    ]
  },
  {
    "position": 86,
    "name": "C1-",
    "subgroup": "C - 2 2x1s touching",
    "setup": "R' U' R U2 R U2 R' U R' U' R2 U2' R' U2 R' U2 R U",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "c1m",
        "image": "cases/megaminx/full-pll/c1m.webp",
        "imageAlt": "C1-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s touching"
      }
    },
    "algs": [
      [
        {
          "alg": "U' R' U2' R U2' R U2 R2' U R U' R U2' R' U2' R' U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R U2 R U2 R' U R' U' R2 U2' R' U2 R' U2 R U"
        },
        {
          "alg": "R' U2' R U R' U2 R U' R' U' R2 U R' U R' U' R2 U' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U R2' U R U' R U' R2' U R U R' U2' R U' R' U2 R"
        },
        {
          "alg": "y' R' U' R U2 R U2 R' U R' U' R2 U2' R' U2 R' U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' R U2' R U2 R2' U R U' R U2' R' U2' R' U R y"
        }
      ]
    ]
  },
  {
    "position": 87,
    "name": "C2+",
    "subgroup": "C - 2 2x1s touching",
    "setup": "R' U' R U' R U2 R2' U' R2 U' R2' U2' R U R' U2 R U'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "c2p",
        "image": "cases/megaminx/full-pll/c2p.webp",
        "imageAlt": "C2+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s touching"
      }
    },
    "algs": [
      [
        {
          "alg": "U R' U2' R U' R' U2 R2 U R2' U R2 U2' R' U R' U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R U' R U2 R2' U' R2 U' R2' U2' R U R' U2 R U'"
        },
        {
          "alg": "R' U' R U' R U2 R2' U' R2 U' R2' U2' R U R' U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' R U' R' U2 R2 U R2' U R2 U2' R' U R' U R"
        },
        {
          "alg": "y2 R' U2' R U' R' U2 R2 U R2' U R2 U2' R' U R' U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R U' R U2 R2' U' R2 U' R2' U2' R U R' U2 R y2'"
        }
      ]
    ]
  },
  {
    "position": 88,
    "name": "C2-",
    "subgroup": "C - 2 2x1s touching",
    "setup": "R U2 R' U R U2' R2' U' R2 U' R2' U2 R U' R U' R' U",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "c2m",
        "image": "cases/megaminx/full-pll/c2m.webp",
        "imageAlt": "C2-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s touching"
      }
    },
    "algs": [
      [
        {
          "alg": "U' R U R' U R' U2' R2 U R2' U R2 U2 R' U' R U2' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2 R' U R U2' R2' U' R2 U' R2' U2 R U' R U' R' U"
        },
        {
          "alg": "R U R' U R' U2' R2 U R2' U R2 U2 R' U' R U2' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2 R' U R U2' R2' U' R2 U' R2' U2 R U' R U' R'"
        },
        {
          "alg": "y2' R U2 R' U R U2' R2' U' R2 U' R2' U2 R U' R U' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U R' U R' U2' R2 U R2' U R2 U2 R' U' R U2' R' y2"
        }
      ]
    ]
  },
  {
    "position": 89,
    "name": "C3+",
    "subgroup": "C - 2 2x1s touching",
    "setup": "R2' U2 R2 U2' R2' U R2 U2 R2' U R2 U' R2' U2' R2 U'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "c3p",
        "image": "cases/megaminx/full-pll/c3p.webp",
        "imageAlt": "C3+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s touching"
      }
    },
    "algs": [
      [
        {
          "alg": "U R2' U2 R2 U R2' U' R2 U2' R2' U' R2 U2 R2' U2' R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U2 R2 U2' R2' U R2 U2 R2' U R2 U' R2' U2' R2 U'"
        },
        {
          "alg": "R2' U2 R2 U R2' U' R2 U2' R2' U' R2 U2 R2' U2' R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U2 R2 U2' R2' U R2 U2 R2' U R2 U' R2' U2' R2"
        },
        {
          "alg": "y R2' U2 R2 U2' R2' U R2 U2 R2' U R2 U' R2' U2' R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U2 R2 U R2' U' R2 U2' R2' U' R2 U2 R2' U2' R2 y'"
        }
      ]
    ]
  },
  {
    "position": 90,
    "name": "C3-",
    "subgroup": "C - 2 2x1s touching",
    "setup": "R2 U2' R2' U2 R2 U' R2' U2' R2 U' R2' U R2 U2 R2' U2'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "c3m",
        "image": "cases/megaminx/full-pll/c3m.webp",
        "imageAlt": "C3-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s touching"
      }
    },
    "algs": [
      [
        {
          "alg": "U2 R2 U2' R2' U' R2 U R2' U2 R2 U R2' U2' R2 U2 R2'",
          "source": "LowCubes / Raul Low",
          "setup": "R2 U2' R2' U2 R2 U' R2' U2' R2 U' R2' U R2 U2 R2' U2'"
        },
        {
          "alg": "R2 U2' R2' U' R2 U R2' U2 R2 U R2' U2' R2 U2 R2'",
          "source": "LowCubes / Raul Low",
          "setup": "R2 U2' R2' U2 R2 U' R2' U2' R2 U' R2' U R2 U2 R2'"
        },
        {
          "alg": "y' R2' U2' R2 U2 R2' U' R2 U2' R2' U' R2 U R2' U2 R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U2' R2 U' R2' U R2 U2 R2' U R2 U2' R2' U2 R2 y"
        }
      ]
    ]
  },
  {
    "position": 91,
    "name": "C4+",
    "subgroup": "C - 2 2x1s touching",
    "setup": "R2 U2' R2' U' R2 U2' R2' U R2' U2 R2 U R2' U2 R2 U'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "c4p",
        "image": "cases/megaminx/full-pll/c4p.webp",
        "imageAlt": "C4+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s touching"
      }
    },
    "algs": [
      [
        {
          "alg": "U R2' U2' R2 U' R2' U2' R2 U' R2 U2 R2' U R2 U2 R2'",
          "source": "LowCubes / Raul Low",
          "setup": "R2 U2' R2' U' R2 U2' R2' U R2' U2 R2 U R2' U2 R2 U'"
        },
        {
          "alg": "R2' U2' R2 U' R2' U2' R2 U' R2' U2 R2 U R2' U2 R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U2' R2 U' R2' U2' R2 U R2' U2 R2 U R2' U2 R2"
        },
        {
          "alg": "y2 R2' U2 R2 bR2' U R2' U' R2 U' bR2 U R2' U2' R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U2 R2 U' bR2' U R2' U R2 U' bR2 R2' U2' R2 y2'"
        }
      ]
    ]
  },
  {
    "position": 92,
    "name": "C4-",
    "subgroup": "C - 2 2x1s touching",
    "setup": "R2' U2 R2 U R2' U2 R2 U' R2' U2' R2 U' R2' U2' R2 U2'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "c4m",
        "image": "cases/megaminx/full-pll/c4m.webp",
        "imageAlt": "C4-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s touching"
      }
    },
    "algs": [
      [
        {
          "alg": "U2 R2' U2 R2 U R2' U2 R2 U R2' U2' R2 U' R2' U2' R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U2 R2 U R2' U2 R2 U' R2' U2' R2 U' R2' U2' R2 U2'"
        },
        {
          "alg": "R2' U2 R2 U R2' U2 R2 U R2' U2' R2 U' R2' U2' R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U2 R2 U R2' U2 R2 U' R2' U2' R2 U' R2' U2' R2"
        },
        {
          "alg": "y2' R2 U2' R2' F2 U' R2 U R2' U F2' U' R2 U2 R2'",
          "source": "LowCubes / Raul Low",
          "setup": "R2 U2' R2' U F2 U' R2 U' R2' U F2' R2 U2 R2' y2"
        }
      ]
    ]
  },
  {
    "position": 93,
    "name": "C5+",
    "subgroup": "C - 2 2x1s touching",
    "setup": "R U R U2 R2' U R U' R U2' R' U2' R' U2' R U2' R'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "c5p",
        "image": "cases/megaminx/full-pll/c5p.webp",
        "imageAlt": "C5+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s touching"
      }
    },
    "algs": [
      [
        {
          "alg": "R U2 R' U2 R U2 R U2 R' U R' U' R2 U2' R' U' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U R U2 R2' U R U' R U2' R' U2' R' U2' R U2' R'"
        },
        {
          "alg": "R' U2' R F U' R' U' R U F' U R' U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' R U' F U' R' U R U F' R' U2 R"
        },
        {
          "alg": "R' U2' R U L U2' R' U' R U2 L' R' U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' R L U2' R' U R U2 L' U' R' U2 R"
        }
      ]
    ]
  },
  {
    "position": 94,
    "name": "C5-",
    "subgroup": "C - 2 2x1s touching",
    "setup": "R U2 R' U bR' U R U' R' U' bR R U2' R' U",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "c5m",
        "image": "cases/megaminx/full-pll/c5m.webp",
        "imageAlt": "C5-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s touching"
      }
    },
    "algs": [
      [
        {
          "alg": "U' R U2 R' bR' U R U R' U' bR U' R U2' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2 R' U bR' U R U' R' U' bR R U2' R' U"
        },
        {
          "alg": "R U2 R' BR' U R U R' U' BR U' R U2' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2 R' U BR' U R U' R' U' BR R U2' R'"
        },
        {
          "alg": "F' R U2 R' U F R U' R' U R' F' R U' R U2' R' F",
          "source": "LowCubes / Raul Low",
          "setup": "F' R U2 R' U R' F R U' R U R' F' U' R U2' R' F"
        }
      ]
    ]
  },
  {
    "position": 95,
    "name": "C6+",
    "subgroup": "C - 2 2x1s touching",
    "setup": "R U R U R' U R U R' U2' R U' R2' U2' R U R' U",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "c6p",
        "image": "cases/megaminx/full-pll/c6p.webp",
        "imageAlt": "C6+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s touching"
      }
    },
    "algs": [
      [
        {
          "alg": "U' R U' R' U2 R2 U R' U2 R U' R' U' R U' R' U' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U R U R' U R U R' U2' R U' R2' U2' R U R' U"
        },
        {
          "alg": "R U' R' U2 R2 U R' U2 R U' R' U' R U' R' U' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U R U R' U R U R' U2' R U' R2' U2' R U R'"
        }
      ]
    ]
  },
  {
    "position": 96,
    "name": "C6-",
    "subgroup": "C - 2 2x1s touching",
    "setup": "R' U' R' U' R U' R' U' R U2 R' U R2 U2 R' U' R U",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "c6m",
        "image": "cases/megaminx/full-pll/c6m.webp",
        "imageAlt": "C6-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s touching"
      }
    },
    "algs": [
      [
        {
          "alg": "U' R' U R U2' R2' U' R U2' R' U R U R' U R U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R' U' R U' R' U' R U2 R' U R2 U2 R' U' R U"
        },
        {
          "alg": "R' U R U2' R2' U' R U2' R' U R U R' U R U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R' U' R U' R' U' R U2 R' U R2 U2 R' U' R"
        }
      ]
    ]
  },
  {
    "position": 97,
    "name": "T1",
    "subgroup": "T - 2, 3 or 4 2x1s in these patterns",
    "setup": "F R U' R' U R U R2' F' R U R U' R'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "t1",
        "image": "cases/megaminx/full-pll/t1.webp",
        "imageAlt": "T1",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s not touching"
      }
    },
    "algs": [
      [
        {
          "alg": "R U R' U' R' F R2 U' R' U' R U R' F'",
          "source": "LowCubes / Raul Low",
          "setup": "F R U' R' U R U R2' F' R U R U' R'"
        }
      ]
    ]
  },
  {
    "position": 98,
    "name": "T2+",
    "subgroup": "T - 2, 3 or 4 2x1s in these patterns",
    "setup": "R2' F R U R U' R' F' R U2' R' U2 R",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "t2p",
        "image": "cases/megaminx/full-pll/t2p.webp",
        "imageAlt": "T2+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s not touching"
      }
    },
    "algs": [
      [
        {
          "alg": "R' U2' R U2 R' F R U R' U' R' F' R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' F R U R U' R' F' R U2' R' U2 R"
        }
      ]
    ]
  },
  {
    "position": 99,
    "name": "T3+",
    "subgroup": "T - 2, 3 or 4 2x1s in these patterns",
    "setup": "R2' U2' R2 U' R2' U R2 U' R2' U2' R2 U2",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "t3p",
        "image": "cases/megaminx/full-pll/t3p.webp",
        "imageAlt": "T3+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s not touching"
      }
    },
    "algs": [
      [
        {
          "alg": "U2' R2' U2 R2 U R2' U' R2 U R2' U2 R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U2' R2 U' R2' U R2 U' R2' U2' R2 U2"
        },
        {
          "alg": "R2' U2 R2 U R2' U' R2 U R2' U2 R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U2' R2 U' R2' U R2 U' R2' U2' R2"
        }
      ]
    ]
  },
  {
    "position": 100,
    "name": "T4+",
    "subgroup": "T - 2, 3 or 4 2x1s in these patterns",
    "setup": "F R U' R' U R U R2' F' R U R' F' R U R U' R' F R U' R'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "t4p",
        "image": "cases/megaminx/full-pll/t4p.webp",
        "imageAlt": "T4+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s not touching"
      }
    },
    "algs": [
      [
        {
          "alg": "R U R' F' R U R' U' R' F R U' R' F R2 U' R' U' R U R' F'",
          "source": "LowCubes / Raul Low",
          "setup": "F R U' R' U R U R2' F' R U R' F' R U R U' R' F R U' R'"
        },
        {
          "alg": "y R U R' U2 R2 U2 R2' U R2 U2 R2' U' R U' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U R' U R2 U2' R2' U' R2 U2' R2' U2' R U' R' y'"
        },
        {
          "alg": "R U R' U R2 U2' R2' U' R2 U2' R2' U2' R U' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U R' U2 R2 U2 R2' U R2 U2 R2' U' R U' R'"
        }
      ]
    ]
  },
  {
    "position": 101,
    "name": "T2-",
    "subgroup": "T - 2, 3 or 4 2x1s in these patterns",
    "setup": "R' U2' R U2 R' F R U R' U' R' F' R2 U2'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "t2m",
        "image": "cases/megaminx/full-pll/t2m.webp",
        "imageAlt": "T2-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s not touching"
      }
    },
    "algs": [
      [
        {
          "alg": "U2 R2' F R U R U' R' F' R U2' R' U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' R U2 R' F R U R' U' R' F' R2 U2'"
        },
        {
          "alg": "R2' F R U R U' R' F' R U2' R' U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' R U2 R' F R U R' U' R' F' R2"
        },
        {
          "alg": "y R U2 R' U2' R bR' R' U' R U R bR R2'",
          "source": "LowCubes / Raul Low",
          "setup": "R2 bR' R' U' R' U R bR R' U2 R U2' R' y'"
        }
      ]
    ]
  },
  {
    "position": 102,
    "name": "T3-",
    "subgroup": "T - 2, 3 or 4 2x1s in these patterns",
    "setup": "R2 U2 R2' U R2 U' R2' U R2 U2 R2'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "t3m",
        "image": "cases/megaminx/full-pll/t3m.webp",
        "imageAlt": "T3-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s not touching"
      }
    },
    "algs": [
      [
        {
          "alg": "R2 U2' R2' U' R2 U R2' U' R2 U2' R2'",
          "source": "LowCubes / Raul Low",
          "setup": "R2 U2 R2' U R2 U' R2' U R2 U2 R2'"
        }
      ]
    ]
  },
  {
    "position": 103,
    "name": "T4-",
    "subgroup": "T - 2, 3 or 4 2x1s in these patterns",
    "setup": "R' U' R U2' R2' U2' R2 U' R2' U2' R2 U R' U R",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "t4m",
        "image": "cases/megaminx/full-pll/t4m.webp",
        "imageAlt": "T4-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s not touching"
      }
    },
    "algs": [
      [
        {
          "alg": "R' U' R U' R2' U2 R2 U R2' U2 R2 U2 R' U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R U2' R2' U2' R2 U' R2' U2' R2 U R' U R"
        },
        {
          "alg": "R' U' R U2' R2' U2' R2 U' R2' U2' R2 U R' U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R U' R2' U2 R2 U R2' U2 R2 U2 R' U R"
        }
      ]
    ]
  },
  {
    "position": 104,
    "name": "S1+",
    "subgroup": "S - 2 2x1s, not touching",
    "setup": "R' U2' R U R' U R U R U2' R' U2' R U' R' U2",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "s1p",
        "image": "cases/megaminx/full-pll/s1p.webp",
        "imageAlt": "S1+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s not touching"
      }
    },
    "algs": [
      [
        {
          "alg": "U2' R U R' U2 R U2 R' U' R' U' R U' R' U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' R U R' U R U R U2' R' U2' R U' R' U2"
        },
        {
          "alg": "R' U2' R U R' U R U R U2' R' U2' R U' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U R' U2 R U2 R' U' R' U' R U' R' U2 R"
        }
      ]
    ]
  },
  {
    "position": 105,
    "name": "S1-",
    "subgroup": "S - 2 2x1s, not touching",
    "setup": "R U2 R' U' R U' R' U' R' U2 R U2 R' U R",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "s1m",
        "image": "cases/megaminx/full-pll/s1m.webp",
        "imageAlt": "S1-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s not touching"
      }
    },
    "algs": [
      [
        {
          "alg": "R' U' R U2' R' U2' R U R U R' U R U2' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2 R' U' R U' R' U' R' U2 R U2 R' U R"
        }
      ]
    ]
  },
  {
    "position": 106,
    "name": "S2+",
    "subgroup": "S - 2 2x1s, not touching",
    "setup": "R' U' R2 U' R2' U2 R U R U2' R U R2' U2 R2 U2 R2'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "s2p",
        "image": "cases/megaminx/full-pll/s2p.webp",
        "imageAlt": "S2+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s not touching"
      }
    },
    "algs": [
      [
        {
          "alg": "R2 U2' R2' U2' R2 U' R' U2 R' U' R' U2' R2 U R2' U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R2 U' R2' U2 R U R U2' R U R2' U2 R2 U2 R2'"
        }
      ]
    ]
  },
  {
    "position": 107,
    "name": "S2-",
    "subgroup": "S - 2 2x1s, not touching",
    "setup": "R' U2 R U R U R' U' R U' R2' U2' R2 U2' R' U2' R U2 R'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "s2m",
        "image": "cases/megaminx/full-pll/s2m.webp",
        "imageAlt": "S2-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s not touching"
      }
    },
    "algs": [
      [
        {
          "alg": "R U2' R' U2 R U2 R2' U2 R2 U R' U R U' R' U' R' U2' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2 R U R U R' U' R U' R2' U2' R2 U2' R' U2' R U2 R'"
        },
        {
          "alg": "R2' U2 R2 U2 R2' U R U2' R U R U2 R2' U' R2 U' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U R2' U R2 U2' R' U' R' U2 R' U' R2 U2' R2' U2' R2"
        }
      ]
    ]
  },
  {
    "position": 108,
    "name": "S3+",
    "subgroup": "S - 2 2x1s, not touching",
    "setup": "R2 U2' R2' U2' R2 U' R' U2 R' U' R' U2' R2 U R2' U R",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "s3p",
        "image": "cases/megaminx/full-pll/s3p.webp",
        "imageAlt": "S3+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s not touching"
      }
    },
    "algs": [
      [
        {
          "alg": "R' U' R2 U' R2' U2 R U R U2' R U R2' U2 R2 U2 R2'",
          "source": "LowCubes / Raul Low",
          "setup": "R2 U2' R2' U2' R2 U' R' U2 R' U' R' U2' R2 U R2' U R"
        },
        {
          "alg": "R2 U2' R2' U' R F' R U R2' U' R' F R3 U2' R2'",
          "source": "LowCubes / Raul Low",
          "setup": "R2 U2 R3' F' R U R2 U' R' F R' U R2 U2 R2'"
        }
      ]
    ]
  },
  {
    "position": 109,
    "name": "S3-",
    "subgroup": "S - 2 2x1s, not touching",
    "setup": "R2' U2 R2 U2 R2' U R U2' R U R U2 R2' U' R2 U' R' U2",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "s3m",
        "image": "cases/megaminx/full-pll/s3m.webp",
        "imageAlt": "S3-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s not touching"
      }
    },
    "algs": [
      [
        {
          "alg": "U2' R U R2' U R2 U2' R' U' R' U2 R' U' R2 U2' R2' U2' R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U2 R2 U2 R2' U R U2' R U R U2 R2' U' R2 U' R' U2"
        },
        {
          "alg": "R' U' R U' R2' F' R U R U' R' F U R U2' R' U2' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2 R U2 R' U' F' R U R' U' R' F R2 U R' U R"
        },
        {
          "alg": "y R U R2' U R2 U2' R' U' R' U2 R' U' R2 U2' R2' U2' R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U2 R2 U2 R2' U R U2' R U R U2 R2' U' R2 U' R' y'"
        }
      ]
    ]
  },
  {
    "position": 110,
    "name": "S4+",
    "subgroup": "S - 2 2x1s, not touching",
    "setup": "R2' U2' R2 U' R2' U2' R2 U' R2' U2 R2 U R2' U2 R2 U",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "s4p",
        "image": "cases/megaminx/full-pll/s4p.webp",
        "imageAlt": "S4+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s not touching"
      }
    },
    "algs": [
      [
        {
          "alg": "U' R2' U2' R2 U' R2' U2' R2 U R2' U2 R2 U R2' U2 R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U2' R2 U' R2' U2' R2 U' R2' U2 R2 U R2' U2 R2 U"
        },
        {
          "alg": "R2' U2' R2 U' R2' U2' R2 U R2' U2 R2 U R2' U2 R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U2' R2 U' R2' U2' R2 U' R2' U2 R2 U R2' U2 R2"
        },
        {
          "alg": "y' R2' U2 R2 U' bR2' U R2' U R2 U' bR2 R2' U2' R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U2 R2 bR2' U R2' U' R2 U' bR2 U R2' U2' R2 y"
        }
      ]
    ]
  },
  {
    "position": 111,
    "name": "S4-",
    "subgroup": "S - 2 2x1s, not touching",
    "setup": "R2' U2 R2 U R2' U2 R2 U R2' U2' R2 U' R2' U2' R2 U",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "s4m",
        "image": "cases/megaminx/full-pll/s4m.webp",
        "imageAlt": "S4-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s not touching"
      }
    },
    "algs": [
      [
        {
          "alg": "U' R2' U2 R2 U R2' U2 R2 U' R2' U2' R2 U' R2' U2' R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U2 R2 U R2' U2 R2 U R2' U2' R2 U' R2' U2' R2 U"
        },
        {
          "alg": "R2' U2 R2 U R2' U2 R2 U' R2' U2' R2 U' R2' U2' R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U2 R2 U R2' U2 R2 U R2' U2' R2 U' R2' U2' R2"
        },
        {
          "alg": "y R2 U2' R2' U F2 U' R2 U' R2' U F2' R2 U2 R2'",
          "source": "LowCubes / Raul Low",
          "setup": "R2 U2' R2' F2 U' R2 U R2' U F2' U' R2 U2 R2' y'"
        }
      ]
    ]
  },
  {
    "position": 112,
    "name": "S5+",
    "subgroup": "S - 2 2x1s, not touching",
    "setup": "R' U2' R U L U2' R' U' R U2 L' R' U2 R U'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "s5p",
        "image": "cases/megaminx/full-pll/s5p.webp",
        "imageAlt": "S5+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s not touching"
      }
    },
    "algs": [
      [
        {
          "alg": "U R' U2' R L U2' R' U R U2 L' U' R' U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' R U L U2' R' U' R U2 L' R' U2 R U'"
        },
        {
          "alg": "R' U2' R U' F U' R' U R U F' R' U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' R F U' R' U' R U F' U R' U2 R"
        },
        {
          "alg": "R' U2' R L U2' R' U R U2 L' U' R' U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' R U L U2' R' U' R U2 L' R' U2 R"
        }
      ]
    ]
  },
  {
    "position": 113,
    "name": "S5-",
    "subgroup": "S - 2 2x1s, not touching",
    "setup": "R' U2' R U2' R' U2' R' U2' R U' R U R2' U2 R U R U'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "s5m",
        "image": "cases/megaminx/full-pll/s5m.webp",
        "imageAlt": "S5-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s not touching"
      }
    },
    "algs": [
      [
        {
          "alg": "U R' U' R' U2' R2 U' R' U R' U2 R U2 R U2 R' U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' R U2' R' U2' R' U2' R U' R U R2' U2 R U R U'"
        },
        {
          "alg": "R U2 R' U BR' U R U' R' U' BR R U2' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2 R' BR' U R U R' U' BR U' R U2' R'"
        },
        {
          "alg": "F' R U2 R' U R' F R U' R U R' F' U' R U2' R' F",
          "source": "LowCubes / Raul Low",
          "setup": "F' R U2 R' U F R U' R' U R' F' R U' R U2' R' F"
        }
      ]
    ]
  },
  {
    "position": 114,
    "name": "S6+",
    "subgroup": "S - 2 2x1s, not touching",
    "setup": "R U' R' U2 R2 U R' U2 R U' R' U' R U' R' U' R' U'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "s6p",
        "image": "cases/megaminx/full-pll/s6p.webp",
        "imageAlt": "S6+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s not touching"
      }
    },
    "algs": [
      [
        {
          "alg": "U R U R U R' U R U R' U2' R U' R2' U2' R U R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U' R' U2 R2 U R' U2 R U' R' U' R U' R' U' R' U'"
        },
        {
          "alg": "R U R U R' U R U R' U2' R U' R2' U2' R U R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U' R' U2 R2 U R' U2 R U' R' U' R U' R' U' R'"
        }
      ]
    ]
  },
  {
    "position": 115,
    "name": "S6-",
    "subgroup": "S - 2 2x1s, not touching",
    "setup": "R' U R U2' R2' U' R U2' R' U R U R' U R U R U2'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "s6m",
        "image": "cases/megaminx/full-pll/s6m.webp",
        "imageAlt": "S6-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1s not touching"
      }
    },
    "algs": [
      [
        {
          "alg": "U2 R' U' R' U' R U' R' U' R U2 R' U R2 U2 R' U' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U R U2' R2' U' R U2' R' U R U R' U R U R U2'"
        },
        {
          "alg": "R' U' R' U' R U' R' U' R U2 R' U R2 U2 R' U' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U R U2' R2' U' R U2' R' U R U R' U R U R"
        },
        {
          "alg": "y2 R U R2' F' R U2' R U2 R' F R U' R2' U' R U' R' U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' R U R' U R2 U R' F' R U2' R' U2 R' F R2 U' R' y2'"
        }
      ]
    ]
  },
  {
    "position": 116,
    "name": "G1+",
    "subgroup": "G - 2x1 and headlights",
    "setup": "R' U2 R2 U2' R2' U' R U2' R' U' R U2' R U2 R2' U2' R",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "g1p",
        "image": "cases/megaminx/full-pll/g1p.webp",
        "imageAlt": "G1+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1"
      }
    },
    "algs": [
      [
        {
          "alg": "R' U2 R2 U2' R' U2 R' U R U2 R' U R2 U2 R2' U2' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2 R2 U2' R2' U' R U2' R' U' R U2' R U2 R2' U2' R"
        }
      ]
    ]
  },
  {
    "position": 117,
    "name": "G1-",
    "subgroup": "G - 2x1 and headlights",
    "setup": "R U2' R2' U2 R2 U R' U2 R U R' U2 R' U2' R2 U2 R' U'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "g1m",
        "image": "cases/megaminx/full-pll/g1m.webp",
        "imageAlt": "G1-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1"
      }
    },
    "algs": [
      [
        {
          "alg": "U R U2' R2' U2 R U2' R U' R' U2' R U' R2' U2' R2 U2 R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2' R2' U2 R2 U R' U2 R U R' U2 R' U2' R2 U2 R' U'"
        },
        {
          "alg": "R U2' R2' U2 R U2' R U' R' U2' R U' R2' U2' R2 U2 R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2' R2' U2 R2 U R' U2 R U R' U2 R' U2' R2 U2 R'"
        }
      ]
    ]
  },
  {
    "position": 118,
    "name": "G2+",
    "subgroup": "G - 2x1 and headlights",
    "setup": "R' U2 R L U' R' U L' U2' R2 U2 R' U R U2 R'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "g2p",
        "image": "cases/megaminx/full-pll/g2p.webp",
        "imageAlt": "G2+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1"
      }
    },
    "algs": [
      [
        {
          "alg": "R U2' R' U' R U2' R2' U2 L U' R U L' R' U2' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2 R L U' R' U L' U2' R2 U2 R' U R U2 R'"
        },
        {
          "alg": "R U' R2' U' F U F' R2 U2' R' U R U2 R' F U' F'",
          "source": "LowCubes / Raul Low",
          "setup": "F U F' R U2' R' U' R U2 R2' F U' F' U R2 U R'"
        },
        {
          "alg": "y R' U2 R L U' R' U L' U2' R2 U2 R' U R U2 R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2' R' U' R U2' R2' U2 L U' R U L' R' U2' R y'"
        }
      ]
    ]
  },
  {
    "position": 119,
    "name": "G2-",
    "subgroup": "G - 2x1 and headlights",
    "setup": "F U2' R' U2 R U F' R' U R F R' U R U2 F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "g2m",
        "image": "cases/megaminx/full-pll/g2m.webp",
        "imageAlt": "G2-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1"
      }
    },
    "algs": [
      [
        {
          "alg": "F U2' R' U' R F' R' U' R F U' R' U2' R U2 F'",
          "source": "LowCubes / Raul Low",
          "setup": "F U2' R' U2 R U F' R' U R F R' U R U2 F'"
        }
      ]
    ]
  },
  {
    "position": 120,
    "name": "I1+",
    "subgroup": "I - 2x1",
    "setup": "R2' U' F2 U' R2 U' R2' U F2' R2 U' R2' U2' R2",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "i1p",
        "image": "cases/megaminx/full-pll/i1p.webp",
        "imageAlt": "I1+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1"
      }
    },
    "algs": [
      [
        {
          "alg": "R2' U2 R2 U R2' F2 U' R2 U R2' U F2' U R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U' F2 U' R2 U' R2' U F2' R2 U' R2' U2' R2"
        },
        {
          "alg": "R U2 R' U R' U' R U F' R U R' U' R' F U R2 U R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U' R2' U' F' R U R U' R' F U' R' U R U' R U2' R'"
        }
      ]
    ]
  },
  {
    "position": 121,
    "name": "I1-",
    "subgroup": "I - 2x1",
    "setup": "R' U' bR U' R U2' R' U2' bR' R' U' R U' R' U2 R U R U",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "i1m",
        "image": "cases/megaminx/full-pll/i1m.webp",
        "imageAlt": "I1-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1"
      }
    },
    "algs": [
      [
        {
          "alg": "U' R' U' R' U2' R U R' U R bR U2 R U2 R' U bR' U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' bR U' R U2' R' U2' bR' R' U' R U' R' U2 R U R U"
        },
        {
          "alg": "R2 U2' R2' U' R2 bR2' U R2' U' R2 U' bR2 U' R2'",
          "source": "LowCubes / Raul Low",
          "setup": "R2 U bR2' U R2' U R2 U' bR2 R2' U R2 U2 R2'"
        }
      ]
    ]
  },
  {
    "position": 122,
    "name": "I2+",
    "subgroup": "I - 2x1",
    "setup": "R2' U2 R2 U R2' F2 U' R2 U R2' U F2' U R2",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "i2p",
        "image": "cases/megaminx/full-pll/i2p.webp",
        "imageAlt": "I2+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1"
      }
    },
    "algs": [
      [
        {
          "alg": "R2' U' F2 U' R2 U' R2' U F2' R2 U' R2' U2' R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U2 R2 U R2' F2 U' R2 U R2' U F2' U R2"
        },
        {
          "alg": "R U' R2' U' F' R U R U' R' F U' R' U R U' R U2' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2 R' U R' U' R U F' R U R' U' R' F U R2 U R'"
        }
      ]
    ]
  },
  {
    "position": 123,
    "name": "I2-",
    "subgroup": "I - 2x1",
    "setup": "U' R' U' R' U2' R U R' U R bR U2 R U2 R' U bR' U R U2",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "i2m",
        "image": "cases/megaminx/full-pll/i2m.webp",
        "imageAlt": "I2-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1"
      }
    },
    "algs": [
      [
        {
          "alg": "U2' R' U' bR U' R U2' R' U2' bR' R' U' R U' R' U2 R U R U",
          "source": "LowCubes / Raul Low",
          "setup": "U' R' U' R' U2' R U R' U R bR U2 R U2 R' U bR' U R U2"
        },
        {
          "alg": "R2 U bR2' U R2' U R2 U' bR2 R2' U R2 U2 R2'",
          "source": "LowCubes / Raul Low",
          "setup": "R2 U2' R2' U' R2 bR2' U R2' U' R2 U' bR2 U' R2'"
        }
      ]
    ]
  },
  {
    "position": 124,
    "name": "I3+",
    "subgroup": "I - 2x1",
    "setup": "R2' U2 R2 U2 R2' U R2 y U2' R2 U2 R2' U' R2 U' R2' U'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "i3p",
        "image": "cases/megaminx/full-pll/i3p.webp",
        "imageAlt": "I3+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1"
      }
    },
    "algs": [
      [
        {
          "alg": "U R2 U R2' U R2 U2' R2' U2 y' R2' U' R2 U2' R2' U2' R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U2 R2 U2 R2' U R2 y U2' R2 U2 R2' U' R2 U' R2' U'"
        },
        {
          "alg": "R' U2 R2 U2 R' U2' R' U2' R U2 R U R' U2' R U' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U R' U2 R U' R' U2' R' U2 R U2 R U2' R2' U2' R"
        },
        {
          "alg": "y' R2 U R2' U R2 U2' R2' U2 y' R2' U' R2 U2' R2' U2' R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U2 R2 U2 R2' U R2 y U2' R2 U2 R2' U' R2 U' R2' y"
        }
      ]
    ]
  },
  {
    "position": 125,
    "name": "I3-",
    "subgroup": "I - 2x1",
    "setup": "R2' U' R2 U' R2' U2 R2 y U2' R2 U R2' U2 R2 U2 R2' U",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "i3m",
        "image": "cases/megaminx/full-pll/i3m.webp",
        "imageAlt": "I3-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1"
      }
    },
    "algs": [
      [
        {
          "alg": "U' R2 U2' R2' U2' R2 U' R2' U2 y' R2' U2' R2 U R2' U R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U' R2 U' R2' U2 R2 y U2' R2 U R2' U2 R2 U2 R2' U"
        },
        {
          "alg": "R U2' R2' U2' R U2 R U2 R' U2' R' U' R U2 R' U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R U2' R' U R U2 R U2' R' U2' R' U2 R2 U2 R'"
        },
        {
          "alg": "y R2' U' R2 U' R2' U2 R2 U2' y R2 U R2' U2 R2 U2 R2'",
          "source": "LowCubes / Raul Low",
          "setup": "R2 U2' R2' U2' R2 U' R2' y' U2 R2' U2' R2 U R2' U R2 y'"
        }
      ]
    ]
  },
  {
    "position": 126,
    "name": "I4+",
    "subgroup": "I - 2x1",
    "setup": "R' U' R' U2' R F' R U R' U' R' F U2 R U R U2'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "i4p",
        "image": "cases/megaminx/full-pll/i4p.webp",
        "imageAlt": "I4+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1"
      }
    },
    "algs": [
      [
        {
          "alg": "U2 R' U' R' U2' F' R U R U' R' F R' U2 R U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R' U2' R F' R U R' U' R' F U2 R U R U2'"
        },
        {
          "alg": "R' U' R' U2' F' R U R U' R' F R' U2 R U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R' U2' R F' R U R' U' R' F U2 R U R"
        },
        {
          "alg": "y' R U2' R' U' R U' R U2 R' U' R U' R2' U R U2' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2 R' U' R2 U R' U R U2' R' U R' U R U2 R' y"
        }
      ]
    ]
  },
  {
    "position": 127,
    "name": "I4-",
    "subgroup": "I - 2x1",
    "setup": "R' U2' R U R2' U' R U' R' U2 R U' R U' R' U2' R U2'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "i4m",
        "image": "cases/megaminx/full-pll/i4m.webp",
        "imageAlt": "I4-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1"
      }
    },
    "algs": [
      [
        {
          "alg": "U2 R' U2 R U R' U R' U2' R U R' U R2 U' R' U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' R U R2' U' R U' R' U2 R U' R U' R' U2' R U2'"
        },
        {
          "alg": "R' U2 R U R' U R' U2' R U R' U R2 U' R' U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' R U R2' U' R U' R' U2 R U' R U' R' U2' R"
        }
      ]
    ]
  },
  {
    "position": 128,
    "name": "I5+",
    "subgroup": "I - 2x1",
    "setup": "R' U' R' U2' F' R U R U' R' F R' U2 R U R U2'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "i5p",
        "image": "cases/megaminx/full-pll/i5p.webp",
        "imageAlt": "I5+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1"
      }
    },
    "algs": [
      [
        {
          "alg": "U2 R' U' R' U2' R F' R U R' U' R' F U2 R U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R' U2' F' R U R U' R' F R' U2 R U R U2'"
        },
        {
          "alg": "R' U' R' U2' R F' R U R' U' R' F U2 R U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R' U2' F' R U R U' R' F R' U2 R U R"
        },
        {
          "alg": "R U2 R' U' R2 U R' U R U2' R' U R' U R U2 R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2' R' U' R U' R U2 R' U' R U' R2' U R U2' R'"
        }
      ]
    ]
  },
  {
    "position": 129,
    "name": "I5-",
    "subgroup": "I - 2x1",
    "setup": "R' U2 R U R' U R' U2' R U R' U R2 U' R' U2 R U'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "i5m",
        "image": "cases/megaminx/full-pll/i5m.webp",
        "imageAlt": "I5-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1"
      }
    },
    "algs": [
      [
        {
          "alg": "U R' U2' R U R2' U' R U' R' U2 R U' R U' R' U2' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2 R U R' U R' U2' R U R' U R2 U' R' U2 R U'"
        },
        {
          "alg": "R' U2' R U R2' U' R U' R' U2 R U' R U' R' U2' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2 R U R' U R' U2' R U R' U R2 U' R' U2 R"
        }
      ]
    ]
  },
  {
    "position": 130,
    "name": "I6+",
    "subgroup": "I - 2x1",
    "setup": "R2 U' R2' U R U R' U R U R2 U R' U2 R U2 R2' U2 R' U",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "i6p",
        "image": "cases/megaminx/full-pll/i6p.webp",
        "imageAlt": "I6+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1"
      }
    },
    "algs": [
      [
        {
          "alg": "U' R U2' R2 U2' R' U2' R U' R2' U' R' U' R U' R' U' R2 U R2'",
          "source": "LowCubes / Raul Low",
          "setup": "R2 U' R2' U R U R' U R U R2 U R' U2 R U2 R2' U2 R' U"
        },
        {
          "alg": "x' R2 U2' R2' F' R2 U2 R2' F2 R2 U2' R2' F' R2 U2 R2'",
          "source": "LowCubes / Raul Low",
          "setup": "R2 U2' R2' F R2 U2 R2' F2' R2 U2' R2' F R2 U2 R2' x"
        },
        {
          "alg": "y2' F R U2 R' U' R U' R' F' U R' U' R U2' R' U R U R' U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R U' R' U' R U2 R' U R U' F R U R' U R U2' R' F' y2"
        }
      ]
    ]
  },
  {
    "position": 131,
    "name": "I6-",
    "subgroup": "I - 2x1",
    "setup": "R' U2 R2' U2 R U2 R' U R2 U R U R' U R U R2' U' R2 U'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "i6m",
        "image": "cases/megaminx/full-pll/i6m.webp",
        "imageAlt": "I6-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "2x1"
      }
    },
    "algs": [
      [
        {
          "alg": "U R2' U R2 U' R' U' R U' R' U' R2' U' R U2' R' U2' R2 U2' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2 R2' U2 R U2 R' U R2 U R U R' U R U R2' U' R2 U'"
        },
        {
          "alg": "R2' F2 R2 U' R2' F2' R2 U2 R2' F2 R2 U' R2' F2' R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' F2 R2 U R2' F2' R2 U2' R2' F2 R2 U R2' F2' R2"
        },
        {
          "alg": "y2' R2' F2 R2 U R2' F2' R2 U2' R2' F2 R2 U R2' F2' R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' F2 R2 U' R2' F2' R2 U2 R2' F2 R2 U' R2' F2' R2 y2"
        },
        {
          "alg": "BR' R' U2' R U R' U R BR U' R U R' U2 R U' R' U' R U' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U R' U R U R' U2' R U' R' U BR' R' U' R U' R' U2 R BR"
        }
      ]
    ]
  },
  {
    "position": 132,
    "name": "L1",
    "subgroup": "L - Double headlights",
    "setup": "R U2 R' U' R U' R' U R' U2' R U R' U' R U' R' U2' R",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "l1",
        "image": "cases/megaminx/full-pll/l1.webp",
        "imageAlt": "L1",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "No blocks"
      }
    },
    "algs": [
      [
        {
          "alg": "R' U2 R U R' U R U' R' U2 R U' R U R' U R U2' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2 R' U' R U' R' U R' U2' R U R' U' R U' R' U2' R"
        }
      ]
    ]
  },
  {
    "position": 133,
    "name": "L2",
    "subgroup": "L - Double headlights",
    "setup": "R' U2' R U' R' U R U R' U R2 U R' U R U R' U' R U2' R'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "l2",
        "image": "cases/megaminx/full-pll/l2.webp",
        "imageAlt": "L2",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "No blocks"
      }
    },
    "algs": [
      [
        {
          "alg": "R U2 R' U R U' R' U' R U' R2' U' R U' R' U' R U R' U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' R U' R' U R U R' U R2 U R' U R U R' U' R U2' R'"
        },
        {
          "alg": "R' U2' R U' R' U R U R' U R2 U R' U R U R' U' R U2' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2 R' U R U' R' U' R U' R2' U' R U' R' U' R U R' U2 R"
        }
      ]
    ]
  },
  {
    "position": 134,
    "name": "L3+",
    "subgroup": "L - Double headlights",
    "setup": "F U2' F' U2' R F R' U' R F' U2' R' U' R U2' R' U'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "l3p",
        "image": "cases/megaminx/full-pll/l3p.webp",
        "imageAlt": "L3+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "No blocks"
      }
    },
    "algs": [
      [
        {
          "alg": "U R U2 R' U R U2 F R' U R F' R' U2 F U2 F'",
          "source": "LowCubes / Raul Low",
          "setup": "F U2' F' U2' R F R' U' R F' U2' R' U' R U2' R' U'"
        },
        {
          "alg": "F U2' F' U2' R F R' U' R F' U2' R' U' R U2' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2 R' U R U2 F R' U R F' R' U2 F U2 F'"
        }
      ]
    ]
  },
  {
    "position": 135,
    "name": "L3-",
    "subgroup": "L - Double headlights",
    "setup": "R' U2' R U' R' U2' bR' R U' R' bR R y U2' R' U2' R U2'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "l3m",
        "image": "cases/megaminx/full-pll/l3m.webp",
        "imageAlt": "L3-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "No blocks"
      }
    },
    "algs": [
      [
        {
          "alg": "U2 R' U2 R U2 y' R' bR' R U R' bR U2 R U R' U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' R U' R' U2' bR' R U' R' bR R y U2' R' U2' R U2'"
        },
        {
          "alg": "R U R' U' R' U2 R U R U R2' U R U' R U R' U' R U2' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2 R' U R U' R' U R' U' R2 U' R' U' R' U2' R U R U' R'"
        },
        {
          "alg": "y2' R' U2 R U2 F' R' y' R U R' bR U2 R U R' U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' R U' R' U2' bR' R U' R' y R F U2' R' U2' R y2"
        }
      ]
    ]
  },
  {
    "position": 136,
    "name": "L4+",
    "subgroup": "L - Double headlights",
    "setup": "R U2' R' U R U2 R U2 R' U R' U' R U' R U' R' U' R' U'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "l4p",
        "image": "cases/megaminx/full-pll/l4p.webp",
        "imageAlt": "L4+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "No blocks"
      }
    },
    "algs": [
      [
        {
          "alg": "U R U R U R' U R' U R U' R U2' R' U2' R' U' R U2 R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2' R' U R U2 R U2 R' U R' U' R U' R U' R' U' R' U'"
        },
        {
          "alg": "R U R U R' U R' U R U' R U2' R' U2' R' U' R U2 R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2' R' U R U2 R U2 R' U R' U' R U' R U' R' U' R'"
        },
        {
          "alg": "y2 R' U2 R U' R' U2' R' U2' R U' R U R' U R' U R U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R' U' R U' R U' R' U R' U2 R U2 R U R' U2' R y2'"
        }
      ]
    ]
  },
  {
    "position": 137,
    "name": "L4-",
    "subgroup": "L - Double headlights",
    "setup": "R U R U R' U R' U R U' R U2' R' U2' R' U' R U2 R' U",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "l4m",
        "image": "cases/megaminx/full-pll/l4m.webp",
        "imageAlt": "L4-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "No blocks"
      }
    },
    "algs": [
      [
        {
          "alg": "U' R U2' R' U R U2 R U2 R' U R' U' R U' R U' R' U' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U R U R' U R' U R U' R U2' R' U2' R' U' R U2 R' U"
        },
        {
          "alg": "R U2' R' U R U2 R U2 R' U R' U' R U' R U' R' U' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U R U R' U R' U R U' R U2' R' U2' R' U' R U2 R'"
        },
        {
          "alg": "y2 R' U' R' U' R U' R U' R' U R' U2 R U2 R U R' U2' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2 R U' R' U2' R' U2' R U' R U R' U R' U R U R y2'"
        }
      ]
    ]
  },
  {
    "position": 138,
    "name": "L5+",
    "subgroup": "L - Double headlights",
    "setup": "R U R' U2 R U' R' U R U2 R2' U' R U' R' U2 R U",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "l5p",
        "image": "cases/megaminx/full-pll/l5p.webp",
        "imageAlt": "L5+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "No blocks"
      }
    },
    "algs": [
      [
        {
          "alg": "U' R' U2' R U R' U R2 U2' R' U' R U R' U2' R U' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U R' U2 R U' R' U R U2 R2' U' R U' R' U2 R U"
        },
        {
          "alg": "R' U2' R U R' U R2 U2' R' U' R U R' U2' R U' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U R' U2 R U' R' U R U2 R2' U' R U' R' U2 R"
        }
      ]
    ]
  },
  {
    "position": 139,
    "name": "L5-",
    "subgroup": "L - Double headlights",
    "setup": "R' U' R U2' R' U R U' R' U2' R2 U R' U R U2' R' U2",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "l5m",
        "image": "cases/megaminx/full-pll/l5m.webp",
        "imageAlt": "L5-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "No blocks"
      }
    },
    "algs": [
      [
        {
          "alg": "U2' R U2 R' U' R U' R2' U2 R U R' U' R U2 R' U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R U2' R' U R U' R' U2' R2 U R' U R U2' R' U2"
        },
        {
          "alg": "R U2 R' U' R U' R2' U2 R U R' U' R U2 R' U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R U2' R' U R U' R' U2' R2 U R' U R U2' R'"
        }
      ]
    ]
  },
  {
    "position": 140,
    "name": "L6+",
    "subgroup": "L - Double headlights",
    "setup": "R' U2' R U R' U R2 U2' R' U' R U R' U2' R U' R' U2",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "l6p",
        "image": "cases/megaminx/full-pll/l6p.webp",
        "imageAlt": "L6+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "No blocks"
      }
    },
    "algs": [
      [
        {
          "alg": "U2' R U R' U2 R U' R' U R U2 R2' U' R U' R' U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' R U R' U R2 U2' R' U' R U R' U2' R U' R' U2"
        },
        {
          "alg": "R U R' U2 R U' R' U R U2 R2' U' R U' R' U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' R U R' U R2 U2' R' U' R U R' U2' R U' R'"
        }
      ]
    ]
  },
  {
    "position": 141,
    "name": "L6-",
    "subgroup": "L - Double headlights",
    "setup": "R U2 R' U' R U' R2' U2 R U R' U' R U2 R' U R U",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "l6m",
        "image": "cases/megaminx/full-pll/l6m.webp",
        "imageAlt": "L6-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "No blocks"
      }
    },
    "algs": [
      [
        {
          "alg": "U' R' U' R U2' R' U R U' R' U2' R2 U R' U R U2' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2 R' U' R U' R2' U2 R U R' U' R U2 R' U R U"
        },
        {
          "alg": "R' U' R U2' R' U R U' R' U2' R2 U R' U R U2' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2 R' U' R U' R2' U2 R U R' U' R U2 R' U R"
        }
      ]
    ]
  },
  {
    "position": 142,
    "name": "X1",
    "subgroup": "X - No blocks or headlights",
    "setup": "R' U2 R U2 R' U R F U2 R U' R' U' R U2 R' U2' F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "x1",
        "image": "cases/megaminx/full-pll/x1.webp",
        "imageAlt": "X1",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "No blocks"
      }
    },
    "algs": [
      [
        {
          "alg": "F U2 R U2' R' U R U R' U2' F' R' U' R U2' R' U2' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2 R U2 R' U R F U2 R U' R' U' R U2 R' U2' F'"
        }
      ]
    ]
  },
  {
    "position": 143,
    "name": "X2",
    "subgroup": "X - No blocks or headlights",
    "setup": "F R U2 R2' U' F U R U' F' R U' R' F'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "x2",
        "image": "cases/megaminx/full-pll/x2.webp",
        "imageAlt": "X2",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "No blocks"
      }
    },
    "algs": [
      [
        {
          "alg": "F R U R' F U R' U' F' U R2 U2' R' F'",
          "source": "LowCubes / Raul Low",
          "setup": "F R U2 R2' U' F U R U' F' R U' R' F'"
        }
      ]
    ]
  },
  {
    "position": 144,
    "name": "X3",
    "subgroup": "X - No blocks or headlights",
    "setup": "R' U' R U2' R U R2' U2 R U2' R U' R2' U2' R U R' U R",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "x3",
        "image": "cases/megaminx/full-pll/x3.webp",
        "imageAlt": "X3",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "No blocks"
      }
    },
    "algs": [
      [
        {
          "alg": "R' U' R U' R' U2 R2 U R' U2 R' U2' R2 U' R' U2 R' U R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U' R U2' R U R2' U2 R U2' R U' R2' U2' R U R' U R"
        },
        {
          "alg": "y2' R2 U R2' U R U2' R' U R' U2' R U R' U R2 U R U' R2'",
          "source": "LowCubes / Raul Low",
          "setup": "R2 U R' U' R2' U' R U' R' U2 R U' R U2 R' U' R2 U' R2' y2"
        },
        {
          "alg": "y' R U R2' U2 R2 U2 R2' y' R' U' R U2 R' U' R U bR",
          "source": "LowCubes / Raul Low",
          "setup": "bR' U' R' U R U2' R' U R y R2 U2' R2' U2' R2 U' R' y"
        }
      ]
    ]
  },
  {
    "position": 145,
    "name": "X4",
    "subgroup": "X - No blocks or headlights",
    "setup": "R' U2' R2 U' R' U R U' R2' U R2 U R' U' R U R2' U R",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "x4",
        "image": "cases/megaminx/full-pll/x4.webp",
        "imageAlt": "X4",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "No blocks"
      }
    },
    "algs": [
      [
        {
          "alg": "R' U' R2 U' R' U R U' R2' U' R2 U R' U' R U R2' U2 R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2' R2 U' R' U R U' R2' U R2 U R' U' R U R2' U R"
        }
      ]
    ]
  },
  {
    "position": 146,
    "name": "X5+",
    "subgroup": "X - No blocks or headlights",
    "setup": "R2' U' R U2' R' U R U R' U R2 U' R' U2' R U2' R' U' R",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "x5p",
        "image": "cases/megaminx/full-pll/x5p.webp",
        "imageAlt": "X5+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "No blocks"
      }
    },
    "algs": [
      [
        {
          "alg": "R' U R U2 R' U2 R U R2' U' R U' R' U' R U2 R' U R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U' R U2' R' U R U R' U R2 U' R' U2' R U2' R' U' R"
        },
        {
          "alg": "y2 R2 U R' U2 R U' R' U' R U' R2' U R U2 R' U2 R U R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U' R' U2' R U2' R' U' R2 U R' U R U R' U2' R U' R2' y2'"
        }
      ]
    ]
  },
  {
    "position": 147,
    "name": "X5-",
    "subgroup": "X - No blocks or headlights",
    "setup": "R' U R U2 R' U2 R U R2' U' R U' R' U' R U2 R' U R2",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "x5m",
        "image": "cases/megaminx/full-pll/x5m.webp",
        "imageAlt": "X5-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "No blocks"
      }
    },
    "algs": [
      [
        {
          "alg": "R2' U' R U2' R' U R U R' U R2 U' R' U2' R U2' R' U' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U R U2 R' U2 R U R2' U' R U' R' U' R U2 R' U R2"
        },
        {
          "alg": "y2' R U' R' U2' R U2' R' U' R2 U R' U R U R' U2' R U' R2'",
          "source": "LowCubes / Raul Low",
          "setup": "R2 U R' U2 R U' R' U' R U' R2' U R U2 R' U2 R U R' y2"
        }
      ]
    ]
  },
  {
    "position": 148,
    "name": "X6+",
    "subgroup": "X - No blocks or headlights",
    "setup": "R' U2 R U R2' U' R U' R U' R' U R U R2' U R U2' R U2",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "x6p",
        "image": "cases/megaminx/full-pll/x6p.webp",
        "imageAlt": "X6+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "No blocks"
      }
    },
    "algs": [
      [
        {
          "alg": "U2' R' U2 R' U' R2 U' R' U' R U R' U R' U R2 U' R' U2' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2 R U R2' U' R U' R U' R' U R U R2' U R U2' R U2"
        },
        {
          "alg": "R' U2 R' U' R2 U' R' U' R U R' U R' U R2 U' R' U2' R",
          "source": "LowCubes / Raul Low",
          "setup": "R' U2 R U R2' U' R U' R U' R' U R U R2' U R U2' R"
        },
        {
          "alg": "y2' F R U R' U' R U' R2' U' F' U' F U2 R U' R U R' F'",
          "source": "LowCubes / Raul Low",
          "setup": "F R U' R' U R' U2' F' U F U R2 U R' U R U' R' F' y2"
        }
      ]
    ]
  },
  {
    "position": 149,
    "name": "X6-",
    "subgroup": "X - No blocks or headlights",
    "setup": "R U2' R' U' R2 U R' U R' U R U' R' U' R2 U' R' U2 R'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "x6m",
        "image": "cases/megaminx/full-pll/x6m.webp",
        "imageAlt": "X6-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "No blocks"
      }
    },
    "algs": [
      [
        {
          "alg": "R U2' R U R2' U R U R' U' R U' R U' R2' U R U2 R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U2' R' U' R2 U R' U R' U R U' R' U' R2 U' R' U2 R'"
        }
      ]
    ]
  },
  {
    "position": 150,
    "name": "X7+",
    "subgroup": "X - No blocks or headlights",
    "setup": "R2 U' R2' U' F U F' R2 U2' R2' U R2 U2 R2' y' R U' R'",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "x7p",
        "image": "cases/megaminx/full-pll/x7p.webp",
        "imageAlt": "X7+",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "No blocks"
      }
    },
    "algs": [
      [
        {
          "alg": "R U R' y R2 U2' R2' U' R2 U2 R2' F U' F' U R2 U R2'",
          "source": "LowCubes / Raul Low",
          "setup": "R2 U' R2' U' F U F' R2 U2' R2' U R2 U2 R2' y' R U' R'"
        },
        {
          "alg": "R2 U' R2' U' F U F' R2 U2' R2' U R2 U2 R2' F U' F'",
          "source": "LowCubes / Raul Low",
          "setup": "F U F' R2 U2' R2' U' R2 U2 R2' F U' F' U R2 U R2'"
        },
        {
          "alg": "R U R' U' F' U' F U R U R' U R U2' F R' F' R U R U' R2'",
          "source": "LowCubes / Raul Low",
          "setup": "R2 U R' U' R' F R F' U2 R' U' R U' R' U' F' U F U R U' R'"
        }
      ]
    ]
  },
  {
    "position": 151,
    "name": "X7-",
    "subgroup": "X - No blocks or headlights",
    "setup": "R2' U R2 U bR' U' bR R2' U2 R2 U' R2' U2' R2 bR' U bR",
    "sticker": {
      "kind": "raw",
      "tag": "lowcubes-megaminx",
      "attrs": {
        "slug": "x7m",
        "image": "cases/megaminx/full-pll/x7m.webp",
        "imageAlt": "X7-",
        "imageWidth": "300",
        "imageHeight": "303",
        "groupParent": "No blocks"
      }
    },
    "algs": [
      [
        {
          "alg": "bR' U' bR R2' U2 R2 U R2' U2' R2 bR' U bR U' R2' U' R2",
          "source": "LowCubes / Raul Low",
          "setup": "R2' U R2 U bR' U' bR R2' U2 R2 U' R2' U2' R2 bR' U bR"
        },
        {
          "alg": "R U R2' F' R U2' R U' R' U2' R' F R U R U R' U2' R U' R'",
          "source": "LowCubes / Raul Low",
          "setup": "R U R' U2 R U' R' U' R' F' R U2 R U R' U2 R' F R2 U' R'"
        }
      ]
    ]
  }
]$lowcubes_megaminx_full_pll$::jsonb AS body
)
INSERT INTO alg_cases (puzzle, set_slug, position, name, subgroup, setup, sticker, algs)
SELECT
  'megaminx',
  'full-pll',
  (item ->> 'position')::integer,
  item ->> 'name',
  item ->> 'subgroup',
  item ->> 'setup',
  item -> 'sticker',
  item -> 'algs'
FROM payload
CROSS JOIN LATERAL jsonb_array_elements(payload.body) AS entry(item)
WHERE NOT EXISTS (
  SELECT 1
  FROM alg_cases existing
  WHERE existing.puzzle = 'megaminx'
    AND existing.set_slug = 'full-pll'
    AND existing.name = item ->> 'name'
);

-- Fail the migration atomically if the imported snapshot is incomplete or malformed.
DO $lowcubes_validate$
DECLARE
  expected RECORD;
  actual_cases BIGINT;
  actual_algs BIGINT;
  actual_min INTEGER;
  actual_max INTEGER;
  actual_distinct_positions BIGINT;
  actual_group_cases BIGINT;
  bad_rows BIGINT;
BEGIN
  FOR expected IN
    SELECT * FROM (VALUES
        ('fto', 'pf', 10, 10, 0, 9),
        ('fto', 'tl', 5, 5, 0, 4),
        ('fto', 'lt', 3, 3, 0, 2),
        ('fto', 'tcp', 18, 29, 0, 17),
        ('fto', '1l3t', 180, 251, 1, 180),
        ('megaminx', 'full-pll', 151, 326, 1, 151)
    ) AS v(puzzle, set_slug, case_count, alg_count, min_position, max_position)
  LOOP
    SELECT COUNT(*), MIN(position), MAX(position), COUNT(DISTINCT position)
    INTO actual_cases, actual_min, actual_max, actual_distinct_positions
    FROM alg_cases
    WHERE puzzle = expected.puzzle AND set_slug = expected.set_slug;

    SELECT COUNT(*)
    INTO actual_algs
    FROM alg_cases cases
    CROSS JOIN LATERAL jsonb_array_elements(cases.algs) AS orientations(entries)
    CROSS JOIN LATERAL jsonb_array_elements(orientations.entries) AS algorithms(entry)
    WHERE cases.puzzle = expected.puzzle AND cases.set_slug = expected.set_slug;

    IF actual_cases <> expected.case_count
       OR actual_algs <> expected.alg_count
       OR actual_min <> expected.min_position
       OR actual_max <> expected.max_position
       OR actual_distinct_positions <> expected.case_count THEN
      RAISE EXCEPTION 'LowCubes import mismatch for %/%: cases %/% algs %/% positions %..% distinct %',
        expected.puzzle, expected.set_slug,
        actual_cases, expected.case_count,
        actual_algs, expected.alg_count,
        actual_min, actual_max, actual_distinct_positions;
    END IF;
  END LOOP;

  FOR expected IN
    SELECT * FROM (VALUES
        ('fto', 'pf', '', '', 10),
        ('fto', 'tl', '', '', 5),
        ('fto', 'lt', '', '', 3),
        ('fto', 'tcp', '', '', 18),
        ('fto', '1l3t', 'OLP 1: Even', '', 9),
        ('fto', '1l3t', 'OLP 1: Odd', '', 3),
        ('fto', '1l3t', 'OLP 2: Even', '', 9),
        ('fto', '1l3t', 'OLP 2: Odd', '', 3),
        ('fto', '1l3t', 'OLP 3: Even', '', 9),
        ('fto', '1l3t', 'OLP 3: Odd', '', 9),
        ('fto', '1l3t', 'OLP 4a: Even', '', 9),
        ('fto', '1l3t', 'OLP 4a: Odd', '', 9),
        ('fto', '1l3t', 'OLP 4b: Even', '', 9),
        ('fto', '1l3t', 'OLP 4b: Odd', '', 9),
        ('fto', '1l3t', 'OLP 4c: Even', '', 9),
        ('fto', '1l3t', 'OLP 4c: Odd', '', 9),
        ('fto', '1l3t', 'OLP 5: Even', '', 9),
        ('fto', '1l3t', 'OLP 5: Odd', '', 9),
        ('fto', '1l3t', 'OLP 6a: Even', '', 9),
        ('fto', '1l3t', 'OLP 6a: Odd', '', 9),
        ('fto', '1l3t', 'OLP 6b: Even', '', 9),
        ('fto', '1l3t', 'OLP 6b: Odd', '', 9),
        ('fto', '1l3t', 'OLP 6c: Even', '', 9),
        ('fto', '1l3t', 'OLP 6c: Odd', '', 9),
        ('fto', '1l3t', 'OLP 7: Even', '', 3),
        ('fto', '1l3t', 'OLP 7: Odd', '', 3),
        ('fto', '1l3t', 'OLP 8: Even', '', 3),
        ('fto', '1l3t', 'OLP 8: Odd', '', 3),
        ('megaminx', 'full-pll', 'A - 3 corner CP', 'CPLL', 4),
        ('megaminx', 'full-pll', 'E - 4 corner CP', 'CPLL', 3),
        ('megaminx', 'full-pll', 'K - 5 corner CP', 'CPLL', 4),
        ('megaminx', 'full-pll', 'H - 5 piece EP/CP', 'CPLL', 4),
        ('megaminx', 'full-pll', 'U - 3 edge EP', 'EPLL', 4),
        ('megaminx', 'full-pll', 'Z - 4 edge EP', 'EPLL', 3),
        ('megaminx', 'full-pll', 'Q - 5 edge EP', 'EPLL', 4),
        ('megaminx', 'full-pll', 'J - J block', '3x1 Line', 6),
        ('megaminx', 'full-pll', 'D - 3x1 and 2x2', '3x1 Line', 2),
        ('megaminx', 'full-pll', 'M - 2 3x1s', '3x1 Line', 1),
        ('megaminx', 'full-pll', 'F - 3x1 and 1 or 2 2x1s or R block', '3x1 Line', 10),
        ('megaminx', 'full-pll', 'Y - 2 2x1s in Y pattern', '2x2 Block', 6),
        ('megaminx', 'full-pll', 'W - 2 2x2s', '2x2 Block', 1),
        ('megaminx', 'full-pll', 'V - 2x2 and 2x1', '2x2 Block', 8),
        ('megaminx', 'full-pll', 'B - Double R block', 'R Block', 4),
        ('megaminx', 'full-pll', 'R - R block and 2x1', 'R Block', 8),
        ('megaminx', 'full-pll', 'P - R block', 'R Block', 8),
        ('megaminx', 'full-pll', 'N - 5 2x1s', '2x1s touching', 4),
        ('megaminx', 'full-pll', 'C - 2 2x1s touching', '2x1s touching', 12),
        ('megaminx', 'full-pll', 'T - 2, 3 or 4 2x1s in these patterns', '2x1s not touching', 7),
        ('megaminx', 'full-pll', 'S - 2 2x1s, not touching', '2x1s not touching', 12),
        ('megaminx', 'full-pll', 'G - 2x1 and headlights', '2x1', 4),
        ('megaminx', 'full-pll', 'I - 2x1', '2x1', 12),
        ('megaminx', 'full-pll', 'L - Double headlights', 'No blocks', 10),
        ('megaminx', 'full-pll', 'X - No blocks or headlights', 'No blocks', 10)
    ) AS v(puzzle, set_slug, subgroup, group_parent, case_count)
  LOOP
    SELECT COUNT(*)
    INTO actual_group_cases
    FROM alg_cases
    WHERE puzzle = expected.puzzle
      AND set_slug = expected.set_slug
      AND subgroup = expected.subgroup
      AND COALESCE(sticker -> 'attrs' ->> 'groupParent', '') = expected.group_parent;

    IF actual_group_cases <> expected.case_count THEN
      RAISE EXCEPTION 'LowCubes group mismatch for %/% [% / %]: %/%',
        expected.puzzle, expected.set_slug, expected.group_parent, expected.subgroup,
        actual_group_cases, expected.case_count;
    END IF;
  END LOOP;

  SELECT COUNT(*) INTO actual_cases
  FROM alg_cases WHERE puzzle = 'fto' AND set_slug IN ('pf', 'tl', 'lt', 'tcp', '1l3t');
  IF actual_cases <> 216 THEN
    RAISE EXCEPTION 'LowCubes FTO total mismatch: %/216', actual_cases;
  END IF;

  SELECT COUNT(*) INTO actual_cases
  FROM alg_cases WHERE puzzle = 'megaminx' AND set_slug = 'full-pll';
  IF actual_cases <> 151 THEN
    RAISE EXCEPTION 'LowCubes Megaminx Full PLL total mismatch: %/151', actual_cases;
  END IF;

  SELECT COUNT(*) INTO bad_rows
  FROM alg_cases
  WHERE ((puzzle = 'fto' AND set_slug IN ('pf', 'tl', 'lt', 'tcp', '1l3t'))
      OR (puzzle = 'megaminx' AND set_slug = 'full-pll'))
    AND (name = ''
      OR sticker ->> 'kind' <> 'raw'
      OR NULLIF(sticker -> 'attrs' ->> 'slug', '') IS NULL
      OR NULLIF(sticker -> 'attrs' ->> 'image', '') IS NULL
      OR (setup = '' AND NOT (puzzle = 'fto' AND set_slug = '1l3t' AND name = '1.E.1'))
      OR jsonb_typeof(algs) <> 'array');
  IF bad_rows <> 0 THEN
    RAISE EXCEPTION 'LowCubes import has % incomplete case rows', bad_rows;
  END IF;

  SELECT COUNT(*) - COUNT(DISTINCT puzzle || E'\x1f' || set_slug || E'\x1f' || (sticker -> 'attrs' ->> 'slug'))
  INTO bad_rows
  FROM alg_cases
  WHERE (puzzle = 'fto' AND set_slug IN ('pf', 'tl', 'lt', 'tcp', '1l3t'))
     OR (puzzle = 'megaminx' AND set_slug = 'full-pll');
  IF bad_rows <> 0 THEN
    RAISE EXCEPTION 'LowCubes import has % duplicate or null case slugs', bad_rows;
  END IF;

  SELECT COUNT(*) INTO bad_rows
  FROM alg_cases cases
  CROSS JOIN LATERAL jsonb_array_elements(cases.algs) AS orientations(entries)
  CROSS JOIN LATERAL jsonb_array_elements(orientations.entries) AS algorithms(entry)
  WHERE ((cases.puzzle = 'fto' AND cases.set_slug IN ('pf', 'tl', 'lt', 'tcp', '1l3t'))
      OR (cases.puzzle = 'megaminx' AND cases.set_slug = 'full-pll'))
    AND (NULLIF(algorithms.entry ->> 'alg', '') IS NULL
      OR algorithms.entry ->> 'source' IS DISTINCT FROM 'LowCubes / Raul Low'
      OR algorithms.entry ->> 'alg' !~ '^[A-Za-z0-9''()+ -]+$');
  IF bad_rows <> 0 THEN
    RAISE EXCEPTION 'LowCubes import has % invalid algorithm rows', bad_rows;
  END IF;

  SELECT COUNT(*) INTO bad_rows
  FROM alg_cases cases
  WHERE ((cases.puzzle = 'fto' AND cases.set_slug IN ('pf', 'tl', 'lt', 'tcp', '1l3t'))
      OR (cases.puzzle = 'megaminx' AND cases.set_slug = 'full-pll'))
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(cases.algs) AS orientations(entries)
      CROSS JOIN LATERAL jsonb_array_elements(orientations.entries) AS algorithms(entry)
    );
  IF bad_rows <> 1 OR NOT EXISTS (
    SELECT 1 FROM alg_cases
    WHERE puzzle = 'fto' AND set_slug = '1l3t' AND name = '1.E.1'
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(algs) AS orientations(entries)
        CROSS JOIN LATERAL jsonb_array_elements(orientations.entries) AS algorithms(entry)
      )
  ) THEN
    RAISE EXCEPTION 'LowCubes import expected exactly one algorithm-free solved case (FTO 1.E.1), found %', bad_rows;
  END IF;
END
$lowcubes_validate$;
