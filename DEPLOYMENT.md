# Deployment Guide

## Current Status

✅ **WCA Statistics Auto-Update is LIVE**

- **URL**: [ruiminyan.github.io/stats/](https://ruiminyan.github.io/stats/)
- **Update Schedule**: Every Monday 3:00 AM (Beijing Time) = Sunday 19:00 UTC
- **CI Workflow**: `.github/workflows/stats.yml`

## How It Works

```
Weekly Trigger (cron)
  ↓
GitHub Actions (ubuntu-latest, 2-core, 7GB RAM)
  ↓
1. Download WCA database (~2GB)
2. Import into MySQL (~9 min)
3. Compute 60+ statistics (~37 min)
4. Generate Markdown files
5. Commit & push to main branch
  ↓
GitHub Pages (Jekyll)
  ↓
Live at ruiminyan.github.io/stats/
```

## CI Strategy

| Trigger | Action | Duration |
|---------|--------|----------|
| **Push to `main`** (code changes) | Syntax check only | ~30 seconds |
| **Schedule** (weekly) | Full database download + compute | ~47 minutes |
| **Manual** (`workflow_dispatch`) | Full build | ~47 minutes |

This split strategy avoids wasting 47 minutes on every code change.

## Important Files

```
ruiminyan.github.io/
├── .github/workflows/
│   └── stats.yml              # CI configuration
├── _stats_build/              # Build scripts (not deployed)
│   ├── bin/                   # Ruby scripts
│   ├── core/                  # Core logic
│   ├── statistics/            # 60+ statistic definitions
│   ├── Gemfile                # Ruby dependencies
│   └── LICENSE                # GPL license (original project)
├── stats/                     # Generated output (deployed)
│   ├── README.md              # Index page
│   └── *.md                   # Individual statistics
└── _config.yml                # Jekyll config for stats/
```

## Lessons Learned

### 1. Windows → Linux Permission Issues
**Problem**: Scripts copied from Windows lose executable permissions on Linux.  
**Solution**: Use `ruby script.rb` instead of `./script.rb` in workflow.

### 2. GitHub Actions Default Permissions
**Problem**: `GITHUB_TOKEN` is read-only by default (post-2023 repos).  
**Solution**: Explicitly declare `permissions: contents: write` in workflow.

### 3. Long CI Optimization
**Problem**: Every code push triggers 47-minute full build.  
**Solution**: Split into syntax-check (push) and full-build (schedule).

## Manual Trigger

If you need to update stats immediately:

1. Go to [Actions tab](https://github.com/RuiminYan/ruiminyan.github.io/actions)
2. Select "Update Stats" workflow
3. Click "Run workflow" → "Run workflow"

## Adding a New Statistic

1. Create `_stats_build/statistics/my_new_stat.rb`:
   ```ruby
   require_relative "../core/statistic"

   class MyNewStat < Statistic
     def initialize
       @title = "My New Statistic"
       @table_header = { "Rank" => :right, "Name" => :left }
     end

     def query
       <<-SQL
         SELECT ... FROM results ...
       SQL
     end
   end
   ```

2. Push to `main` → Syntax check runs (~30s)
3. Wait for next Monday 3AM, or manually trigger workflow
4. New page appears at `ruiminyan.github.io/stats/my_new_stat.html`

## Troubleshooting

### Stats not updating?
- Check [Actions tab](https://github.com/RuiminYan/ruiminyan.github.io/actions) for errors
- Verify `permissions: contents: write` is set in `stats.yml`
- Ensure `[skip ci]` is in commit message to avoid recursive triggers

### Syntax check failing?
- Run `ruby -c _stats_build/statistics/*.rb` locally
- Check Ruby 2.7 compatibility

### Out of memory?
- GitHub Actions has 7GB RAM limit
- Current usage is well within limits (~2GB for MySQL + tables)

## Credits

- **Original WCA Statistics**: [jonatanklosko/wca_statistics](https://github.com/jonatanklosko/wca_statistics)
- **Solvers & Trainers**: [or18/RubiksSolverDemo](https://github.com/or18/RubiksSolverDemo)

## Next Steps

- [ ] Monitor first successful weekly run
- [ ] Consider adding visualization (charts/graphs)
- [ ] Unify styling with main site theme
