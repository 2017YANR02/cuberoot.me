# systemd units (server-side)

Files in this directory are reference copies of systemd units running on the production
host. They are **not** automatically deployed — install by hand after pushing related
code changes. Steps below assume `ssh root@cuberoot`.

## analytics-aggregate

Daily 04:30 UTC: aggregate yesterday's `pageviews` into `traffic_daily` and prune
`pageviews` rows older than 90 days. Required for `/traffic` to keep working long-term.

```bash
# Place the SQL where the .service unit expects it.
ssh root@cuberoot 'mkdir -p /root/core-api/sql'
scp ops/sql/aggregate_traffic_daily.sql root@cuberoot:/root/core-api/sql/

# Install the unit files.
scp ops/systemd/analytics-aggregate.service root@cuberoot:/etc/systemd/system/
scp ops/systemd/analytics-aggregate.timer   root@cuberoot:/etc/systemd/system/

ssh root@cuberoot 'systemctl daemon-reload \
  && systemctl enable --now analytics-aggregate.timer \
  && systemctl list-timers analytics-aggregate.timer'

# Run once manually to seed first row (optional, sanity check).
ssh root@cuberoot 'systemctl start analytics-aggregate.service \
  && journalctl -u analytics-aggregate.service -n 30 --no-pager'
```

Verify after first run:
```bash
ssh root@cuberoot "PGPASSWORD=314159 psql -U recon_user -h 127.0.0.1 -d cuberoot_db \
  -c 'SELECT day, COUNT(*) rows, SUM(pv) pv FROM traffic_daily GROUP BY day ORDER BY day DESC LIMIT 5;'"
```

If the SQL file changes locally, re-scp it — the unit just `-f`s the on-disk file each run.
