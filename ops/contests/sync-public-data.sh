#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXPORT_URL="${CONTESTS_UPSTREAM_EXPORT_URL:-https://cubingcontests.com/api/default/export/v1/csv}"
EVENTS_URL="${CONTESTS_UPSTREAM_EVENTS_URL:-https://cubingcontests.com/api/default/events}"
EXPORT_FILE="${CONTESTS_UPSTREAM_EXPORT_FILE:-}"
EVENTS_FILE="${CONTESTS_UPSTREAM_EVENTS_FILE:-}"

for variable in DB_HOST DB_PORT DB_NAME DB_USERNAME DB_PASSWORD; do
  if [ -z "${!variable:-}" ]; then
    echo "ERROR: $variable is not configured" >&2
    exit 1
  fi
done

for command in curl node psql unzip; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "ERROR: required command is unavailable: $command" >&2
    exit 1
  fi
done

IMPORT_DIR="$(mktemp -d)"
trap 'rm -rf "$IMPORT_DIR"; unset PGPASSWORD' EXIT

echo "Preparing the Cubing Contests public export..."
if [ -n "$EXPORT_FILE" ]; then
  test -s "$EXPORT_FILE"
  cp "$EXPORT_FILE" "$IMPORT_DIR/export.zip"
else
  curl --fail --silent --show-error --location --retry 3 --max-time 300 \
    "$EXPORT_URL" --output "$IMPORT_DIR/export.zip"
fi
unzip -q "$IMPORT_DIR/export.zip" -d "$IMPORT_DIR/export"

for file in export_events.csv export_persons.csv export_contests.csv export_rounds.csv export_results.csv metadata.json; do
  if [ ! -s "$IMPORT_DIR/export/$file" ]; then
    echo "ERROR: public export is missing $file" >&2
    exit 1
  fi
done

if ! grep -q '"export_format_version"[[:space:]]*:[[:space:]]*"v1"' "$IMPORT_DIR/export/metadata.json"; then
  echo "ERROR: unsupported public export format" >&2
  exit 1
fi

if [ -n "$EVENTS_FILE" ]; then
  test -s "$EVENTS_FILE"
  cp "$EVENTS_FILE" "$IMPORT_DIR/events.json"
else
  curl --fail --silent --show-error --location --retry 3 --max-time 120 \
    "$EVENTS_URL" --output "$IMPORT_DIR/events.json"
fi
node "$SCRIPT_DIR/extract-event-categories.mjs" \
  "$IMPORT_DIR/events.json" "$IMPORT_DIR/export/export_event_categories.csv"

validate_csv_header() {
  local file="$1"
  local expected="$2"
  local actual
  actual="$(sed -n '1{s/\r$//;p;}' "$IMPORT_DIR/export/$file")"
  if [ "$actual" != "$expected" ]; then
    echo "ERROR: unexpected CSV header in $file" >&2
    echo "  expected: $expected" >&2
    echo "  actual:   $actual" >&2
    exit 1
  fi
}

validate_csv_header export_event_categories.csv 'id,category_id,rank,name,short_name,color,hidden,video_based'
validate_csv_header export_events.csv 'id,event_id,name,category_id,rank,format,default_round_format,participants,higher_is_better,submissions_allowed,has_memo,hidden,description,important_info,rule,created_at,updated_at'
validate_csv_header export_persons.csv 'id,name,localized_name,region_code,wca_id,approved,created_at,updated_at'
validate_csv_header export_contests.csv 'id,competition_id,state,name,short_name,type,region_code,city,venue,address,latitude_microdegrees,longitude_microdegrees,start_date,end_date,start_time,timezone,organizer_ids,contact,description,competitor_limit,participants,schedule,created_at,updated_at'
validate_csv_header export_rounds.csv 'id,competition_id,event_id,round_number,round_type_id,format,time_limit_centiseconds,time_limit_cumulative_round_ids,cutoff_attempt_result,cutoff_number_of_attempts,proceed_type,proceed_value,open,created_at,updated_at'
validate_csv_header export_results.csv 'id,event_id,date,approved,person_ids,region_code,super_region_code,attempts,best,average,record_category,regional_single_record,regional_average_record,competition_id,round_id,ranking,proceeds,video_link,discussion_link,created_at,updated_at'

