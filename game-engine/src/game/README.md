# 🎮 Game Module - Core Game Logic

The Game module implements all core game mechanics, WebSocket event handling, and business logic for the Aquarium Autobattler.

## 🎯 Purpose

This module is the heart of the game engine, providing:
- **Game Mechanics** - Shop system, tank management, battle simulation
- **WebSocket Events** - Real-time communication with frontend
- **State Management** - Game state validation and updates
- **Economy System** - Gold management, transactions, and rewards

## 🏗️ Architecture

```
src/game/
├── game.service.ts    # Core game logic and mechanics
├── game.gateway.ts    # WebSocket event handlers
└── game.module.ts     # NestJS module definition
```

## 🔧 Key Components

### GameService
The main business logic service containing all game mechanics:
- Shop operations (buy, sell, reroll, lock)
- Tank management (piece placement, movement)
- Battle simulation and rewards
- Draft state save/restore system

### GameGateway  
WebSocket gateway handling real-time client communication:
- Event listeners for player actions
- Game state broadcasts
- Error handling and client feedback

## 🛒 Shop System

### Core Operations

**Purchase Pieces**
```typescript
async purchasePiece(socketId: string, pieceId: string, shopIndex: number): Promise<GameState>
```
- Validates gold availability and shop slot
- Deducts gold and adds piece to player inventory
- Preserves locked shop slots
- Records transaction in gold history

**Sell Pieces**
```typescript
async sellPiece(socketId: string, pieceId: string): Promise<GameState>
```
- Removes piece from tank and grid
- Refunds 50% of original cost
- Cleans up grid positioning

**Reroll Shop**
```typescript
async rerollShop(socketId: string): Promise<GameState>
```
- Costs 2 gold per reroll
- Generates new shop contents
- Preserves any locked pieces
- Tracks reroll count per round

**Shop Locking**
```typescript
async toggleShopLock(socketId: string, shopIndex: number): Promise<GameState>
```
- Players can lock one shop slot
- Locked pieces survive rerolls
- Toggle on/off functionality

### Shop Generation

The shop uses weighted random selection from the piece library:

```typescript
private generateShop(): (GamePiece | null)[] {
  const shopSize = 6;
  const shop: (GamePiece | null)[] = [];
  
  for (let i = 0; i < shopSize; i++) {
    const piece = this.getRandomPiece();
    shop.push(piece ? { ...piece, id: uuidv4() } : null);
  }
  
  return shop;
}
```

## 🏊 Tank Management

### Grid System

The game uses an 8×6 grid (8 wide, 6 tall) for piece placement:

```typescript
// Grid stored as 2D array: grid[y][x]
grid: Array(6).fill(null).map(() => Array(8).fill(null))
```

### Piece Placement

**Position Validation**
```typescript
private isValidPosition(tank: Tank, piece: GamePiece, position: Position): boolean {
  for (const offset of piece.shape) {
    const x = position.x + offset.x;
    const y = position.y + offset.y;
    
    // Check boundaries
    if (x < 0 || x >= 8 || y < 0 || y >= 6) return false;
    
    // Check collisions (except with itself)
    if (tank.grid[y][x] && tank.grid[y][x] !== piece.id) return false;
  }
  return true;
}
```

**Grid Operations**
```typescript
async updateTankPiece(
  socketId: string,
  pieceId: string, 
  position: Position,
  action: 'place' | 'move' | 'remove'
): Promise<GameState>
```

Supports three actions:
- **Place**: Put piece on grid at position
- **Move**: Relocate existing piece
- **Remove**: Take piece off grid (stays in inventory)

### Multi-Cell Pieces

Pieces can occupy multiple grid cells defined by their `shape` property:

```typescript
interface GamePiece {
  shape: Position[]; // Array of relative positions
  // Example: [{x: 0, y: 0}, {x: 1, y: 0}] = 2-wide piece
}
```

## ⚔️ Battle System

### Battle Simulation

