# ⚙️ Game Engine - Aquarium Autobattler

The NestJS backend service that handles all game logic, state management, and real-time communication for the Aquarium Autobattler.

## 🛠️ Tech Stack

- **NestJS** - Scalable Node.js framework
- **Socket.IO** - Real-time WebSocket communication
- **TypeScript** - Type-safe development
- **In-Memory Storage** - Session and game state storage
- **Webpack** - Module bundling and compilation

## 🏗️ Modular Architecture

```
game-engine/src/
├── app/                    # Main application module
│   ├── app.module.ts      # Root module (imports all others)
│   ├── app.controller.ts  # Basic app endpoints
│   ├── app.service.ts     # App-level services
│   └── data/              # Game data definitions
│       └── pieces.ts      # Piece library and configurations
├── player/                 # Player session management
│   ├── player.service.ts  # Player state and session handling
│   └── player.module.ts   # Player module definition
├── game/                   # Core game logic
│   ├── game.service.ts    # Game mechanics and rules
│   ├── game.gateway.ts    # WebSocket event handlers
│   └── game.module.ts     # Game module definition
└── debug/                  # Debug and admin tools
    ├── debug.controller.ts # Debug API endpoints
    ├── debug.service.ts    # Debug utilities
    └── debug.module.ts     # Debug module definition
```

## 🚀 Getting Started

### Development

```bash
# Start development server
npm run start:backend
# or
npx nx serve game-engine

# Server runs on http://localhost:3001
# WebSocket server on ws://localhost:3001
```

### Building

```bash
# Build for production
npx nx build game-engine

# Output in dist/game-engine/
```

## 🎮 Core Systems

### Player Management (`src/player/`)
Handles player sessions and persistence:
- **Session Creation** - Maps WebSocket connections to persistent player IDs
- **State Persistence** - Maintains game state across reconnections
- **Socket Mapping** - Manages WebSocket connection lifecycle

### Game Logic (`src/game/`)
Implements all game mechanics:
- **Shop System** - Piece generation, purchasing, rerolling
- **Tank Management** - Piece placement, validation, movement
- **Battle System** - Combat simulation and reward calculation
- **Draft System** - Save/restore game state functionality

### Debug Tools (`src/debug/`)
Development and admin utilities:
- **Session Inspector** - View all active player sessions
- **State Debugging** - Inspect detailed game state
- **Admin Actions** - Clear sessions, reset state

## 🔌 API Endpoints

### Main Application
```
GET  /api              # Health check endpoint
```

### Debug & Admin
```
GET  /api/debug/sessions              # List all active sessions
GET  /api/debug/session/:playerId     # Get detailed session data  
POST /api/debug/clear-all-sessions    # Clear all sessions (admin)
```

### WebSocket Events
```typescript
// Client → Server
SOCKET_EVENTS.SESSION_INIT     // Initialize player session
SOCKET_EVENTS.SHOP_BUY         // Purchase piece from shop
SOCKET_EVENTS.SHOP_SELL        // Sell piece from inventory
SOCKET_EVENTS.SHOP_REROLL      // Reroll shop contents
SOCKET_EVENTS.SHOP_LOCK        // Lock/unlock shop slot
SOCKET_EVENTS.TANK_UPDATE      // Place/move pieces in tank
SOCKET_EVENTS.BATTLE_START     // Start battle simulation
SOCKET_EVENTS.SAVE_DRAFT_STATE // Save current game state
SOCKET_EVENTS.RESTORE_DRAFT_STATE // Restore saved state

// Server → Client  
SOCKET_EVENTS.GAME_STATE_UPDATE     // Send updated game state
SOCKET_EVENTS.CALCULATED_STATS_UPDATE // Send piece statistics
SOCKET_EVENTS.DRAFT_STATE_SAVED     // Confirm draft saved
SOCKET_EVENTS.BATTLE_COMPLETE       // Battle results
SOCKET_EVENTS.ERROR                 // Error messages
```

## 🎯 Game Mechanics

### Shop System
- **Piece Generation** - Random selection from piece library with rarity weights
- **Purchase Logic** - Gold validation, inventory management
- **Reroll System** - 2 gold cost, preserve locked slots
- **Shop Locking** - Players can lock favorite pieces

### Economy System
- **Gold Management** - Starting gold, interest calculation, transaction history
- **Interest System** - 1 gold per 10 held (max 5 gold per turn)
- **Pricing** - Buy at full price, sell at 50% value
- **Transaction Logging** - Complete history of gold changes

