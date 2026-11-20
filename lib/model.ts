// Chain Frontier Radar: rank pre-token protocols by where the untokenized money sits.
//
// One snapshot of the protocol universe in, one ranked board out. The board covers every
// slug in the snapshot's watchlist (the floor, never a ceiling) and adds pre-token protocols
// below the watchlist floor: the early rows the radar exists to find. A protocol is
// pre-token when its index entry records no token (no market cap, no CoinGecko id, no
// symbol); live-token protocols are kept apart and shown with the market's own values,
// never mixed into the ranked board.
//
// The angle is the frontier: a token launch is worth more where untokenized value is
// already concentrating. A protocol on a chain that holds a big share of the snapshot's
// pre-token TVL sits on a frontier that is already crowded with value waiting for a
// token; a protocol on a chain with almost no pre-token TVL sits on a quiet frontier.
// The model prices that difference in, from the snapshot's own figures:
//
//   median ratio  = median(mcap_usd / tvl_usd) over token-bearing protocols, per run
//   base          = tvl_usd x median ratio
//   chain share   = (pre-token TVL on the protocol's main chain) / (all pre-token TVL)
//   chain factor  = 0.8 + 0.4 x chain share        (0.80 on a quiet chain, up to 1.20)
//   growth        = 1 + 0.3 x clamp(change_7d, -40, 80) / 100
//   age factor    = 0.85 + min(age_days, 1095) / 1095 x 0.15
//   implied       = round(base x chain factor x growth x age factor)
//
// No protocol or chain name is ever special-cased: the chain table is computed from the
// snapshot on every run, so the same function scores every row.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  age_floor: number;
  age_range: number;
  age_days_cap: number;
  unknown_age_days: number;
  chain_floor: number;
  chain_range: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.3,
  growth_floor: -40,
  growth_cap: 80,
  age_floor: 0.85,
  age_range: 0.15,
  age_days_cap: 1095,
  unknown_age_days: 365,
  chain_floor: 0.8,
  chain_range: 0.4,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'chain-frontier-1';

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 160;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** How many chains the dashboard's frontier table lists. */
export const FRONTIER_CHAINS = 12;

/**
 * Rough planning estimates for the all-in cost of one farm step (gas plus the usual
 * swap or pool fee for a small position) on each chain, in whole US dollars. These are
 * hand-written estimates, not live prices: gas moves, and a step on Ethereum costs far
 * more than the same step on a cheap chain. Treat every figure as an estimate, never
 * as a quote; the ranking never uses them, only the farm plans do.
 */
export const STEP_COST_USD: Record<string, number> = {
  Ethereum: 5.5,
  Bitcoin: 2.0,
  Solana: 0.5,
  Base: 0.8,
  Arbitrum: 1.0,
  Optimism: 0.9,
  Polygon: 0.4,
  Avalanche: 1.2,
  Sui: 0.5,
  Aptos: 0.5,
  Sei: 0.5,
  Tron: 0.9,
  Binance: 0.7,
  Ink: 0.8,
  Monad: 0.5,
  'Hyperliquid L1': 0.7,
  Starknet: 1.4,
  'zkSync Era': 0.9,
  Linea: 0.7,
  Scroll: 0.7,
  Mantle: 0.6,
  Berachain: 0.7,
  Unichain: 0.8,
  Sonic: 0.6,
  Fantom: 0.6,
  Gnosis: 0.5,
  Cronos: 0.7,
  Kava: 0.6,
  Near: 0.4,
  Cosmos: 0.5,
  Osmosis: 0.5,
  TON: 0.4,
  Stellar: 0.3,
  Ripple: 0.3,
  Flare: 0.5,
  'World Chain': 0.7,
  Bittensor: 0.8,
  Anubis: 0.6,
};

/** The fallback per-step estimate for a chain the table does not name. */
export const STEP_COST_DEFAULT_USD = 0.9;

