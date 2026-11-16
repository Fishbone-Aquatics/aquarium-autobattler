import { REROLL_BASE_COST, SHOP_SIZE, rollDef } from './economy';
import { GRID_H, GRID_W, canPlace, uniqueRotations } from './grid';
import { getDef } from './pieces';
import type { Rng } from './rng';
import { computeBoard } from './stats';
import type { Cell, Difficulty, GameState, OpponentInfo, Piece, PieceDef, Rot, Tank } from './types';

interface Personality extends OpponentInfo {
  /** How much this opponent likes a piece (1 = neutral). */
  weight(def: PieceDef): number;
  /** Gold it tries to keep banked for interest after the opening rounds. */
  reserve: number;
  /** How it values a board, relative to the neutral estimate. */
  bias?: ScoreBias;
}

export interface ScoreBias {
  attack?: number;
  health?: number;
  /** Plants and equipment soaking hits. */
  structure?: number;
}

const PERSONALITIES: Personality[] = [
  {
    name: 'Finn', emoji: '🐟', personality: 'Schooler', blurb: 'Packs small schooling fish tightly together.',
    weight: (d) => (d.tags.includes('schooling') ? 2 : d.shape.length > 2 ? 0.6 : 1),
    reserve: 0,
  },
  {
    name: 'Brutus', emoji: '🦈', personality: 'Aggressor', blurb: 'Spends everything on big, angry fish.',
    weight: (d) => (d.tags.includes('predator') || d.tags.includes('aggressive') ? 2 : d.aura?.attack ? 1.4 : d.type === 'plant' ? 0.8 : 1),
    reserve: 0,
    bias: { attack: 1.3, health: 0.8 },
  },
  {
    name: 'Shelly', emoji: '🐢', personality: 'Defender', blurb: 'Tough fish behind plants, decoys and spines. Wins by outlasting you.',
    weight: (d) => (d.traits.includes('decoy') || d.traits.includes('spines') || d.aura?.health ? 1.8 : d.type === 'fish' && d.stats.health >= 6 ? 1.5 : 1),
    reserve: 0,
    bias: { attack: 0.8, health: 1.5, structure: 2.4 },
  },
  {
    name: 'Gus', emoji: '🦐', personality: 'Feeder', blurb: 'Fattens a few favourite fish with food, round after round.',
    weight: (d) => (d.type === 'consumable' ? 3 : d.type === 'fish' ? 1.2 : 0.8),
    reserve: 0,
  },
  {
    name: 'Old Moss', emoji: '🌿', personality: 'Gardener', blurb: 'Clean water, lush plants, and a healthy bank balance.',
    weight: (d) => (d.traits.includes('filter') ? 2 : d.type === 'plant' || d.type === 'equipment' ? 1.6 : d.water !== undefined && d.water < 0 ? 0.5 : 1),
    reserve: 10,
  },
  {
    name: 'Coral', emoji: '🪸', personality: 'Balanced', blurb: 'Buys whatever makes the tank strongest.',
    weight: () => 1,
    reserve: 0,
  },
];

const info = ({ name, emoji, personality, blurb }: Personality): OpponentInfo => ({ name, emoji, personality, blurb });

/** Every opponent the player can choose to face. */
export const OPPONENTS: OpponentInfo[] = PERSONALITIES.map(info);

/** The named opponent, or a random one if the name is missing or unknown. */
export function pickOpponent(rng: Rng, personality?: string): OpponentInfo {
  return info(PERSONALITIES.find((p) => p.personality === personality) ?? rng.pick(PERSONALITIES));
}

export interface DifficultyInfo {
  id: Difficulty;
  name: string;
  blurb: string;
  startGold: number;
  /** Added to the opponent's income every round. */
  incomeDelta: number;
  /** How many shops the opponent may look through in a round (1 = no rerolls). */
  shops(round: number): number;
}

export const DIFFICULTIES: DifficultyInfo[] = [
  { id: 'easy', name: 'Easy', blurb: 'Opponent earns 2g less each round and never rerolls.', startGold: 8, incomeDelta: -2, shops: () => 1 },
  { id: 'normal', name: 'Normal', blurb: 'Same income as you. Starts rerolling from round 4.', startGold: 10, incomeDelta: 0, shops: (round) => (round <= 3 ? 1 : round <= 6 ? 2 : 3) },
  { id: 'hard', name: 'Hard', blurb: 'Opponent earns 2g more each round and digs through the shop from round 1.', startGold: 12, incomeDelta: 2, shops: () => 3 },
];

