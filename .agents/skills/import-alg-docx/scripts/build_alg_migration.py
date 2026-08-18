#!/usr/bin/env python3
"""Build an idempotent alg_cases SQL migration from extracted DOCX JSON."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("extracted", type=Path)
    parser.add_argument("--mirror-map", required=True, type=Path)
    parser.add_argument("--puzzle", required=True)
    parser.add_argument("--set", dest="set_slug", required=True)
    parser.add_argument("--case-name-template", required=True)
    parser.add_argument("--expect-cases", required=True, type=int)
    parser.add_argument("--output", required=True, type=Path)
    return parser.parse_args()


def curated_alg(entry: dict[str, object]) -> dict[str, object]:
    result: dict[str, object] = {"alg": entry["alg"], "source": "cuberoot"}
    for key in ("algHtml", "setup", "tags"):
        if entry.get(key):
            result[key] = entry[key]
    return result


def main() -> None:
    args = parse_args()
    extracted = json.loads(args.extracted.read_text(encoding="utf-8"))
    raw_mirrors = json.loads(args.mirror_map.read_text(encoding="utf-8"))
    mirrors = {int(key): int(value) for key, value in raw_mirrors.items()}
    cases = extracted.get("cases", [])
    numbers = [int(case["no"]) for case in cases]
    expected = set(range(1, args.expect_cases + 1))

    if len(cases) != args.expect_cases or set(numbers) != expected or len(numbers) != len(set(numbers)):
        raise SystemExit("extracted case numbers must be unique and cover the expected range")
    if set(mirrors) != expected or any(mirrors.get(partner) != no for no, partner in mirrors.items()):
        raise SystemExit("mirror map must cover every case and be involutive")

    payload = []
    for case in cases:
        no = int(case["no"])
        metrics = case["metrics"]
        payload.append({
            "no": no,
            "name": args.case_name_template.format(no=no),
            "category": case["category"],
            "position": int(case["position"]),
            "mirror": mirrors[no],
            "scrambleFrom": case.get("scrambleFrom"),
            "metrics": metrics,
            "algs": [curated_alg(entry) for entry in case["algs"]],
        })

    payload_json = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    sql = f"""-- Import the owner's curated {args.set_slug.upper()} DOCX.
-- DOCX order and notation win; existing distinct formulas remain as fallbacks.
DO $migration$
DECLARE
  doc_cases JSONB := $payload${payload_json}$payload$::JSONB;
  doc_case JSONB;
  target_case alg_cases%ROWTYPE;
  curated_algs JSONB;
  preserved_algs JSONB;
  merged_meta JSONB;
  source_scramble TEXT;
BEGIN
  IF jsonb_array_length(doc_cases) <> {args.expect_cases} THEN
    RAISE EXCEPTION '{args.set_slug.upper()} DOCX payload must contain {args.expect_cases} cases';
  END IF;

  IF (SELECT COUNT(*) FROM alg_cases WHERE puzzle = '{args.puzzle}' AND set_slug = '{args.set_slug}') <> {args.expect_cases} THEN
    RAISE EXCEPTION 'Expected {args.expect_cases} existing {args.puzzle}/{args.set_slug} cases';
  END IF;

  IF EXISTS (
    SELECT item->>'name'
    FROM jsonb_array_elements(doc_cases) AS item
    LEFT JOIN alg_cases c
      ON c.puzzle = '{args.puzzle}' AND c.set_slug = '{args.set_slug}' AND c.name = item->>'name'
    GROUP BY item->>'name'
    HAVING COUNT(c.id) <> 1
  ) THEN
    RAISE EXCEPTION 'Every DOCX case must match exactly one existing {args.puzzle}/{args.set_slug} case';
  END IF;

  FOR doc_case IN SELECT value FROM jsonb_array_elements(doc_cases)
  LOOP
    SELECT * INTO STRICT target_case
    FROM alg_cases
    WHERE puzzle = '{args.puzzle}' AND set_slug = '{args.set_slug}' AND name = doc_case->>'name';

    curated_algs := doc_case->'algs';
    SELECT COALESCE(jsonb_agg(old_alg ORDER BY ord), '[]'::JSONB)
      INTO preserved_algs
    FROM jsonb_array_elements(COALESCE(target_case.algs->0, '[]'::JSONB)) WITH ORDINALITY AS old(old_alg, ord)
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(curated_algs) AS fresh(fresh_alg)
      WHERE regexp_replace(
              regexp_replace(lower(fresh_alg->>'alg'), '[()[:space:]]+', '', 'g'),
              '2''', '2', 'g'
            ) = regexp_replace(
              regexp_replace(lower(old_alg->>'alg'), '[()[:space:]]+', '', 'g'),
              '2''', '2', 'g'
            )
    );

    source_scramble := NULL;
    IF doc_case->>'scrambleFrom' IS NOT NULL THEN
      SELECT source_case->'algs'->0->>'alg' INTO source_scramble
      FROM jsonb_array_elements(doc_cases) AS source(source_case)
      WHERE (source_case->>'no')::INTEGER = (doc_case->>'scrambleFrom')::INTEGER;
      IF source_scramble IS NULL THEN
        RAISE EXCEPTION 'Missing scramble source % for case %', doc_case->>'scrambleFrom', doc_case->>'no';
      END IF;
    END IF;

    merged_meta := COALESCE(target_case.meta, '{{}}'::JSONB) || jsonb_build_object(
      'no', (doc_case->>'no')::INTEGER,
      'etm', (doc_case->'metrics'->>'etm')::INTEGER,
      'mirror', (doc_case->>'mirror')::INTEGER,
      'optimal', jsonb_build_object(
        'etm', jsonb_build_object('len', (doc_case->'metrics'->>'optimalEtm')::INTEGER),
        'htm', jsonb_build_object('len', (doc_case->'metrics'->>'optimalHtm')::INTEGER),
        'stm', jsonb_build_object('len', (doc_case->'metrics'->>'optimalStm')::INTEGER),
        'atm', jsonb_build_object('len', (doc_case->'metrics'->>'optimalAtm')::INTEGER)
      )
    );
    IF source_scramble IS NOT NULL THEN
      merged_meta := merged_meta || jsonb_build_object('scramble', source_scramble);
    ELSE
      merged_meta := merged_meta - 'scramble';
    END IF;
    IF (doc_case->>'no')::INTEGER = (doc_case->>'mirror')::INTEGER THEN
      merged_meta := merged_meta || jsonb_build_object(
        'sym', COALESCE(merged_meta->'sym', '{{}}'::JSONB) || jsonb_build_object('selfMirror', TRUE)
      );
    END IF;

    UPDATE alg_cases
    SET subgroup = doc_case->>'category',
        position = (doc_case->>'position')::INTEGER,
        algs = CASE
          WHEN jsonb_typeof(target_case.algs) = 'array' AND jsonb_array_length(target_case.algs) > 0
            THEN jsonb_set(target_case.algs, '{{0}}', curated_algs || preserved_algs, FALSE)
          ELSE jsonb_build_array(curated_algs || preserved_algs)
        END,
        meta = merged_meta,
        updated_at = NOW()
    WHERE id = target_case.id;
  END LOOP;
END
$migration$;
"""
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(sql, encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
