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
}

export interface Tank {
  id: string;
  pieces: GamePiece[];
  waterQuality: number;
  temperature: number;
  grid: (string | null)[][];
}

export interface BattleEvent {
  type: 'attack' | 'heal' | 'status' | 'ability';
  source: string;
  target?: string;
  value: number;
  round: number;
}

export type BattleResult = 'player' | 'opponent' | 'draw';

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
  selectedPiece: GamePiece | null;
  opponentGold: number;
  opponentShop: (GamePiece | null)[];
  lockedShopIndex: number | null;
  goldHistory: GoldTransaction[];
  rerollsThisRound: number;
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