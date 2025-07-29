// WebSocket event types for real-time communication

export interface SessionInitEvent {
  sessionId: string;
  playerId: string;
  gameState: any; // Will be GameState from game.types
}

export interface ShopBuyEvent {
  sessionId: string;
  playerId: string;
  pieceId: string;
  shopIndex: number;
}

export interface ShopRerollEvent {
  sessionId: string;
  playerId: string;
}

export interface ShopLockEvent {
  sessionId: string;
  playerId: string;
  shopIndex: number;
}

export interface TankUpdateEvent {
  sessionId: string;
  playerId: string;
  pieceId: string;
  position: { x: number; y: number };
  action: 'place' | 'move' | 'remove';
}

export interface BattleStartEvent {
  sessionId: string;
  playerId: string;
}

export interface BattleStepEvent {
  sessionId: string;
  events: any[]; // Will be BattleEvent[]
  playerHealth: number;
  opponentHealth: number;
}

export interface BattleCompleteEvent {
  sessionId: string;
  result: 'player' | 'opponent' | 'draw';
  rewards: {
    gold: number;
    experience?: number;
  };
}

export interface ErrorEvent {
  code: string;
  message: string;
  details?: any;
}

// Event names for Socket.IO
export const SOCKET_EVENTS = {
  // Client -> Server
  SESSION_INIT: 'session:init',
  SHOP_BUY: 'shop:buy',
  SHOP_REROLL: 'shop:reroll',
  SHOP_SELL: 'shop:sell',
  SHOP_LOCK: 'shop:lock',
  TANK_UPDATE: 'tank:update',
  BATTLE_START: 'battle:start',
  GET_CALCULATED_STATS: 'stats:get',
  SAVE_DRAFT_STATE: 'draft:save',
  RESTORE_DRAFT_STATE: 'draft:restore',
  CONFIRM_PLACEMENT: 'draft:confirm',
  
  // Server -> Client
  GAME_STATE_UPDATE: 'game:state:update',
  BATTLE_STEP: 'battle:step',
  BATTLE_COMPLETE: 'battle:complete',
  CALCULATED_STATS_UPDATE: 'stats:update',
  DRAFT_STATE_SAVED: 'draft:saved',
  ERROR: 'error'
} as const;