/** One chain's frontier position: how much pre-token TVL sits on it, and its factor. */
export interface ChainFrontier {
  chain: string;
  pretoken_tvl_usd: number;
  pretoken_protocols: number;
  share: number;
  factor: number;
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    median_ratio: number;
    chain: string;
    chain_share: number;
    chain_pretoken_tvl_usd: number;
    chain_factor: number;
    growth_pct: number;
    growth_multiplier: number;
    age_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's view of one row, with its farm plan included. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  chain_factor: number;
  chain_share: number;
  chain_pretoken_tvl_usd: number;
  chain_pretoken_protocols: number;
  growth_multiplier: number;
  age_multiplier: number;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, the frontier table, the model. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  median_ratio: number;
  total_pretoken_tvl_usd: number;
  frontier: ChainFrontier[];
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/**
 * The median market-cap/TVL ratio across every protocol in the snapshot that already
 * has a token with a market cap. The middle of the market, not its loudest corner:
 * the mean is dragged up by a few tiny-TVL tokens with huge caps, the median is not.
 */
export function medianMcapTvl(snapshot: Snapshot): number {
  const ratios = snapshot.protocols
    .filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0)
    .map((p) => (p.mcap_usd as number) / p.tvl_usd)
    .sort((a, b) => a - b);
  if (ratios.length === 0) return 0;
  const mid = Math.floor(ratios.length / 2);
  return ratios.length % 2 === 1 ? ratios[mid]! : (ratios[mid - 1]! + ratios[mid]!) / 2;
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** The protocol's main chain: the first chain it names, or the empty string when it names none. */
export function mainChain(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : '';
}

/**
 * The frontier table: for every chain, the pre-token TVL that sits on it (counted on
 * each protocol's main chain, so no dollar is counted twice), its share of all
 * pre-token TVL in the snapshot, and the chain factor that share earns. Sorted by
 * pre-token TVL, biggest frontier first.
 */
export function chainFrontier(snapshot: Snapshot, model: ModelConstants = MODEL): { table: ChainFrontier[]; total: number } {
  const byChain = new Map<string, { tvl: number; count: number }>();
  let total = 0;
  for (const p of snapshot.protocols) {
    if (!isPreToken(p)) continue;
    const chain = mainChain(p);
    if (chain === '') continue;
    const entry = byChain.get(chain) ?? { tvl: 0, count: 0 };
    entry.tvl += p.tvl_usd;
    entry.count += 1;
    byChain.set(chain, entry);
    total += p.tvl_usd;
  }
  const table: ChainFrontier[] = [...byChain.entries()]
    .map(([chain, entry]) => {
      const share = total > 0 ? entry.tvl / total : 0;
      return {
        chain,
        pretoken_tvl_usd: entry.tvl,
        pretoken_protocols: entry.count,
        share: round4(share),
        factor: round4(model.chain_floor + model.chain_range * share),
      };
    })
    .sort((a, b) => b.pretoken_tvl_usd - a.pretoken_tvl_usd || (a.chain < b.chain ? -1 : 1));
  return { table, total };
}

/** The chain factor for one protocol: its main chain's factor from the frontier table. */
export function chainFactorFor(p: SnapshotProtocol, table: ChainFrontier[], model: ModelConstants): { factor: number; share: number; chainTvl: number } {
  const chain = mainChain(p);
  const row = table.find((c) => c.chain === chain);
  if (row === undefined) return { factor: model.chain_floor, share: 0, chainTvl: 0 };
  return { factor: row.factor, share: row.share, chainTvl: row.pretoken_tvl_usd };
}

/**
 * The multipliers and the implied value one protocol gets under `model`, given the
 * snapshot's median market-cap/TVL ratio and the frontier table. Growth is clamped so
 * one wild week cannot dominate; the age factor rises with listing age up to the cap.
 */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  medianRatio: number,
  frontier: ChainFrontier[],
): { implied: number; growthPct: number; growthMult: number; ageMult: number; age: number | null; chain: string; chainShare: number; chainTvl: number; chainFactor: number } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const ageMult = model.age_floor + (Math.min(Math.max(ageForModel, 0), model.age_days_cap) / model.age_days_cap) * model.age_range;
  const { factor, share, chainTvl } = chainFactorFor(protocol, frontier, model);
  const base = protocol.tvl_usd * medianRatio;
  const implied = Math.max(1, Math.round(base * factor * growthMult * ageMult));
  return { implied, growthPct, growthMult, ageMult, age, chain: mainChain(protocol), chainShare: share, chainTvl, chainFactor: factor };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const medianRatio = medianMcapTvl(snapshot);
  const { table: frontier } = chainFrontier(snapshot, model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it
  // cannot, but the board's coverage is the gate's row and is never gambled on a missing
  // record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: pre-token protocols below the watchlist floor, by TVL, capped. Never
  // a replacement for a watchlist row: a chosen protocol stays chosen.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model, medianRatio, frontier);
    return { p, v };
  });
  scored.sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.v.age,
    implied_value_usd: s.v.implied,
    model: {
      median_ratio: round4(medianRatio),
      chain: s.v.chain,
      chain_share: s.v.chainShare,
      chain_pretoken_tvl_usd: s.v.chainTvl,
      chain_factor: s.v.chainFactor,
      growth_pct: s.v.growthPct,
      growth_multiplier: s.v.growthMult,
      age_multiplier: s.v.ageMult,
      age_days: s.v.age,
    },
    farm_steps: farmSteps(s.p, s.v.age).map(stepText),
  }));
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The estimated all-in cost of one farm step on the protocol's main chain. */
function stepCostFor(p: SnapshotProtocol): number {
  return STEP_COST_USD[mainChain(p)] ?? STEP_COST_DEFAULT_USD;
}

