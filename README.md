# Edgeboard

Personal NBA and MLB betting-insight dashboard.

## What is built

- NBA board with live schedule support, DraftKings/FanDuel odds slots, and top-scorer regression flags.
- NBA player table tracks season FG%, last two FG% marks, and last five point totals.
- MLB matchup board shows each team's previous two-game hit totals.
- Sample mode works without credentials.
- Optional odds mode accepts a The Odds API key in the app header.

## Data notes

- Schedules use ESPN scoreboard endpoints where browser access is available.
- Sportsbook lines use The Odds API with `basketball_nba` and `baseball_mlb`, filtered to `draftkings` and `fanduel`.
- Full production player game logs and MLB historical team-hit totals should come from a licensed stats feed or a backend collector. The current app keeps those calculations isolated in `src/sampleData.js` so the feed can be swapped without touching the interface.

## Run locally

From this folder:

```sh
python3 -m http.server 4173
```

Then open:

```text
http://localhost:4173
```