for file in export_event_categories.csv export_events.csv export_persons.csv export_contests.csv export_rounds.csv export_results.csv; do
  if ! sed -n '2p' "$IMPORT_DIR/export/$file" | grep -q .; then
    echo "ERROR: $file has no data rows" >&2
    exit 1
  fi
  echo "  validated $file"
done

export PGPASSWORD="$DB_PASSWORD"
PSQL=(
  psql
  --host "$DB_HOST"
  --port "$DB_PORT"
  --username "$DB_USERNAME"
  --dbname "$DB_NAME"
  --no-password
  --no-psqlrc
  --set ON_ERROR_STOP=1
)

"${PSQL[@]}" <<SQL
BEGIN;

CREATE TEMP TABLE import_event_categories (
  id text, category_id text, rank text, name text, short_name text, color text, hidden text, video_based text
);
CREATE TEMP TABLE import_events (
  id text, event_id text, name text, category_id text, rank text, format text, default_round_format text,
  participants text, higher_is_better text, submissions_allowed text, has_memo text, hidden text, description text,
  important_info text, rule text, created_at text, updated_at text
);
CREATE TEMP TABLE import_persons (
  id text, name text, localized_name text, region_code text, wca_id text, approved text, created_at text, updated_at text
);
CREATE TEMP TABLE import_contests (
  id text, competition_id text, state text, name text, short_name text, type text, region_code text, city text,
  venue text, address text, latitude_microdegrees text, longitude_microdegrees text, start_date text, end_date text,
  start_time text, timezone text, organizer_ids text, contact text, description text, competitor_limit text,
  participants text, schedule text, created_at text, updated_at text
);
CREATE TEMP TABLE import_rounds (
  id text, competition_id text, event_id text, round_number text, round_type_id text, format text,
  time_limit_centiseconds text, time_limit_cumulative_round_ids text, cutoff_attempt_result text,
  cutoff_number_of_attempts text, proceed_type text, proceed_value text, open text, created_at text, updated_at text
);
CREATE TEMP TABLE import_results (
  id text, event_id text, date text, approved text, person_ids text, region_code text, super_region_code text,
  attempts text, best text, average text, record_category text, regional_single_record text,
  regional_average_record text, competition_id text, round_id text, ranking text, proceeds text,
  video_link text, discussion_link text, created_at text, updated_at text
);

\copy import_event_categories FROM '$IMPORT_DIR/export/export_event_categories.csv' WITH (FORMAT csv, HEADER true)
\copy import_events FROM '$IMPORT_DIR/export/export_events.csv' WITH (FORMAT csv, HEADER true)
\copy import_persons FROM '$IMPORT_DIR/export/export_persons.csv' WITH (FORMAT csv, HEADER true)
\copy import_contests FROM '$IMPORT_DIR/export/export_contests.csv' WITH (FORMAT csv, HEADER true)
\copy import_rounds FROM '$IMPORT_DIR/export/export_rounds.csv' WITH (FORMAT csv, HEADER true)
\copy import_results FROM '$IMPORT_DIR/export/export_results.csv' WITH (FORMAT csv, HEADER true)

DO \$\$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM import_events
    WHERE COALESCE(NULLIF(higher_is_better, '')::boolean, false)
  ) THEN
    RAISE EXCEPTION 'public export contains higher-is-better events unsupported by the pinned RecordRanks revision';
  END IF;
END
\$\$;

LOCK TABLE
  record_ranks.results,
  record_ranks.rounds,
  record_ranks.contests,
  record_ranks.persons,
  record_ranks.events,
  record_ranks.event_categories
IN ACCESS EXCLUSIVE MODE;

DELETE FROM record_ranks.results WHERE organization_id = 'default';
DELETE FROM record_ranks.rounds WHERE organization_id = 'default';
DELETE FROM record_ranks.contests WHERE organization_id = 'default';
DELETE FROM record_ranks.persons WHERE organization_id = 'default';
DELETE FROM record_ranks.events WHERE organization_id = 'default';
DELETE FROM record_ranks.event_categories WHERE organization_id = 'default';

INSERT INTO record_ranks.event_categories (
  id, organization_id, category_id, rank, name, short_name, color, hidden, video_based
) OVERRIDING SYSTEM VALUE
SELECT
  id::integer,
  'default',
  category_id,
  rank::integer,
  name,
  NULLIF(short_name, ''),
  color,
  hidden::boolean,
  video_based::boolean
