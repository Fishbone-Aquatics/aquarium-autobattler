# 👤 Player Module - Session Management

The Player module handles persistent player sessions and WebSocket connection management for the Aquarium Autobattler game engine.

## 🎯 Purpose

This module provides the critical link between temporary WebSocket connections and persistent player identities, enabling:
- **Session Persistence** - Game state survives across page refreshes and reconnections
- **Connection Management** - Maps volatile WebSocket IDs to stable player IDs
- **State Storage** - In-memory storage for active player sessions

## 🏗️ Architecture

```
src/player/
├── player.service.ts    # Core session management service
└── player.module.ts     # NestJS module definition
```

## 🔧 Key Components

### PlayerService

The heart of session management with two critical data structures:

```typescript
// Session storage: playerId → GameState
private sessions = new Map<string, GameState>();

// Socket mapping: socketId → playerId  
private socketToPlayer = new Map<string, string>();
```

## 📡 Core Functionality

### Session Lifecycle

**1. Initial Connection**
```typescript
// Client connects with persistent player ID
mapSocketToPlayer(socketId, playerId)
```

**2. Session Retrieval**
```typescript
// Get existing session or create new one
getOrCreateSession(playerId, initialState)
```

**3. State Updates**
```typescript
// Update session as game progresses
updateSession(playerId, gameState)
```

**4. Disconnection**
```typescript
// Clean up socket mapping (preserve session)
removeSocketMapping(socketId)
```

### Persistence Strategy

The module uses a two-layer approach:

1. **Frontend Layer**: `localStorage` stores persistent player ID
2. **Backend Layer**: In-memory session storage tied to player ID

This design ensures:
- Sessions survive page refreshes
- WebSocket reconnections restore previous state
- No database dependency for prototyping

## 🚀 API Reference

### Core Methods

#### `mapSocketToPlayer(socketId: string, playerId: string): void`
Establishes connection between WebSocket and player identity.

**Usage:**
```typescript
// Called when client connects
this.playerService.mapSocketToPlayer(client.id, 'player-abc123');
```

#### `getOrCreateSession(playerId: string, initialState: GameState): GameState`
Retrieves existing session or creates new one with initial state.

**Returns:**
- Existing `GameState` for returning players
- New `GameState` initialized with `initialState` for new players

#### `getSession(playerId: string): GameState`
Gets current game state for a player.

**Throws:** `NotFoundException` if player session doesn't exist.

#### `updateSession(playerId: string, gameState: GameState): void`
Saves updated game state for a player.

### Debug & Admin Methods

#### `getAllSessions(): Map<string, GameState>`
Returns all active player sessions for debugging.

#### `getSocketMappings(): Map<string, string>`
Returns current socket-to-player mappings.

#### `clearAllSessions(): { sessionCount: number; socketCount: number }`
Clears all sessions and socket mappings. Returns counts for confirmation.

## 🔍 Data Flow

```
WebSocket Connection → Socket ID → Player ID → Game Session
        ↓                ↓           ↓           ↓
   Temporary ID    Maps to...  Persistent  Contains...
   (changes on          ↓       Identity       ↓
    reconnect)    socketToPlayer    ↓      Full GameState
                     Map       localStorage   with tank,
                                            shop, gold, etc.
```

## 💡 Design Decisions

### Why Two-Map Architecture?

**Socket-to-Player Mapping:**
- WebSocket IDs are temporary and change on reconnection
- Player IDs are persistent and stored in browser localStorage
- Mapping allows seamless session recovery

**Session Storage:**
- Game state is complex and memory-intensive
- In-memory storage provides fast access
- Simple Map structure avoids database complexity during prototyping

### Session Persistence Strategy

**What Persists:**
- Complete game state (tank, shop, gold, round progress)
- Draft states for mid-game saves
- Gold transaction history

**What Doesn't Persist:**
- WebSocket connection IDs
- Real-time battle animations
- Client-side UI state

## 🛠️ Integration Examples

### GameService Integration
```typescript
@Injectable()
export class GameService {
  constructor(private playerService: PlayerService) {}

  async createSession(socketId: string, playerId: string): Promise<GameState> {
    // Map connection
    this.playerService.mapSocketToPlayer(socketId, playerId);
    
    // Get or create session
    return this.playerService.getOrCreateSession(playerId, initialState);
  }

  private updateGameState(socketId: string, gameState: GameState): void {
    const playerId = this.playerService.getPlayerIdFromSocket(socketId);
    this.playerService.updateSession(playerId, gameState);
  }
}
```

### WebSocket Gateway Integration
```typescript
@WebSocketGateway()
export class GameGateway {
  handleDisconnect(client: Socket) {
    // Clean up socket mapping (preserve session)
    this.gameService.removeSession(client.id);
  }
}
```

## 📊 Session Data Structure

Each session contains a complete `GameState`:

```typescript
interface GameState {
  // Game progress
  phase: 'shop' | 'battle' | 'prepare';
  round: number;
  gold: number;
  
  // Player tank with pieces and grid
  playerTank: Tank;
  
  // Shop state with available pieces
  shop: (GamePiece | null)[];
  
  // Battle and economy tracking
  wins: number;
  losses: number;
  lossStreak: number;
  goldHistory: GoldTransaction[];
  
  // Draft state for saves
  draftState?: DraftState;
}
```

## 🚨 Error Handling

The service includes comprehensive error handling:

**Player Not Found:**
```typescript
getPlayerIdFromSocket(socketId): string {
  const playerId = this.socketToPlayer.get(socketId);
  if (!playerId) {
    throw new NotFoundException('Player ID not found for socket');
  }
  return playerId;
}
```

**Session Not Found:**
```typescript
getSession(playerId): GameState {
  const session = this.sessions.get(playerId);
  if (!session) {
    throw new NotFoundException('Player session not found');
  }
  return session;
}
```

## 🧪 Testing & Debugging

### Debug Endpoints

Access session data via debug module:
```
GET /api/debug/sessions              # List all sessions
GET /api/debug/session/:playerId     # Get specific session
POST /api/debug/clear-all-sessions   # Clear all sessions
```

### Logging

The service provides detailed console logging:
```
🆕 Creating new session for player: player-abc123
🔄 Reconnecting to existing session for player: player-abc123  
🔌 Removed socket mapping for: socket-xyz789
🗑️ Cleared 5 player sessions and 3 socket mappings
```

## 🔮 Future Enhancements

### Database Integration
```typescript
// Replace in-memory storage
interface PlayerRepository {
  findByPlayerId(playerId: string): Promise<GameState>;
  save(playerId: string, gameState: GameState): Promise<void>;
}
```

### Session Cleanup
```typescript
// Add TTL for inactive sessions
interface PlayerSession {
  playerId: string;
  gameState: GameState;
  lastActivity: Date;
  expiresAt: Date;
}
```

### Multi-Game Support
```typescript
// Support multiple concurrent games
private sessions = new Map<string, Map<string, GameState>>();
//                        playerId → gameId → GameState
```

## 🔗 Related Documentation

- [Game Engine README](../README.md)
- [Game Module README](../game/README.md)
- [Debug Module README](../debug/README.md)
- [Main Project README](../../../README.md)