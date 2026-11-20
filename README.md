# Chain Frontier Radar

[![token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/adiyananurulkhusna/chain-frontier-radar/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/adiyananurulkhusna/chain-frontier-radar/reward.svg)](https://make.fun/bounty/token-radar-01)

**Chain Frontier Radar** ranks pre-token protocols by where the untokenized money
already sits. A token launch is worth more on a chain where pre-token TVL is
concentrating: the frontier is crowded with value waiting for a token. So this
board tilts each protocol's implied value toward the chains that hold the biggest
share of the snapshot's pre-token TVL. This entry is for the make.fun bounty
**token-radar-01** ("Build the best token launch radar", $1,325), scored against the
frozen DefiLlama snapshot of 2026-11-14.

## The model

Every row is scored by the same function, from the snapshot's own figures. No
protocol or chain name is special-cased and no row is hand-picked.

**1. Base value.** Take the protocol's TVL and multiply it by the median
market-cap/TVL ratio of the protocols in the snapshot that already have a token
(computed from the snapshot on every run — in this snapshot the median is about
0.20). The median, not the mean, because a few tiny-TVL tokens with huge caps drag
the mean far above the typical protocol.

**2. Chain factor — the frontier tilt.** For every chain, count the pre-token TVL
that sits on it (each protocol counted on its main chain, so no dollar is counted
twice) and divide by all pre-token TVL in the snapshot. The chain factor is:

```
chain factor = 0.80 + 0.40 x chain share
```

A protocol on the busiest frontier earns up to ×1.20; one on a quiet chain ×0.80.
In this snapshot Bitcoin holds about 62% of all pre-token TVL and Ethereum about
21%, so protocols on those two chains carry the biggest tilt — the frontier table
in the dashboard shows every chain's share, pre-token TVL and factor.

**3. Growth and age.** Then adjust:

- **Growth:** the 7-day TVL change, clamped to −40%…+80% and weighted by 0.3, so
  one wild week cannot dominate the score.
- **Age:** a protocol listed longer with no token counts as more established:
  0.85 + min(age in days, 1095) / 1095 × 0.15, up to 1.00. An unknown listing date
  counts as 365 days.

**4. The ranked column.**

```
implied_value_usd = round(TVL x median ratio x chain factor
                          x (1 + 0.3 x clamped growth / 100) x age factor)
```

Rows are sorted by that number, highest first.

## Coverage

- The board covers **all 40 watchlist slugs** (TVL ≥ $50M, no token on record), plus
  160 pre-token protocols below the floor, picked by TVL — 200 rows in total.
- Protocols that already have a token are set aside in a separate "Live token" view
  with their real market caps, never mixed into the ranking.
- Exchanges, versioned pools and wrapped/staked products are not ranked.

## The dashboard

`dashboard/` is a static page with no network and no build step: it reads `data.js`,
which `main.ts` writes from the same board.

- A **frontier table**: every leading chain's share of pre-token TVL, its pre-token
  TVL in dollars, and the chain factor it earns.
- Search by name, category or chain; filter by category, **chain** and minimum TVL;
  a watchlist-only toggle; sorts by implied value, TVL, 7-day growth, age, chain
  factor and name.
- A **detail drawer** per protocol: the model's full breakdown (TVL, median ratio,
  growth and age multipliers, implied value), the **chain breakdown** (pre-token TVL
  on its chain, the chain's share of all pre-token TVL, and the factor it earns),
  and the step-by-step farm plan with its estimated cost per step.
- The page recomputes each row's implied value from the snapshot figures it
  carries, so the page's arithmetic and the board's data are visibly the same.

## How to run

Node 22, standard library only — nothing to install:

```sh
node main.ts --input /path/to/snapshot.json --output ./out
```

This writes `out/board.json`, `out/data.js`, `out/dashboard/`, `out/screenshots/`
and `out/dossier.json`. Then open `out/dashboard/index.html` in a browser. The
program exits non-zero if the board fails the gate (missing watchlist slugs, wrong
order, bad farm steps, or fewer than 3 screenshots).

## Caveats

- **Implied value is a model, not a price prediction.** It says what a token might
  be worth *if* the market priced this protocol like the median token-bearing
  protocol today, tilted toward the chain where untokenized value is concentrating.
  It is not a forecast of any token's price, and an airdrop is never guaranteed: a
  protocol may never issue a token at all.
- Farm costs are estimates, not live gas prices. Check the real cost before you
  spend anything, use a fresh wallet that holds only what you plan to farm, and
  never pay anyone to claim an airdrop — claim only from links the protocol itself
  publishes.
- The snapshot is frozen at 2026-11-14. Protocols change; this board does not move
  with them.
