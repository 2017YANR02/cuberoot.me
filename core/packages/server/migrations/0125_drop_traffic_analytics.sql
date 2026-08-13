-- Retire the unused self-hosted traffic analytics tables.
-- Historical data is archived operationally before this migration is deployed.
DROP TABLE IF EXISTS traffic_daily;
DROP TABLE IF EXISTS pageviews;