export function difficultyInfo(id: Difficulty | undefined): DifficultyInfo {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1];
}

/** Rough strength estimate of a tank, built on the same computeBoard the player sees. */
export function boardScore(tank: Tank, bias: ScoreBias = {}): number {
  const atk = 2 * (bias.attack ?? 1);
  const hp = bias.health ?? 1;
  const structure = 0.25 * (bias.structure ?? 1);
  const board = computeBoard(tank);
  let score = 0;
  let decoys = 0;
  for (const pc of Object.values(board.pieces)) {
    const def = getDef(pc.defId);
    // One decoy is a plan; a wall of them is just a slog to fight, so extra ones are worth nothing to the AI.
    if (def.traits.includes('decoy') && ++decoys > 1) continue;
    if (def.type === 'fish') {
      score += pc.final.attack * board.waterMultiplier * (1 + pc.final.speed / 20) * atk + pc.final.health * hp;
      if (board.poisoned) score -= 4;
    } else if (def.type !== 'consumable') {
      score += pc.final.health * structure;
    }
  }
  return score;
}

export function bestPlacement(tank: Tank, defId: string, bias: ScoreBias = {}): { pos: Cell; rot: Rot; score: number } | null {
  const def = getDef(defId);
  let best: { pos: Cell; rot: Rot; score: number } | null = null;
  const probe: Piece = { id: '__probe', defId, pos: null, rot: 0, perm: { attack: 0, health: 0, speed: 0 } };
  const trial: Tank = { ...tank, pieces: [...tank.pieces, probe] };
  for (const rot of uniqueRotations(def.shape)) {
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const pos = { x, y };
        if (!canPlace(tank.pieces, defId, pos, rot)) continue;
        probe.pos = pos;
        probe.rot = rot;
        const score = boardScore(trial, bias);
        if (!best || score > best.score) best = { pos, rot, score };
      }
    }
  }
  return best;
}

/** The opponent shops and places pieces for the upcoming round. Mutates state.opponent / opponentGold. */
export function aiTurn(state: GameState, rng: Rng, allocId: () => string): void {
  const persona = PERSONALITIES.find((p) => p.personality === state.opponentInfo.personality) ?? PERSONALITIES[PERSONALITIES.length - 1];
  const shops = difficultyInfo(state.difficulty).shops(state.round);
  const isFish = (def: PieceDef) => def.type === 'fish';
  const hasFish = () => state.opponent.pieces.some((p) => p.pos && isFish(getDef(p.defId)));
  const reserve = state.round > 2 ? persona.reserve : 0;
  const tank = state.opponent;
  let gold = state.opponentGold;

  for (let batch = 0; batch < shops; batch++) {
    const offers = Array.from({ length: SHOP_SIZE }, () => rollDef(state.round, rng));
    // Like the player's shop, there is always a fish on offer; a fishless tank also needs one it can afford.
    if (!offers.some((d) => isFish(d) && (hasFish() || d.cost <= gold))) {
      let fish = rollDef(state.round, rng);
      for (let tries = 0; tries < 50 && !(isFish(fish) && fish.cost <= gold); tries++) fish = rollDef(state.round, rng);
      offers[0] = isFish(fish) && fish.cost <= gold ? fish : getDef('neon-tetra');
    }
    for (;;) {
      const base = boardScore(tank, persona.bias);
      // A tank with no fish cannot win, so the first purchase is always a fish.
      const fishFirst = !hasFish();
      let pick: { index: number; pos: Cell; rot: Rot; value: number } | null = null;
      offers.forEach((def, index) => {
        if (fishFirst ? !isFish(def) || def.cost > gold : def.cost > gold - reserve) return;
        const spot = bestPlacement(tank, def.id, persona.bias);
        if (!spot) return;
        const value = ((spot.score - base) * persona.weight(def)) / def.cost;
        if (value > 0.05 && (!pick || value > pick.value)) pick = { index, pos: spot.pos, rot: spot.rot, value };
      });
      if (!pick) break;
      const chosen: { index: number; pos: Cell; rot: Rot } = pick;
      const [def] = offers.splice(chosen.index, 1);
      gold -= def.cost;
      tank.pieces.push({ id: allocId(), defId: def.id, pos: chosen.pos, rot: chosen.rot, perm: { attack: 0, health: 0, speed: 0 } });
    }
    if (gold - reserve < REROLL_BASE_COST + 2) break;
    gold -= REROLL_BASE_COST;
  }

  state.opponentGold = gold;
}
