export interface Cell {
  x: number;
  y: number;
}

/** Number of clockwise quarter turns. */
export type Rot = 0 | 1 | 2 | 3;

export type PieceType = 'fish' | 'plant' | 'equipment' | 'consumable';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type Side = 'player' | 'opponent';

export interface StatBlock {
  attack: number;
  health: number;
  speed: number;
}

/**
 * Traits are the only way a piece gets special behaviour. Every trait listed
 * here is implemented in stats.ts or battle.ts - card text never promises
 * something the engine does not do.
 */
export type Trait =
  | 'filter' // plants adjacent to this piece give +1 on each stat they already buff
  | 'cleaner' // does not pollute the water
  | 'loner-row' // +2 ATK when no other fish shares any of its rows
  | 'solitary' // +3 ATK when nothing is adjacent
  | 'bully' // +1 ATK per adjacent fish
  | 'algae-eater' // +1 HP per adjacent plant
  | 'first-strike' // acts first on turn 1
  | 'predator' // heals 2 HP on KOing a smaller fish
  | 'spines' // attackers take 2 damage
  | 'hunter' // always targets the weakest enemy fish
  | 'decoy'; // twice as likely to be targeted

export interface PieceDef {
  id: string;
  name: string;
  emoji: string;
  type: PieceType;
  rarity: Rarity;
  cost: number;
  /** Cells at rotation 0, normalised so min x and min y are 0. */
  shape: Cell[];
  stats: StatBlock;
  tags: string[];
  traits: Trait[];
  /** Bonus granted to each edge-adjacent fish (once per fish, however many cells touch). */
  aura?: Partial<StatBlock>;
  /** Per edge-adjacent schooling fish. */
  school?: { attackPer?: number; healthPer?: number; frenzyAt?: number };
  /** Water quality contribution while placed. Defaults: fish -1, plant +1, others 0. */
  water?: number;
  /** Human readable rules text, one line per ability. */
  text: string[];
}

export interface Piece {
  id: string;
  defId: string;
  /** Top-left of the rotated shape's bounding box, or null when on the bench. */
  pos: Cell | null;
  rot: Rot;
  /** Permanent bonuses from consumed food. */
  perm: StatBlock;
  /** Gold actually paid (less than the list price if bought on sale). Resale is based on this. */
  paid?: number;
}

export interface Tank {
  pieces: Piece[];
  baseWaterQuality: number;
}

export interface BonusLine {
  source: string;
  sourceId?: string;
  attack: number;
  health: number;
  speed: number;
  /** True for food that has not been eaten yet (it is consumed when battle starts). */
  pending?: boolean;
}

export interface PieceComputed {
  id: string;
  defId: string;
  base: StatBlock;
  final: StatBlock;
  bonuses: BonusLine[];
  /** Abilities that are not active yet, and what they still need. */
  hints: string[];
  neighbors: string[];
}

export interface BoardComputed {
  pieces: Record<string, PieceComputed>;
  waterQuality: number;
  waterMultiplier: number;
  poisoned: boolean;
  totals: { attack: number; health: number; fish: number };
}

export interface BattleUnit {
  id: string;
  side: Side;
  defId: string;
  cells: Cell[];
  attack: number;
  maxHealth: number;
  speed: number;
}

export type BattleEvent =
  | { t: 'turn'; turn: number; text: string }
  | { t: 'poison'; id: string; dmg: number; hp: number; died: boolean; text: string }
  | { t: 'attack'; id: string; target: string; dmg: number; hp: number; died: boolean; text: string }
  | { t: 'spines'; id: string; target: string; dmg: number; hp: number; died: boolean; text: string }
  | { t: 'heal'; id: string; amount: number; hp: number; text: string }
  | { t: 'end'; winner: BattleWinner; text: string };

export type BattleWinner = Side | 'draw';

export interface BattleReport {
  units: BattleUnit[];
  events: BattleEvent[];
  winner: BattleWinner;
  turns: number;
  water: Record<Side, { quality: number; multiplier: number }>;
}

export interface ShopItem {
  defId: string;
  locked: boolean;
  /** Discounted price, when this item is on sale. */
  sale?: number;
}

export interface GoldEntry {
  round: number;
  label: string;
  amount: number;
}

export interface RewardLine {
  label: string;
  amount: number;
}

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface OpponentInfo {
  name: string;
  emoji: string;
  personality: string;
  blurb: string;
}

export interface GameState {
  version: 2;
  /** RNG state. Zeroed in the view sent to clients. */
  rng: number;
  nextId: number;
  phase: 'prep' | 'battle' | 'gameover';
  round: number;
  maxRounds: number;
  gold: number;
  wins: number;
  losses: number;
  draws: number;
  winStreak: number;
  lossStreak: number;
  history: BattleWinner[];
  player: Tank;
  opponent: Tank;
  opponentInfo: OpponentInfo;
  /** Missing in saves from before difficulty existed; treated as normal. */
  difficulty?: Difficulty;
  opponentGold: number;
  opponentWinStreak: number;
  opponentLossStreak: number;
  /** Losing streak the opponent ended with its last win; pays its comeback bonus. */
  opponentBrokenStreak?: number;
  shop: (ShopItem | null)[];
  rerolls: number;
  goldLog: GoldEntry[];
  battle: BattleReport | null;
  /** Rewards earned by the battle just fought; paid out on nextRound. */
  rewards: RewardLine[];
}

export type Action =
  | { type: 'buy'; index: number; pos?: Cell; rot?: Rot }
  | { type: 'place'; id: string; pos: Cell; rot: Rot }
  | { type: 'unplace'; id: string }
  | { type: 'sell'; id: string }
  | { type: 'reroll' }
  | { type: 'lock'; index: number }
  | { type: 'startBattle'; forfeit?: boolean }
  | { type: 'nextRound' }
  | { type: 'newGame'; opponent?: string; difficulty?: Difficulty };

export class GameError extends Error {}