Currently uses a simplified power comparison system:

```typescript
private simulateBattle(playerTank: Tank, opponentTank: Tank): any {
  const playerPower = playerTank.pieces.reduce((sum, p) => 
    sum + p.stats.attack + p.stats.health, 0);
  const opponentPower = opponentTank.pieces.reduce((sum, p) => 
    sum + p.stats.attack + p.stats.health, 0);
  
  const winner = playerPower > opponentPower ? 'player' : 
                 opponentPower > playerPower ? 'opponent' : 'draw';
  
  return { winner, events: [] };
}
```

### Reward System

**Battle Rewards**
- Base reward: 5 gold
- Win bonus: +3 gold
- Loss streak bonus: +1 gold per loss (max +3)

**Interest System**
- 1 gold per 10 gold held
- Maximum 5 gold interest per round
- Applied after battle rewards

```typescript
// Interest calculation
const interest = Math.min(Math.floor(gameState.gold / 10), 5);
```

## 📊 Statistics & Bonuses

### Stat Calculation

The system calculates final piece stats including bonuses:

```typescript
async getCalculatedStats(socketId: string): Promise<{
  [pieceId: string]: { attack: number; health: number; speed: number }
}>
```

### Adjacency Bonuses

Pieces gain bonuses based on adjacent pieces:

**Plant/Consumable → Fish Bonuses**
```typescript
if ((adjacentPiece.type === 'plant' || adjacentPiece.type === 'consumable') 
    && piece.type === 'fish') {
  if (adjacentPiece.attackBonus) attackBonus += adjacentPiece.attackBonus;
  if (adjacentPiece.healthBonus) healthBonus += adjacentPiece.healthBonus;
  if (adjacentPiece.speedBonus) speedBonus += adjacentPiece.speedBonus;
}
```

**Schooling Fish Synergies**
```typescript
if (piece.tags.includes('schooling')) {
  const adjacentSchoolingCount = adjacentPieces.filter(p => 
    p.tags.includes('schooling')).length;
  
  // Neon Tetra: +1 attack per schooling neighbor
  if (piece.name === 'Neon Tetra') {
    attackBonus += adjacentSchoolingCount;
  }
  
  // Cardinal Tetra: +2 attack per schooling neighbor  
  if (piece.name === 'Cardinal Tetra') {
    attackBonus += adjacentSchoolingCount * 2;
  }

  // Speed bonus: double speed if 3+ schooling neighbors
  if (adjacentSchoolingCount >= 3) {
    speedBonus += piece.stats.speed;
  }
}
```

## 💾 Draft State System

### Save System

Players can save their current game state:

```typescript
async saveDraftState(socketId: string, draftState?: DraftState): Promise<DraftState>
```

The system saves complete game state including:
- Tank layout and pieces
- Gold and economy data
- Shop state and locks
- Round progression

### Restore System

```typescript
async restoreDraftState(socketId: string): Promise<GameState>
```

Restores previously saved state, maintaining:
- Player ID consistency
- Session integrity
- Complete game context

## 🌐 WebSocket Events

### Client → Server Events

| Event | Handler | Purpose |
|-------|---------|---------|
| `SESSION_INIT` | `handleSessionInit` | Initialize player session |
| `SHOP_BUY` | `handleShopBuy` | Purchase piece from shop |
| `SHOP_SELL` | `handleShopSell` | Sell piece from inventory |
| `SHOP_REROLL` | `handleShopReroll` | Reroll shop contents |
| `SHOP_LOCK` | `handleShopLock` | Lock/unlock shop slot |
| `TANK_UPDATE` | `handleTankUpdate` | Place/move/remove pieces |
| `BATTLE_START` | `handleBattleStart` | Begin battle simulation |
| `SAVE_DRAFT_STATE` | `handleSaveDraftState` | Save current game state |
| `RESTORE_DRAFT_STATE` | `handleRestoreDraftState` | Restore saved state |
| `CONFIRM_PLACEMENT` | `handleConfirmPlacement` | Confirm tank layout |
| `GET_CALCULATED_STATS` | `handleGetCalculatedStats` | Request piece stats |