### Tank & Combat
- **Grid Validation** - 8×6 grid with shape-based collision detection
- **Piece Placement** - Multi-cell piece support, position validation
- **Stat Calculation** - Base stats + adjacency bonuses + synergies
- **Battle Simulation** - Power comparison with win/loss streaks

### Session Persistence
- **Player IDs** - Persistent identifiers from localStorage
- **Session Storage** - In-memory game state tied to player ID
- **Draft System** - Save complete game snapshots for restoration
- **Reconnection** - Automatic session recovery on page refresh

## 🧩 Modules Deep Dive

### Player Module
**Purpose**: Manage player sessions and WebSocket connections

**Key Features**:
- Maps temporary WebSocket IDs to persistent player IDs
- Maintains session storage across disconnections
- Handles connection lifecycle (connect/disconnect/reconnect)

**API**:
```typescript
playerService.mapSocketToPlayer(socketId, playerId)
playerService.getSession(playerId)
playerService.updateSession(playerId, gameState)
```

### Game Module  
**Purpose**: Implement core game mechanics and rules

**Key Features**:
- All game logic (shop, tank, battles)
- WebSocket event handling
- State validation and updates
- Integration with player sessions

**Key Methods**:
```typescript
gameService.purchasePiece(socketId, pieceId, shopIndex)
gameService.updateTankPiece(socketId, pieceId, position, action)
gameService.saveDraftState(socketId, draftState)
```

### Debug Module
**Purpose**: Development tools and admin functionality

**Key Features**:
- Session inspection and debugging
- Administrative actions
- Development utilities
- API endpoints for external tools

## 📊 Data Flow

```
Client Action → WebSocket Event → Gateway Handler → Service Method → Update State → Emit Response
```

**Example: Buying a Piece**
1. Client drags piece from shop → `SHOP_BUY` event
2. `GameGateway.handleShopBuy()` receives event
3. `GameService.purchasePiece()` validates and processes
4. `PlayerService.updateSession()` saves new state
5. `GAME_STATE_UPDATE` sent back to client

## 🔧 Configuration

### Environment Variables
```bash
PORT=3001                          # Server port
FRONTEND_URL=http://localhost:3000 # CORS origin
NODE_ENV=development               # Environment mode
```

### NestJS Configuration
- **Global Prefix**: `/api` for all REST endpoints
- **CORS**: Enabled for frontend origin
- **WebSocket**: Socket.IO with credentials support

## 🧪 Development Tools

### Debug Endpoints
Access at `http://localhost:3001/api/debug/sessions` to:
- View all active player sessions
- Inspect detailed game state
- Clear sessions for testing
- Monitor WebSocket connections

### Logging
Comprehensive console logging for:
- Player connections/disconnections
- Game state changes
- Error conditions
- Performance metrics

## 📋 Common Development Tasks

### Adding New Game Mechanics
1. **Define Logic** - Add methods to `GameService`
2. **Add WebSocket Events** - Update `GameGateway` handlers
3. **Update Types** - Modify shared types if needed
4. **Test** - Use debug endpoints to verify functionality

### Adding New Piece Types
1. **Update Piece Library** - Modify `src/app/data/pieces.ts`
2. **Add Mechanics** - Update stat calculation logic
3. **Test Interactions** - Verify adjacency bonuses work correctly

### Debugging Issues
1. **Check Logs** - Console output shows detailed operation flow
2. **Inspect Sessions** - Use `/api/debug/sessions` endpoint
3. **Test WebSocket** - Monitor client/server communication
4. **Validate State** - Ensure game state consistency

## 🔍 Troubleshooting

### Common Issues

**Sessions Not Persisting**
- Check that PlayerService is mapping sockets correctly
- Verify localStorage player ID is being sent
- Ensure session storage is not being cleared inadvertently

**WebSocket Events Not Working**
- Verify event names match between client and server
- Check that GameGateway handlers are properly decorated
- Ensure CORS is configured for WebSocket connections

**Game State Inconsistencies**
- Check that all state updates go through PlayerService
- Verify that validation logic is comprehensive
- Ensure draft state save/restore is working correctly

**Performance Issues**
- Monitor session storage size and cleanup
- Check for memory leaks in WebSocket connections
- Profile game logic for expensive operations

## 🔗 Related Documentation

- [Main Project README](../README.md)
- [Frontend README](../frontend/README.md)
- [Player Module README](./src/player/README.md)
- [Game Module README](./src/game/README.md)
- [Debug Module README](./src/debug/README.md)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Socket.IO Documentation](https://socket.io/docs/v4/)