/**
 * The category's core farm actions, in the words a farmer can follow. Each entry is one
 * step's action; the plan builder adds the shared setup, weekly, hold and claim steps
 * around them. Actions are chosen from the protocol's own category, never from its name.
 */
function coreActions(p: SnapshotProtocol, capital: number, chain: string): string[] {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) {
    return [
      `Lend $${capital} of USDC into ${name} on ${chain} and leave the deposit earning`,
      `Borrow a small amount against that deposit, then repay half of it within the week`,
      `Vote on one open proposal, or finish the points quest if ${name} runs one`,
    ];
  }
  if (c.includes('dex') || c.includes('leveraged farm')) {
    return [
      `Add $${capital} of liquidity to ${name}'s deepest pool on ${chain} and leave it in`,
      `Swap a small amount through ${name} once a week so the wallet shows trading activity`,
      `Stake the LP receipt if ${name} runs a gauge or farm for it`,
    ];
  }
  if (c.includes('bridge') || c.includes('canonical bridge')) {
    return [
      `Bridge $${capital} of USDC into ${chain} through ${name}, then use the bridged funds`,
      `Bridge a smaller amount back the next week to show two-way use of the bridge`,
    ];
  }
  if (c.includes('staking') || c.includes('restak')) {
    return [
      `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token`,
      `Restake or delegate that receipt once more if ${name} offers a second layer`,
    ];
  }
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) {
    return [
      `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position`,
      `Close and reopen a small position once a week to show steady trading`,
      `Place one limit order as well as a market order, so both order types appear`,
    ];
  }
  if (c.includes('prediction')) {
    return [
      `Fund $${capital} and take one market position on ${name}`,
      `Settle or roll that position once a week and open a fresh one`,
    ];
  }
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) {
    return [
      `Deposit $${capital} into a ${name} vault on ${chain} and keep the vault shares`,
      `Move a small part of the deposit into a second vault the same curator runs`,
    ];
  }
  if (c.includes('stable')) {
    return [
      `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}`,
      `Supply the minted asset as liquidity in the protocol's own pool`,
    ];
  }
  if (c.includes('rwa')) {
    return [
      `Mint $${capital} of the protocol's yield-bearing asset on ${chain} and hold it`,
      `Use that yield asset as collateral in one lending market that accepts it`,
    ];
  }
  if (c.includes('insurance')) {
    return [
      `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active`,
      `Renew or extend the cover once before it lapses`,
    ];
  }
  if (c.includes('yield')) {
    return [
      `Deposit $${capital} into ${name}'s largest vault on ${chain} and keep the shares`,
      `Harvest or compound the yield once a week instead of letting it sit idle`,
      `Split a small part of the deposit into a second vault on the same protocol`,
    ];
  }
  return [
    `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open`,
    `Make one swap or interaction inside ${name}'s app each week`,
  ];
}

/**
 * A protocol's farm plan: 5 to 8 steps, each an action with a cost and a time. The plan
 * is derived from the protocol's own record (category, chains, TVL, age), never from a
 * hand-written list of names. Costs are the per-step estimate for the protocol's main
 * chain; the capital stays in the position, it is not spent.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = mainChain(p) === '' ? 'its main chain' : mainChain(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const stepCost = stepCostFor(p);
  const stepCostStr = `about $${stepCost.toFixed(2)} of gas and fees`;
  const steps: FarmStep[] = [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, fund it on ${chain}, and keep its seed phrase offline.`,
      cost: stepCostStr,
      time: '5 minutes',
    },
  ];
  for (const action of coreActions(p, capital, chain)) {
    steps.push({ text: `${action}.`, cost: stepCostStr, time: '15 minutes to set up' });
  }
  steps.push(
    {
      text: `Do one qualifying action each week, such as a deposit, a borrow, a swap or a vote, so the wallet stays active.`,
      cost: stepCostStr,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  );
  return steps;
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan included. */
export function radarRow(row: BoardRow, chainProtocols: number): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    chain_factor: row.model.chain_factor,
    chain_share: row.model.chain_share,
    chain_pretoken_tvl_usd: row.model.chain_pretoken_tvl_usd,
    chain_pretoken_protocols: chainProtocols,
    growth_multiplier: row.model.growth_multiplier,
    age_multiplier: row.model.age_multiplier,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const { table: frontier, total } = chainFrontier(snapshot, model);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const protocolCounts = new Map(frontier.map((c) => [c.chain, c.pretoken_protocols]));
  const rows = board.map((r) => radarRow(r, protocolCounts.get(r.model.chain) ?? 0));
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    median_ratio: medianMcapTvl(snapshot),
    total_pretoken_tvl_usd: total,
    frontier: frontier.slice(0, FRONTIER_CHAINS),
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows,
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
