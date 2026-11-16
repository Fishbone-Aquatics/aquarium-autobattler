import { DIFFICULTIES, OPPONENTS, aiTurn, difficultyInfo, pickOpponent } from './ai';
import { simulateBattle } from './battle';
import {
  BASE_REWARD, BENCH_MAX, MAX_ROUNDS, SHOP_SIZE, STARTING_GOLD, WIN_BONUS,
  comebackBonus, interestFor, lossStreakBonus, priceOf, rerollCost, resaleOf, rollShop, winStreakBonus,
} from './economy';
import { adjacencyMap, canPlace } from './grid';
import { getDef } from './pieces';
import { makeRng, type Rng } from './rng';
import { computeBoard } from './stats';
import { GameError, type Action, type BattleWinner, type Cell, type Difficulty, type GameState, type RewardLine, type Rot, type Tank } from './types';

const freshTank = (rng: Rng): Tank => ({ pieces: [], baseWaterQuality: 6 + rng.int(3) });

export interface NewGameOptions {
  /** Opponent personality; random when omitted. */
  opponent?: string;
  difficulty?: Difficulty;
}

export function newGame(seed: number, options: NewGameOptions = {}): GameState {
  const rng = makeRng(seed);
  const difficulty = difficultyInfo(options.difficulty);
  const state: GameState = {
    version: 2,
    rng: 0,
    nextId: 1,
    phase: 'prep',
    round: 1,
    maxRounds: MAX_ROUNDS,
    gold: STARTING_GOLD,
    wins: 0,
    losses: 0,
    draws: 0,
    winStreak: 0,
    lossStreak: 0,
    history: [],
    player: freshTank(rng),
    opponent: freshTank(rng),
    opponentInfo: pickOpponent(rng, options.opponent),
    difficulty: difficulty.id,
    opponentGold: difficulty.startGold,
    opponentWinStreak: 0,
    opponentLossStreak: 0,
    shop: [],
    rerolls: 0,
    goldLog: [{ round: 1, label: 'Starting gold', amount: STARTING_GOLD }],
    battle: null,
    rewards: [],
  };
  state.shop = rollShop(state.round, rng);
  aiTurn(state, rng, () => `p${state.nextId++}`);
  state.rng = rng.state;
  return state;
}

/** What the client is allowed to see: everything except the RNG state. */
export function toClientView(state: GameState): GameState {
  return { ...state, rng: 0 };
}

const benchCount = (tank: Tank) => tank.pieces.filter((p) => !p.pos).length;

/**
 * Food is eaten when battle starts: each adjacent fish gains the bonus
 * permanently and the food is removed. Food touching no fish goes back to the
 * bench instead of being wasted.
 */
function feed(tank: Tank): void {
  const placed = tank.pieces.filter((p) => p.pos);
  const adj = adjacencyMap(placed);
  const byId = new Map(placed.map((p) => [p.id, p]));
  const eaten = new Set<string>();
  for (const food of placed) {
    const def = getDef(food.defId);
    if (def.type !== 'consumable') continue;
    const fish = [...(adj.get(food.id) ?? [])].map((id) => byId.get(id)!).filter((p) => getDef(p.defId).type === 'fish');
    if (fish.length === 0) {
      food.pos = null;
      continue;
    }
    for (const f of fish) {
      f.perm.attack += def.aura?.attack ?? 0;
      f.perm.health += def.aura?.health ?? 0;
      f.perm.speed += def.aura?.speed ?? 0;
    }
    eaten.add(food.id);
  }
  tank.pieces = tank.pieces.filter((p) => !eaten.has(p.id));
}

/** `brokenLossStreak` is the losing streak a win has just ended (0 if there was none). */
function income(gold: number, won: boolean, lost: boolean, winStreak: number, lossStreak: number, brokenLossStreak: number): RewardLine[] {
  const lines: RewardLine[] = [{ label: 'Round income', amount: BASE_REWARD }];
  if (won) lines.push({ label: 'Victory', amount: WIN_BONUS });
  if (won && comebackBonus(brokenLossStreak) > 0) lines.push({ label: `Comeback! Ended a ${brokenLossStreak}-loss streak`, amount: comebackBonus(brokenLossStreak) });
  if (won && winStreakBonus(winStreak) > 0) lines.push({ label: `Win streak x${winStreak}`, amount: winStreakBonus(winStreak) });
  if (lost && lossStreakBonus(lossStreak) > 0) lines.push({ label: `Loss streak x${lossStreak}`, amount: lossStreakBonus(lossStreak) });
  const subtotal = gold + lines.reduce((sum, l) => sum + l.amount, 0);
  const interest = interestFor(subtotal);
  if (interest > 0) lines.push({ label: 'Interest (1g per 10g banked)', amount: interest });
  return lines;
}