FROM import_event_categories;

INSERT INTO record_ranks.events (
  id, organization_id, event_id, name, category_id, rank, format, default_round_format, participants,
  submissions_allowed, has_memo, hidden, description, important_info, rule, created_at, updated_at
) OVERRIDING SYSTEM VALUE
SELECT
  id::integer,
  'default',
  event_id,
  name,
  category_id::integer,
  rank::integer,
  format::record_ranks.event_format,
  default_round_format::record_ranks.round_format,
  participants::integer,
  submissions_allowed::boolean,
  has_memo::boolean,
  hidden::boolean,
  CASE WHEN description = '__EMPTY_STRING__' THEN '' ELSE NULLIF(description, '') END,
  CASE WHEN important_info = '__EMPTY_STRING__' THEN '' ELSE NULLIF(important_info, '') END,
  CASE WHEN rule = '__EMPTY_STRING__' THEN '' ELSE NULLIF(rule, '') END,
  created_at::timestamp,
  updated_at::timestamp
FROM import_events;

INSERT INTO record_ranks.persons (
  id, organization_id, name, localized_name, region_code, wca_id, approved, created_at, updated_at
) OVERRIDING SYSTEM VALUE
SELECT
  id::integer,
  'default',
  name,
  CASE WHEN localized_name = '__EMPTY_STRING__' THEN '' ELSE NULLIF(localized_name, '') END,
  region_code,
  CASE WHEN wca_id = '__EMPTY_STRING__' THEN '' ELSE NULLIF(wca_id, '') END,
  approved::boolean,
  created_at::timestamp,
  updated_at::timestamp
FROM import_persons;

INSERT INTO record_ranks.contests (
  id, organization_id, competition_id, state, name, short_name, type, region_code, city, venue, address,
  latitude_microdegrees, longitude_microdegrees, start_date, end_date, start_time, timezone, organizer_ids,
  contact, description, competitor_limit, participants, schedule, created_at, updated_at
) OVERRIDING SYSTEM VALUE
SELECT
  id::integer,
  'default',
  competition_id,
  state::record_ranks.contest_state,
  name,
  short_name,
  type::record_ranks.contest_type,
  region_code,
  city,
  venue,
  address,
  latitude_microdegrees::integer,
  longitude_microdegrees::integer,
  start_date::timestamp,
  end_date::timestamp,
  NULLIF(start_time, '')::timestamp,
  NULLIF(timezone, ''),
  ARRAY(SELECT jsonb_array_elements_text(organizer_ids::jsonb)::integer),
  CASE WHEN contact = '__EMPTY_STRING__' THEN '' ELSE NULLIF(contact, '') END,
  CASE WHEN description = '__EMPTY_STRING__' THEN '' ELSE NULLIF(description, '') END,
  competitor_limit::integer,
  participants::integer,
  NULLIF(schedule, '')::jsonb,
  created_at::timestamp,
  updated_at::timestamp
FROM import_contests;

INSERT INTO record_ranks.rounds (
  id, organization_id, competition_id, event_id, round_number, round_type_id, format,
  time_limit_centiseconds, time_limit_cumulative_round_ids, cutoff_attempt_result,
  cutoff_number_of_attempts, proceed_type, proceed_value, open, created_at, updated_at
) OVERRIDING SYSTEM VALUE
SELECT
  id::integer,
  'default',
  competition_id,
  event_id,
  round_number::smallint,
  round_type_id::record_ranks.round_type,
  format::record_ranks.round_format,
  NULLIF(time_limit_centiseconds, '')::integer,
  CASE
    WHEN NULLIF(time_limit_cumulative_round_ids, '') IS NULL THEN NULL
    ELSE ARRAY(SELECT jsonb_array_elements_text(time_limit_cumulative_round_ids::jsonb)::integer)
  END,
  NULLIF(cutoff_attempt_result, '')::integer,
  NULLIF(cutoff_number_of_attempts, '')::integer,
  NULLIF(proceed_type, '')::record_ranks.round_proceed,
  NULLIF(proceed_value, '')::integer,
  open::boolean,
  created_at::timestamp,
  updated_at::timestamp
FROM import_rounds;

