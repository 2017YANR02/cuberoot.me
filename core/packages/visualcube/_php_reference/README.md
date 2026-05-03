# PHP visualcube reference

Original PHP visualcube source by Cride5 (https://github.com/Cride5/visualcube), kept here as the spec for porting features into the TS code in `../src/`. Not built or shipped — reference only. LGPL-3.

This local copy includes downstream patches by Ruimin Yan / Kira (V0.6.x, 2020) that the upstream GitHub repo never received: more stage masks, extra colour codes (`zfiecva`), `pzl` raised to 52, `sch=ygrwbo` default, repeat-count syntax in `fc/sch/fd` (e.g. `y20r6`), SiGN move support in `alg/case` (e.g. `2-5r`, `(RUR'U')3`).

## Files

| file | role |
|---|---|
| `index.php` | main renderer (was `visualcube.php` upstream) — option parsing, stage mask table, SVG generation. Read this first. |
| `cube_lib.php` | algorithm parsing + facelet permutation engine for arbitrary NxN cubes |
| `visualcube_api.php` | HTML docs page listing every URL parameter (the public API contract) |
| `visualcube_config.php` | server-side defaults (`MAX_PZL_DIM`, `DEFAULTS`, cache + DB config) |
| `UPSTREAM_PHP_README.md` | original repo README |
| `UPSTREAM_PHP_CHANGELOG.md` | upstream changelog (last entry V0.5.6, 2014) |

LGPL-3 same as TS package — `../COPYING` and `../COPYING.LESSER` apply.
