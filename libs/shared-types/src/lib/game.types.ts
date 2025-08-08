export interface Position {
  x: number;
  y: number;
}

export interface GamePiece {
  id: string;
  name: string;
  type: 'fish' | 'plant' | 'equipment' | 'consumable';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  shape: Position[];
  stats: {
    attack: number;
    health: number;
    speed: number;
    maxHealth: number;
  };
  tags: string[];
  cost: number;
  abilities?: string[];
  position?: Position;
  rotation?: number;
  // Consumable bonuses (only used for consumable type)
  attackBonus?: number;
  healthBonus?: number;
  speedBonus?: number;
  // Permanent bonuses applied from consumables
  permanentBonuses?: {
    attack: number;
    health: number;
    speed: number;
    sources: { name: string; count: number; attackBonus: number; healthBonus: number; speedBonus: number }[];
  };
}

export interface Tank {
  id: string;
  pieces: GamePiece[];
  waterQuality: number;
  temperature: number;
  grid: (string | null)[][];
}

export interface BattleEvent {
  id: string;
  type: 'attack' | 'heal' | 'status' | 'ability' | 'death' | 'round_start';
  source: string;
  sourceName?: string;
  target?: string;
  targetName?: string;
  value: number;
  round: number;
  turn: number;
  timestamp: number;
  description: string;
}

export interface BattleState {
  active: boolean;
  currentRound: number;
  currentTurn: number;
  playerHealth: number;
  opponentHealth: number;
  playerMaxHealth: number;
  opponentMaxHealth: number;
  winner: BattleResult | null;
  events: BattleEvent[];
  playerPieces: BattlePiece[];
  opponentPieces: BattlePiece[];
  isGameComplete?: boolean;
}

export interface BattlePiece extends GamePiece {
  currentHealth: number;
  isDead: boolean;
  statusEffects: StatusEffect[];
  nextActionTime: number;
}

export interface StatusEffect {
  id: string;
  type: 'poison' | 'healing' | 'buff' | 'debuff';
  value: number;
  duration: number;
  description: string;
}

export type BattleResult = 'player' | 'opponent' | 'draw';

export interface DraftState extends Omit<GameState, 'draftState'> {
  lastModified: number;
}

export interface GameState {
  phase: 'shop' | 'placement' | 'battle' | 'results';
  round: number;
  gold: number;
  lossStreak: number;
  opponentLossStreak: number;
  wins: number;
  losses: number;
  opponentWins: number;
  opponentLosses: number;
  playerTank: Tank;
  opponentTank: Tank;
  shop: (GamePiece | null)[];
  battleEvents: BattleEvent[];
  battleState?: BattleState;
  selectedPiece: GamePiece | null;
  opponentGold: number;
  lockedShopIndex: number | null;
  goldHistory: GoldTransaction[];
  rerollsThisRound: number;
  draftState?: DraftState;
}

export interface GoldTransaction {
  id: string;
  round: number;
  type: 'purchase' | 'sell' | 'reroll' | 'battle_reward' | 'loss_streak_bonus' | 'interest' | 'round_start';
  amount: number;
  description: string;
  timestamp: number;
  pieceId?: string;
  pieceName?: string;
}