function requirePhase(state: GameState, phase: GameState['phase']): void {
  if (state.phase !== phase) throw new GameError(`That is not possible during the ${state.phase} phase`);
}

function findPiece(state: GameState, id: string) {
  const piece = state.player.pieces.find((p) => p.id === id);
  if (!piece) throw new GameError('Piece not found');
  return piece;
}

/**
 * The whole game is this reducer. It never mutates its input and throws
 * GameError for anything illegal, so the server (authoritative) and the
 * client (optimistic) can run exactly the same code.
 */
export function applyAction(input: GameState, action: Action): GameState {
  if (action.type === 'newGame') {
    return newGame(makeRng(input.rng ^ 0x9e3779b9).int(0xffffffff), { opponent: action.opponent, difficulty: action.difficulty ?? input.difficulty });
  }

  const s = structuredClone(input);
  const rng = makeRng(s.rng);
  const allocId = () => `p${s.nextId++}`;

  switch (action.type) {
    case 'buy': {
      requirePhase(s, 'prep');
      const item = s.shop[action.index];
      if (!item) throw new GameError('That shop slot is empty');
      const def = getDef(item.defId);
      const price = priceOf(item);
      if (s.gold < price) throw new GameError(`Not enough gold (${def.name} costs ${price}g)`);
      const rot = action.rot ?? 0;
      if (action.pos) {
        if (!canPlace(s.player.pieces, def.id, action.pos, rot)) throw new GameError('It does not fit there');
      } else if (benchCount(s.player) >= BENCH_MAX) {
        throw new GameError('Bench is full - place or sell something first');
      }
      s.gold -= price;
      s.shop[action.index] = null;
      s.player.pieces.push({ id: allocId(), defId: def.id, pos: action.pos ?? null, rot, perm: { attack: 0, health: 0, speed: 0 }, paid: price });
      s.goldLog.push({ round: s.round, label: `Bought ${def.name}${item.sale !== undefined ? ' (on sale)' : ''}`, amount: -price });
      break;
    }
    case 'place': {
      requirePhase(s, 'prep');
      const piece = findPiece(s, action.id);
      if (!canPlace(s.player.pieces, piece.defId, action.pos, action.rot, piece.id)) throw new GameError('It does not fit there');
      piece.pos = action.pos;
      piece.rot = action.rot;
      break;
    }
    case 'unplace': {
      requirePhase(s, 'prep');
      const piece = findPiece(s, action.id);
      if (!piece.pos) break;
      if (benchCount(s.player) >= BENCH_MAX) throw new GameError('Bench is full');
      piece.pos = null;
      break;
    }
    case 'sell': {
      requirePhase(s, 'prep');
      const piece = findPiece(s, action.id);
      const def = getDef(piece.defId);
      const value = resaleOf(piece);
      s.gold += value;
      s.player.pieces = s.player.pieces.filter((p) => p.id !== piece.id);
      s.goldLog.push({ round: s.round, label: `Sold ${def.name}`, amount: value });
      break;
    }
    case 'reroll': {
      requirePhase(s, 'prep');
      const cost = rerollCost(s.rerolls);
      if (s.gold < cost) throw new GameError(`Not enough gold (reroll costs ${cost}g)`);
      s.gold -= cost;
      s.rerolls += 1;
      s.shop = rollShop(s.round, rng, s.shop, s.lossStreak);
      s.goldLog.push({ round: s.round, label: 'Shop reroll', amount: -cost });
      break;
    }
    case 'lock': {
      requirePhase(s, 'prep');
      const item = s.shop[action.index];
      if (!item) throw new GameError('That shop slot is empty');
      item.locked = !item.locked;
      break;
    }
    case 'startBattle': {
      requirePhase(s, 'prep');
      // Fighting with no fish is an automatic loss, so it has to be asked for explicitly (it is the way out if you are broke).
      if (computeBoard(s.player).totals.fish === 0 && !action.forfeit) throw new GameError('Place at least one fish in your tank first');
      feed(s.player);
      feed(s.opponent);
      const report = simulateBattle(s.player, s.opponent, rng);
      const winner: BattleWinner = report.winner;
      const brokenLossStreak = winner === 'player' ? s.lossStreak : 0;
      s.opponentBrokenStreak = winner === 'opponent' ? s.opponentLossStreak : 0;
      s.battle = report;
      s.history.push(winner);
      if (winner === 'player') {
        s.wins++; s.winStreak++; s.lossStreak = 0;
        s.opponentLossStreak++; s.opponentWinStreak = 0;
      } else if (winner === 'opponent') {
        s.losses++; s.lossStreak++; s.winStreak = 0;
        s.opponentWinStreak++; s.opponentLossStreak = 0;
      } else {
        s.draws++; s.winStreak = 0; s.lossStreak = 0;
        s.opponentWinStreak = 0; s.opponentLossStreak = 0;
      }
      s.rewards = s.round >= s.maxRounds ? [] : income(s.gold, winner === 'player', winner === 'opponent', s.winStreak, s.lossStreak, brokenLossStreak);
      s.phase = 'battle';
      break;
    }
    case 'nextRound': {
      requirePhase(s, 'battle');
      const last = s.history[s.history.length - 1];
      s.battle = null;
      if (s.round >= s.maxRounds) {
        s.phase = 'gameover';
        s.rewards = [];
        break;
      }
      s.round += 1;
      for (const line of s.rewards) {
        s.gold += line.amount;
        s.goldLog.push({ round: s.round, label: line.label, amount: line.amount });
      }
      s.rewards = [];
      for (const line of income(s.opponentGold, last === 'opponent', last === 'player', s.opponentWinStreak, s.opponentLossStreak, s.opponentBrokenStreak ?? 0)) {
        s.opponentGold += line.amount;
      }
      s.opponentGold = Math.max(0, s.opponentGold + difficultyInfo(s.difficulty).incomeDelta);
      s.rerolls = 0;
      s.shop = rollShop(s.round, rng, s.shop, s.lossStreak);
      aiTurn(s, rng, allocId);
      s.phase = 'prep';
      break;
    }
  }

  s.rng = rng.state;
  return s;
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isCell = (v: unknown): v is Cell => !!v && typeof v === 'object' && isInt((v as Cell).x) && isInt((v as Cell).y);
const isRot = (v: unknown): v is Rot => v === 0 || v === 1 || v === 2 || v === 3;

/** Validate an untrusted payload (from the network) into an Action. */
export function parseAction(raw: unknown): Action {
  const bad = () => new GameError('Malformed action');
  if (!raw || typeof raw !== 'object') throw bad();
  const a = raw as Record<string, unknown>;
  switch (a.type) {
    case 'buy': {
      if (!isInt(a.index) || a.index < 0 || a.index >= SHOP_SIZE) throw bad();
      if (a.pos !== undefined && !isCell(a.pos)) throw bad();
      if (a.rot !== undefined && !isRot(a.rot)) throw bad();
      const pos = a.pos as Cell | undefined;
      return { type: 'buy', index: a.index, pos: pos && { x: pos.x, y: pos.y }, rot: a.rot as Rot | undefined };
    }
    case 'place':
      if (typeof a.id !== 'string' || !isCell(a.pos) || !isRot(a.rot)) throw bad();
      return { type: 'place', id: a.id, pos: { x: a.pos.x, y: a.pos.y }, rot: a.rot };
    case 'unplace':
    case 'sell':
      if (typeof a.id !== 'string') throw bad();
      return { type: a.type, id: a.id };
    case 'lock':
      if (!isInt(a.index) || a.index < 0 || a.index >= SHOP_SIZE) throw bad();
      return { type: 'lock', index: a.index };
    case 'startBattle':
      return a.forfeit === true ? { type: 'startBattle', forfeit: true } : { type: 'startBattle' };
    case 'reroll':
    case 'nextRound':
      return { type: a.type };
    case 'newGame': {
      if (a.opponent !== undefined && !OPPONENTS.some((o) => o.personality === a.opponent)) throw bad();
      if (a.difficulty !== undefined && !DIFFICULTIES.some((d) => d.id === a.difficulty)) throw bad();
      return { type: 'newGame', opponent: a.opponent as string | undefined, difficulty: a.difficulty as Difficulty | undefined };
    }
    default:
      throw bad();
  }
}