INSERT INTO record_ranks.results (
  id, organization_id, event_id, date, approved, person_ids, region_code, super_region_code, attempts,
  best, average, record_category, regional_single_record, regional_average_record, competition_id,
  round_id, ranking, proceeds, video_link, discussion_link, created_at, updated_at
) OVERRIDING SYSTEM VALUE
SELECT
  id::integer,
  'default',
  event_id,
  date::timestamp,
  approved::boolean,
  ARRAY(SELECT jsonb_array_elements_text(person_ids::jsonb)::integer),
  NULLIF(region_code, ''),
  NULLIF(super_region_code, ''),
  ARRAY(SELECT jsonb_array_elements(attempts::jsonb)),
  best::bigint,
  average::bigint,
  record_category::record_ranks.record_category,
  CASE WHEN regional_single_record = '__EMPTY_STRING__' THEN '' ELSE NULLIF(regional_single_record, '') END,
  CASE WHEN regional_average_record = '__EMPTY_STRING__' THEN '' ELSE NULLIF(regional_average_record, '') END,
  NULLIF(competition_id, ''),
  NULLIF(round_id, '')::integer,
  NULLIF(ranking, '')::integer,
  NULLIF(proceeds, '')::boolean,
  CASE WHEN video_link = '__EMPTY_STRING__' THEN '' ELSE NULLIF(video_link, '') END,
  CASE WHEN discussion_link = '__EMPTY_STRING__' THEN '' ELSE NULLIF(discussion_link, '') END,
  created_at::timestamp,
  updated_at::timestamp
FROM import_results;

INSERT INTO record_ranks.record_configs (
  organization_id, record_type_id, category, label, rank, color
)
SELECT
  'default',
  record_type_id,
  category::record_ranks.record_category,
  CASE category WHEN 'competitions' THEN record_type_id WHEN 'meetups' THEN 'M' || record_type_id ELSE 'O' || record_type_id END,
  category_rank + record_rank,
  CASE record_type_id WHEN 'WR' THEN '#dc3545' WHEN 'NR' THEN '#198754' ELSE '#ffc107' END
FROM (
  VALUES ('WR', 10), ('ER', 20), ('NAR', 30), ('SAR', 40), ('AsR', 50), ('AfR', 60), ('OcR', 70), ('NR', 80)
) AS record_types(record_type_id, record_rank)
CROSS JOIN (
  VALUES ('competitions', 0), ('meetups', 100), ('online', 200)
) AS categories(category, category_rank)
ON CONFLICT (organization_id, record_type_id, category) DO UPDATE SET
  label = EXCLUDED.label,
  rank = EXCLUDED.rank,
  color = EXCLUDED.color,
  active = true,
  updated_at = now();

SELECT setval(
  pg_get_serial_sequence('record_ranks.event_categories', 'id'),
  (SELECT max(id) FROM record_ranks.event_categories),
  true
);
SELECT setval(pg_get_serial_sequence('record_ranks.events', 'id'), (SELECT max(id) FROM record_ranks.events), true);
SELECT setval(pg_get_serial_sequence('record_ranks.persons', 'id'), (SELECT max(id) FROM record_ranks.persons), true);
SELECT setval(pg_get_serial_sequence('record_ranks.contests', 'id'), (SELECT max(id) FROM record_ranks.contests), true);
SELECT setval(pg_get_serial_sequence('record_ranks.rounds', 'id'), (SELECT max(id) FROM record_ranks.rounds), true);
SELECT setval(pg_get_serial_sequence('record_ranks.results', 'id'), (SELECT max(id) FROM record_ranks.results), true);

DO \$\$
DECLARE
  event_count integer;
  contest_count integer;
  result_count integer;
BEGIN
  SELECT count(*) INTO event_count FROM record_ranks.events WHERE organization_id = 'default';
  SELECT count(*) INTO contest_count FROM record_ranks.contests WHERE organization_id = 'default';
  SELECT count(*) INTO result_count FROM record_ranks.results WHERE organization_id = 'default';
  IF event_count = 0 OR contest_count = 0 OR result_count = 0 THEN
    RAISE EXCEPTION 'public data import produced empty tables: events %, contests %, results %',
      event_count, contest_count, result_count;
  END IF;
END
\$\$;

COMMIT;
SQL

echo "Cubing Contests public data sync completed successfully."
