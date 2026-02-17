# Rubik's Cube Toolkit

**Live site: [ruiminyan.github.io](https://ruiminyan.github.io/)**

A collection of Rubik's Cube solvers, trainers, and statistics tools — all running as static pages on GitHub Pages.

## Site Architecture

```
ruiminyan.github.io/
├── index.html                 # 3x3x3 Solver (main page)
├── 2x2x2.html                # 2x2x2 Solver
├── documentation.html         # Documentation & examples
├── cross_trainer.html         # Cross trainer
├── xcross_trainer.html        # XCross trainer
├── pairing_trainer.html       # Free Pair trainer
├── pseudo_xcross_trainer.html # Pseudo XCross trainer
├── pseudo_pairing_trainer.html# Pseudo Free Pair trainer
├── eocross_trainer.html       # EOCross trainer
├── algTrainer.html            # Algorithm trainer
├── jsonEditor.html            # JSON editor utility
├── stats/                     # WCA Statistics (auto-generated)
├── _stats_build/              # Statistics build scripts (not deployed)
└── .github/workflows/
    └── stats.yml              # CI: weekly stats auto-update
```

## Features

### Solvers

| Solver | Description |
|--------|-------------|
| [3x3x3 Solver](https://ruiminyan.github.io/) | Cross, XCross, Free Pair, Pseudo F2L, EOCross, and Last Layer |
| [2x2x2 Solver](https://ruiminyan.github.io/2x2x2.html) | Pocket cube solver |

### Trainers

| Trainer | Link |
|---------|------|
| Cross | [cross_trainer](https://ruiminyan.github.io/cross_trainer.html) |
| XCross | [xcross_trainer](https://ruiminyan.github.io/xcross_trainer.html) |
| Free Pair | [pairing_trainer](https://ruiminyan.github.io/pairing_trainer.html) |
| Pseudo XCross | [pseudo_xcross_trainer](https://ruiminyan.github.io/pseudo_xcross_trainer.html) |
| Pseudo Free Pair | [pseudo_pairing_trainer](https://ruiminyan.github.io/pseudo_pairing_trainer.html) |
| EOCross | [eocross_trainer](https://ruiminyan.github.io/eocross_trainer.html) |
| Algorithm Trainer | [algTrainer](https://ruiminyan.github.io/algTrainer.html) |

### WCA Statistics

Auto-generated rankings and statistics from the [WCA database](https://www.worldcubeassociation.org/), accessible at [ruiminyan.github.io/stats/](https://ruiminyan.github.io/stats/).

Includes 60+ statistics such as:
- World records count by person / country
- Longest streak of podiums
- Most competitions attended
- Best first single / average
- And many more...

## How It Works

### Static Pages (Solvers & Trainers)

The solvers and trainers are self-contained HTML pages with embedded JavaScript. They run entirely in the browser — no server required. The site supports **PWA** (Progressive Web App) installation for offline use.

Originally forked from [or18/RubiksSolverDemo](https://github.com/or18/RubiksSolverDemo).

### WCA Statistics Pipeline

The statistics pages are auto-generated via GitHub Actions, based on [jonatanklosko/wca_statistics](https://github.com/jonatanklosko/wca_statistics):

```
WCA Database (SQL dump)
  ↓  wget (download ~2GB zip)
  ↓  unzip + import into MySQL
  ↓  14 tables imported
Ruby Scripts (60+ statistics)
  ↓  SQL queries → Markdown files
  ↓  output to stats/ directory
GitHub Pages (Jekyll)
  ↓  Markdown → HTML rendering
  ↓  auto-deploy
Live at ruiminyan.github.io/stats/
```

**Schedule**: Updated weekly (Monday 3:00 AM Beijing Time).

**CI Strategy**:
- `push` → syntax check only (~30 seconds)
- `schedule` / `workflow_dispatch` → full database download + compute (~47 minutes)

### Adding a New Statistic

1. Create a new `.rb` file in `_stats_build/statistics/`
2. Inherit from `Statistic` (or `GroupedStatistic`) and implement the `query` method
3. Push to `main` — syntax is checked automatically
4. The next scheduled run (or manual trigger) will generate the new page

Example:

```ruby
require_relative "../core/statistic"

class MyNewStatistic < Statistic
  def initialize
    @title = "My New Statistic"
    @table_header = { "Rank" => :right, "Name" => :left, "Value" => :right }
  end

  def query
    <<-SQL
      SELECT ... FROM results ...
    SQL
  end
end
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Solvers & Trainers | HTML + JavaScript (client-side) |
| Statistics Engine | Ruby + MySQL |
| CI/CD | GitHub Actions |
| Hosting | GitHub Pages (Jekyll) |
| PWA | Service Worker (`sw.js`) |

## Credits

This project builds upon the work of:

- **Solvers & Trainers**: Forked from [or18/RubiksSolverDemo](https://github.com/or18/RubiksSolverDemo) by [or18](https://github.com/or18). The original project provides the 3x3x3 and 2x2x2 solvers, all trainer pages, and the PWA infrastructure.
- **WCA Statistics**: Based on [jonatanklosko/wca_statistics](https://github.com/jonatanklosko/wca_statistics) by [Jonatan Kłosko](https://github.com/jonatanklosko). The statistics engine, SQL queries, and the plugin framework are from the original project.

## License

See [LICENSE](LICENSE) for details.
