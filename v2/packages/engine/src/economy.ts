import { PIECES, getDef } from './pieces';
import type { Rng } from './rng';
import type { Piece, PieceDef, Rarity, ShopItem } from './types';

export const STARTING_GOLD = 10;
export const SHOP_SIZE = 6;
export const BASE_REWARD = 5;
export const WIN_BONUS = 1;
export const REROLL_BASE_COST = 2;
export const REROLL_FLAT_COUNT = 5;
export const INTEREST_CAP = 5;
export const BENCH_MAX = 8;
export const MAX_ROUNDS = 15;

export function interestFor(gold: number): number {
  return Math.max(0, Math.min(INTEREST_CAP, Math.floor(gold / 10)));
}

export function lossStreakBonus(streak: number): number {
  return Math.min(Math.max(streak, 0), 6) * 2;
}

export function winStreakBonus(streak: number): number {
  return Math.max(0, Math.min(streak, 5) - 1);
}

/** Winning after two or more straight losses pays out for the streak that was just broken. */
export function comebackBonus(brokenLossStreak: number): number {
  return brokenLossStreak >= 2 ? Math.min(brokenLossStreak, 5) * 2 : 0;
}

/** Sale price: roughly a third off, always at least 1g cheaper. */
export function salePrice(cost: number): number {
  return Math.max(1, cost - Math.max(1, Math.round(cost / 3)));
}

/** Chance that a freshly rolled shop has its one sale item. Losing streaks make sales more common. */
export function saleChance(lossStreak: number): number {
  return 0.25 + 0.1 * Math.min(Math.max(lossStreak, 0), 5);
}

export function priceOf(item: ShopItem): number {
  return item.sale ?? getDef(item.defId).cost;
}

export function resaleOf(piece: Piece): number {
  return sellValue(piece.paid ?? getDef(piece.defId).cost);
}

/** 2g for the first five rerolls each round, then +1g per extra reroll. */
export function rerollCost(rerollsThisRound: number): number {
  return REROLL_BASE_COST + Math.max(0, rerollsThisRound - REROLL_FLAT_COUNT + 1);
}

export function sellValue(cost: number): number {
  return Math.max(1, Math.floor(cost * 0.75));
}

const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

/** Shop odds improve as the campaign goes on. */
export function rarityWeights(round: number): Record<Rarity, number> {
  if (round <= 3) return { common: 70, uncommon: 25, rare: 5, epic: 0, legendary: 0 };
  if (round <= 6) return { common: 50, uncommon: 30, rare: 17, epic: 3, legendary: 0 };
  if (round <= 10) return { common: 35, uncommon: 30, rare: 22, epic: 10, legendary: 3 };
  return { common: 25, uncommon: 27, rare: 25, epic: 15, legendary: 8 };
}

export function rollDef(round: number, rng: Rng): PieceDef {
  const weights = rarityWeights(round);
  const rarity = rng.weighted(RARITY_ORDER, (r) => weights[r]);
  const pool = PIECES.filter((p) => p.rarity === rarity);
  return rng.pick(pool.length ? pool : PIECES);
}

/**
 * Roll a fresh shop, keeping any locked items in their slots. Every shop offers
 * at least one fish, and at most one item is on sale (a locked sale item counts).
 */
export function rollShop(round: number, rng: Rng, previous: (ShopItem | null)[] = [], lossStreak = 0): (ShopItem | null)[] {
  const fresh = (def: PieceDef): ShopItem => ({ defId: def.id, locked: false });
  const shop: (ShopItem | null)[] = Array.from({ length: SHOP_SIZE }, (_, i) => {
    const prev = previous[i];
    if (prev?.locked) return prev;
    return fresh(rollDef(round, rng));
  });
  const isFish = (item: ShopItem | null) => !!item && getDef(item.defId).type === 'fish';
  const open = shop.map((item, i) => (item?.locked ? -1 : i)).filter((i) => i >= 0);
  if (!shop.some(isFish) && open.length > 0) {
    let fish = rollDef(round, rng);
    for (let tries = 0; tries < 50 && fish.type !== 'fish'; tries++) fish = rollDef(round, rng);
    if (fish.type !== 'fish') fish = getDef('neon-tetra');
    shop[rng.pick(open)] = fresh(fish);
  }
  if (open.length > 0 && !shop.some((item) => item?.sale !== undefined) && rng.next() < saleChance(lossStreak)) {
    const item = shop[rng.pick(open)]!;
    item.sale = salePrice(getDef(item.defId).cost);
  }
  return shop;
}
