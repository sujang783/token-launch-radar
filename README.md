[![Token Radar](https://make.fun/badge/token-radar-01.svg)](https://make.fun/c/token-radar-01)
[![Rank](https://make.fun/badge/token-radar-01/sujang783/token-launch-radar/rank.svg)](https://make.fun/c/token-radar-01)
[![Reward](https://make.fun/badge/token-radar-01/sujang783/token-launch-radar/reward.svg)](https://make.fun/c/token-radar-01)

# Token Radar — pre-token protocols ranked by implied value

An entry for make.fun's [**token-radar-01** bounty](https://make.fun/bounty/token-radar-01) ("Build the best token launch radar", $1,325 pot).
It ranks protocols whose DefiLlama record shows no token by an implied launch value, and shows
a reader how to farm each one.

## What it does

`main.ts` (Node 22, standard library only) reads the sealed snapshot at `/input/snapshot.json`,
scores every pre-token protocol, and writes:

- `/output/board.json` — the ranked board (226 rows: all 40 watchlist protocols plus every other
  rankable pre-token protocol below the $50M floor)
- `/output/data.js` — the dashboard's dataset
- `/output/dashboard/` — the static dashboard (no network, no framework)
- `/output/screenshots/` — the three screenshots (board, detail view, filtered view)
- `/output/dossier.json` — built with the vendored `vendor/makefun-board.ts`

Run it locally:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path to snapshot.json>
```

## The model (radar-2)

A comparables model, computed from the snapshot's own figures on every run — no protocol name
is ever special-cased:

```
implied = round( TVL × category multiple × growth × maturity × chains )
```

- **Category multiple** — the median market-cap / TVL of the tokenized protocols in the same
  category, shrunk toward the global median (0.20×) with 3 prior observations, then clamped to
  0.02×…1.50×. A category with one live protocol cannot set its own price; a category with
  none takes the global median.
- **Growth** — `1 + clamp(change_7d, −50%, +150%) / 100 × 0.4`.
- **Maturity** — `0.75 + min(age_days, 1095) / 1095 × 0.25`; age is the time since DefiLlama
  first listed the protocol, the best record of how long it has run with no token. Unknown age
  counts as 365 days.
- **Chains** — `1 + min(chains − 1, 4) × 0.02`.

Live-token protocols are set aside (top 24 by market cap, shown in the dashboard's Live view):
their market cap is a fact, never a model input to the ranking, and they are the comparables
the multiples come from.

The dashboard states the formula, prints the full multiples table, and recomputes every row
in the page (`dashboard/logic.js`), so the number on screen is the number `board.json` carries.

## Farm plans

Every row carries a six-step farm plan derived from its own record (category, chains, TVL, age):
the action fits the category, the capital fits the TVL ($50–$250), the hold fits the age
(30–60 days), and every step states its cost and time. No plan promises a token or an
airdrop — a protocol that records no token may never issue one.

## Limits — read this before using the board

- The snapshot is DefiLlama data as of **2026-11-14**. It records no token for a protocol; that
  is **not proof it has none**, and a protocol on the board may already have a token its record
  does not carry.
- Implied values are **this entry's estimates for ranking**, never make.fun's, never a price,
  and not investment advice. A multiple from a thin category is a weak comparable.
- The board ranks protocols, it does not predict whether or when any token is issued.
- Farming costs real gas and locks real capital; a farm can lose money even if a token never comes.

## Layout

```
main.ts                  entrypoint: snapshot in, /output out
lib/model.ts             the radar-2 model, farm plans, board checks
vendor/makefun-board.ts  make.fun's dossier library (vendored from the kit)
dashboard/               index.html, app.css, logic.js (pure model), app.js (rendering)
screenshots/              1-board.png, 2-detail.png, 3-filtered.png
```

## License

MIT — see [LICENSE](LICENSE).
