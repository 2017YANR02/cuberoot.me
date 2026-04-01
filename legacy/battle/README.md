# Battle Timer

**Live: [ruiminyan.github.io/battle/](https://ruiminyan.github.io/battle/)**

A feature-rich speedcubing timer with two modes: **Solo** (personal practice) and **1v1** (head-to-head battle). All data stays in `localStorage` — no server needed.

## Modes

### Solo Mode

Full-featured practice timer with:

- **WCA Inspection** — 15s countdown with 8s/12s voice alerts (Web Speech API)
- **Multi-phase timing** — 2-phase (BLD memo+exec) or 4-phase (CFOP)
- **Session management** — create, rename, delete, switch between sessions
- **Penalty system** — OK / +2 / DNF, editable after solve

### 1v1 Mode

Split-screen head-to-head battle:

- Top player uses **Enter** / **↑**, bottom player uses **Space** / **↓**
- Shared scramble, independent timers
- Winner announced with confetti animation
- Per-player background color/image customization

## Statistics

| Stat | Description |
|------|-------------|
| Ao5 / Ao12 / Ao50 / Ao100 | Rolling averages (WCA trim rules: top/bottom 5% removed) |
| Best / Worst | Session best and worst single |
| Mean ± σ | Mean and standard deviation |
| CV | Coefficient of variation (σ / mean × 100%) |
| Streak 🔥 | Current and best consecutive sub-mean streak |
| Sub-X % | Percentage of solves below key thresholds (auto-calculated) |
| PB markers 🏆 | Trophy emoji on personal bests in history |

### Goal Progress Bar

Set a target Ao5 in Settings → GOAL. A color-coded progress bar appears in the stats row:

- 🔵 Blue: < 80% of goal
- 🟠 Orange: 80–99%
- 🟢 Green: Goal reached! 🎯

## History Features

- **Relative dates** — "2m ago", "yesterday", "3d ago"
- **Rolling Ao5** shown per solve
- **Scramble** — click to expand/collapse
- **Multi-phase breakdown** — `[memo:12.34 exec:45.67]` for BLD
- **Progressive loading** — initial 100 items, "Load More" button for older solves
- **Heatmap calendar** — GitHub-style practice activity grid

## Tools

| Button | Function |
|--------|----------|
| ➕ Manual | Manually enter a time (supports `mm:ss.xxx` format) |
| 📥 Import | Import from csTimer JSON export |
| 📊 Overview | Cross-session comparison table with checkbox → KDE overlay chart |
| 🎲 Simulate | Monte Carlo competition simulation (1000× bootstrap Ao5) |
| 📤 Share | Generate result card image (PNG) |
| 📁 Export | Download session as csTimer-compatible JSON |

## Settings

| Setting | Options |
|---------|---------|
| Timer Precision | 1s / 0.1s / 0.01s / 0.001s |
| Start Delay | 0–1s slider (hold-to-start threshold) |
| Inspection | OFF / 8s / 15s (WCA) / ∞ |
| Voice Alert | 8s + 12s spoken warnings during inspection |
| Multi-Phase | 1 (normal) / 2 (BLD) / 4 (CFOP) |
| Goal | Target Ao5 time for progress bar |
| Scramble Image | Show/hide visual scramble preview |
| Scramble Size | 0.5×–2.0× font scale |
| Background | Per-player color picker, image upload, scramble text color |

## Scramble Engine

Uses csTimer's pure-JS random-state scramble generator (`scramble_module.js`, 300KB). Supports all WCA puzzles:

`333` `222` `444` `555` `666` `777` `333bf` `333oh` `333fm` `clock` `minx` `pyram` `skewb` `sq1` `444bf` `555bf`

Scrambles are generated in a Web Worker to avoid blocking the UI.

## Architecture

```
battle/
├── index.html           # Page structure + settings panel
├── battle.js            # Core logic (~3500 lines)
├── battle.css           # All styles (~1850 lines)
├── scramble_module.js   # csTimer scramble engine (GPL-3.0)
├── confetti.min.js      # canvas-confetti (ISC)
└── icon_timer.png       # Favicon
```

### External Dependencies

| File | Source | Used for |
|------|--------|----------|
| `../assets/js/distribution_chart.js` | Shared | Histogram + KDE + box plot |
| `../src/i18n/i18n.js` | Shared | Language switching engine |
| `../i18n/en.json` / `zh.json` | Shared | Translation dictionaries |

### Data Storage

All data stored in `localStorage` with prefix `battle_`:

| Key Pattern | Content |
|-------------|---------|
| `battle_solo_history_{sessionId}_{puzzleId}` | Solve history array |
| `battle_sessions` | Session list `[{id, name}]` |
| `battle_currentSession` | Active session ID |
| `battle_puzzleId` | Selected puzzle type |
| `battle_goalTime` | Target Ao5 (seconds) |
| `battle_timerPrecision` | Decimal places (0–3) |
| `battle_startDelay` | Hold threshold (ms) |
| `battle_inspectionTime` | Inspection seconds |

### Solve Entry Format

```json
{
  "time": 12345,           // milliseconds
  "penalty": "ok",         // "ok" | "+2" | "dnf"
  "scramble": "R U R' ...",
  "date": "2026-03-18T...",
  "phases": [5000, 12345]  // optional: cumulative phase times
}
```

## i18n

All UI text supports English / 中文 via `data-i18n="battle.*"` attributes. Translation keys are in `i18n/en.json` and `i18n/zh.json` under the `battle` namespace.

## Credits

- **Original 1v1 logic**: Ported from [MatteoColombo/cube_challenge_timer](https://github.com/MatteoColombo/cube_challenge_timer)
- **Scramble engine**: [cs0x7f/cstimer](https://github.com/cs0x7f/cstimer) (GPL-3.0)
- **Confetti**: [catdad/canvas-confetti](https://github.com/catdad/canvas-confetti) (ISC)
