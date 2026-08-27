---
name: date-input
description: Use when adding or editing date-only inputs or date ranges in CubeRoot UI. Reuse the canonical controls and local-calendar ISO helpers; datetime-local and time fields stay separate.
---

# Date input

- Date-only values use valid `yyyy-mm-dd` strings without timezone conversion.
- One date uses `components/DateInput`; a range uses `components/DateRangeInput`.
- Today uses `toLocalIsoDate()`; imported API values use `normalizeIsoDate()`.
- Do not add raw `type="date"` or text inputs with a `yyyy-mm-dd` placeholder outside `DateInput`.
- Keep `time` and `datetime-local` controls separate.