### Server → Client Events

| Event | Purpose |
|-------|---------|
| `GAME_STATE_UPDATE` | Send updated game state |
| `CALCULATED_STATS_UPDATE` | Send calculated piece stats |
| `DRAFT_STATE_SAVED` | Confirm draft was saved |
| `BATTLE_STEP` | Battle animation events |
| `BATTLE_COMPLETE` | Final battle results |
| `ERROR` | Error messages with codes |

## 💰 Economy System

### Gold Transactions

All gold changes are tracked in `goldHistory`:

```typescript
interface GoldTransaction {
  id: string;
  round: number;
  type: 'purchase' | 'sell' | 'reroll' | 'battle_reward' | 'interest' | 'round_start';
  amount: number;
  description: string;
  timestamp: number;
  pieceId?: string;
  pieceName?: string;
}
```

### Transaction Types

- **Purchase**: -cost when buying pieces
- **Sell**: +50% refund when selling
- **Reroll**: -2 gold per shop reroll
- **Battle Reward**: +5-11 gold after battles
- **Interest**: +1-5 gold based on savings
- **Round Start**: Starting gold each game

## 🔧 Error Handling

### Comprehensive Validation

Every operation includes validation:

```typescript
// Phase validation
if (gameState.phase !== 'shop') {
  throw new BadRequestException('Can only purchase during shop phase');
}

// Resource validation  
if (gameState.gold < piece.cost) {
  throw new BadRequestException('Insufficient gold');
}

// Existence validation
if (!piece || piece.id !== pieceId) {
  throw new BadRequestException('Invalid shop item');
}
```

### WebSocket Error Responses

```typescript
client.emit(SOCKET_EVENTS.ERROR, {
  code: 'PURCHASE_FAILED',
  message: error.message,
});
```

## 🔮 Integration Points

### PlayerService Integration

```typescript
constructor(private playerService: PlayerService) {}

private updateGameState(socketId: string, gameState: GameState): void {
  const playerId = this.playerService.getPlayerIdFromSocket(socketId);
  this.playerService.updateSession(playerId, gameState);
}
```

### Piece Library Integration

```typescript
import { PIECE_LIBRARY } from '../app/data/pieces';

private getRandomPiece(): GamePiece | null {
  const pieces = [...PIECE_LIBRARY];
  return pieces[Math.floor(Math.random() * pieces.length)] || null;
}
```

## 🧪 Testing Strategies

### Unit Testing Game Logic

```typescript
describe('GameService', () => {
  it('should validate piece placement correctly', () => {
    const result = service.isValidPosition(tank, piece, position);
    expect(result).toBe(true);
  });
  
  it('should calculate adjacency bonuses', () => {
    const stats = service.calculatePieceStats(piece, adjacentPieces);
    expect(stats.attack).toBe(expectedAttack);
  });
});
```

### Integration Testing WebSocket Events

```typescript
describe('GameGateway', () => {
  it('should handle shop purchases', async () => {
    const result = await gateway.handleShopBuy(mockData, mockClient);
    expect(mockClient.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.GAME_STATE_UPDATE, 
      expectedGameState
    );
  });
});
```

## 🚀 Performance Considerations

### In-Memory Optimization

- Game states stored in memory for fast access
- Efficient grid operations using 2D arrays
- Minimal object copying in state updates

### WebSocket Efficiency

- Single game state broadcasts vs. incremental updates
- Batch stat calculations when requested
- Error handling prevents invalid state propagation

## 🔗 Related Documentation

- [Player Module README](../player/README.md)
- [Debug Module README](../debug/README.md)  
- [Game Engine README](../README.md)
- [Frontend README](../../../frontend/README.md)
- [Main Project README](../../../README.md)