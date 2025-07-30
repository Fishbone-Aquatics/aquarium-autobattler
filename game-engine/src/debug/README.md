# 🔧 Debug Module - Development & Admin Tools

The Debug module provides essential development tools and administrative endpoints for inspecting, debugging, and managing the Aquarium Autobattler game state.

## 🎯 Purpose

This module enables developers and administrators to:
- **Inspect Sessions** - View all active player sessions and their state
- **Debug Game State** - Examine detailed game data for troubleshooting
- **Admin Actions** - Clear sessions and reset state for testing
- **Development Support** - Provide tools for rapid development and debugging

## 🏗️ Architecture

```
src/debug/
├── debug.controller.ts  # REST API endpoints for debugging
├── debug.service.ts     # Core debug logic and data aggregation
└── debug.module.ts      # NestJS module definition
```

## 🔧 Key Components

### DebugController
REST API controller providing HTTP endpoints for debug operations:
- Session listing and inspection
- Administrative actions
- Comprehensive API documentation

### DebugService
Service layer handling debug logic and data aggregation:
- Integration with PlayerService for session data
- Data formatting for API responses
- Safe admin operations

## 🌐 API Endpoints

### `GET /api/debug/sessions`

**Purpose**: List all active player sessions with summary information

**Response Format**:
```json
[
  {
    "playerId": "player-abc123",
    "socketIds": ["socket-xyz789"],
    "gold": 15,
    "round": 3,
    "pieces": 4,
    "hasDraftState": true,
    "draftStateLastModified": "2025-07-30T02:42:28.482Z"
  }
]
```

**Use Cases**:
- Quick overview of all active players
- Monitor session activity during development
- Identify players with saved draft states
- Track game progression across sessions

**Implementation**:
```typescript
getAllSessions() {
  const sessions = [];
  const allSessions = this.playerService.getAllSessions();
  const socketMappings = this.playerService.getSocketMappings();
  
  for (const [playerId, gameState] of allSessions.entries()) {
    // Aggregate session summary data
    sessions.push({
      playerId,
      socketIds: this.findSocketsForPlayer(playerId),
      gold: gameState.gold,
      round: gameState.round,
      pieces: gameState.playerTank.pieces.length,
      hasDraftState: !!gameState.draftState,
      draftStateLastModified: gameState.draftState?.lastModified
    });
  }
  return sessions;
}
```

### `GET /api/debug/session/:playerId`

**Purpose**: Get detailed information about a specific player session

**Parameters**:
- `playerId`: The player ID to inspect (e.g., "player-abc123")

**Response Format**:
```json
{
  "playerId": "player-abc123",
  "gameState": {
    "phase": "shop",
    "round": 3,
    "gold": 15,
    "playerTank": {
      "pieces": [...],
      "grid": [[...]],
      "waterQuality": 5,
      "temperature": 25
    },
    "shop": [...],
    "goldHistory": [...],
    "draftState": {...}
  },
  "draftState": {
    "gold": 12,
    "round": 2,
    "pieces": 3,
    "lastModified": "2025-07-30T02:42:28.482Z",
    "fullDraftState": {...}
  }
}
```

**Use Cases**:
- Deep dive into specific player's game state
- Debug piece placement and tank configuration
- Examine gold transaction history
- Inspect draft state saves and modifications

**Error Handling**:
```typescript
getSessionDebug(playerId: string) {
  try {
    const gameState = this.playerService.getSession(playerId);
    return { playerId, gameState, draftState: ... };
  } catch (error) {
    return { error: 'Session not found' };
  }
}
```

### `POST /api/debug/clear-all-sessions`

**Purpose**: Clear all active game sessions (admin/testing tool)

**⚠️ WARNING**: This action is destructive and cannot be undone!

**Response Format**:
```json
{
  "message": "Cleared 5 sessions",
  "clearedCount": 5,
  "socketMappingsCleared": 3
}
```

**Use Cases**:
- Reset environment for testing
- Clear stale sessions during development
- Emergency cleanup of corrupted state
- Prepare clean slate for demonstrations

**Implementation**:
```typescript
clearAllSessions() {
  const { sessionCount, socketCount } = this.playerService.clearAllSessions();
  
  return {
    message: `Cleared ${sessionCount} sessions`,
    clearedCount: sessionCount,
    socketMappingsCleared: socketCount
  };
}
```

## 🔍 Data Insights

### Session Summary Data

The module provides rich summary data for quick assessment:

**Player Activity Tracking**:
- Active WebSocket connections per player
- Current game phase and round progression
- Resource status (gold, pieces owned)

**Draft State Monitoring**:
- Whether player has saved progress
- Last modification timestamp
- Draft state freshness indicators

**Resource Analysis**:
- Gold distribution across players
- Piece collection patterns
- Game progression stages

### Detailed Session Inspection

For deep debugging, the module exposes complete game state:

**Tank Configuration**:
```json
"playerTank": {
  "pieces": [
    {
      "id": "piece-123",
      "name": "Neon Tetra",
      "type": "fish",
      "stats": { "attack": 2, "health": 1, "speed": 3 },
      "position": { "x": 2, "y": 1 },
      "shape": [{ "x": 0, "y": 0 }]
    }
  ],
  "grid": [...],  // 8x6 grid with piece placement
  "waterQuality": 5,
  "temperature": 25
}
```

**Economy Tracking**:
```json
"goldHistory": [
  {
    "id": "txn-123",
    "round": 1,
    "type": "purchase",
    "amount": -3,
    "description": "Purchased Neon Tetra",
    "timestamp": 1643723400000,
    "pieceId": "piece-123",
    "pieceName": "Neon Tetra"
  }
]
```

## 🛠️ Development Workflows

### Session Debugging Workflow

1. **List Active Sessions**
   ```bash
   curl http://localhost:3001/api/debug/sessions
   ```

2. **Identify Problem Session**
   ```bash
   # Look for unusual gold, pieces, or draft state
   ```

3. **Deep Dive Investigation**
   ```bash
   curl http://localhost:3001/api/debug/session/player-abc123
   ```

4. **Analyze Game State**
   ```bash
   # Examine pieces, gold history, tank configuration
   ```

### Testing Environment Setup

1. **Clear Previous State**
   ```bash
   curl -X POST http://localhost:3001/api/debug/clear-all-sessions
   ```

2. **Run Test Scenarios**
   ```bash
   # Execute automated tests or manual testing
   ```

3. **Monitor Session Creation**
   ```bash
   # Watch debug endpoints for new sessions
   ```

### Live Development Support

**Frontend Integration**:
```typescript
// Frontend can link directly to debug endpoints
const debugUrl = `${API_URL}/api/debug/session/${playerId}`;
console.log(`Session Debug: ${debugUrl}`);
```

**Error Investigation**:
```typescript
// When WebSocket errors occur, inspect full state
fetch(`/api/debug/session/${playerId}`)
  .then(res => res.json())
  .then(data => console.log('Full session state:', data));
```

## 🔐 Security Considerations

### Development-Only Features

The debug module should be used only in development environments:

```typescript
// Production safety check (recommended addition)
if (process.env.NODE_ENV === 'production') {
  throw new Error('Debug endpoints not available in production');
}
```

### Data Exposure

Debug endpoints expose complete game state:
- Player strategies and configurations
- Economic transaction history
- Draft states and saved progress

**Recommendation**: Restrict access in production or staging environments.

### Admin Actions

The `clear-all-sessions` endpoint is destructive:
- Cannot be undone
- Affects all active players
- Should be protected with authentication in production

## 🧪 Testing Integration

### Unit Testing Debug Logic

```typescript
describe('DebugService', () => {
  it('should aggregate session summaries correctly', () => {
    const sessions = service.getAllSessions();
    expect(sessions).toHaveLength(expectedCount);
    expect(sessions[0]).toHaveProperty('playerId');
    expect(sessions[0]).toHaveProperty('gold');
  });

  it('should handle missing sessions gracefully', () => {
    const result = service.getSessionDebug('invalid-player');
    expect(result).toHaveProperty('error');
  });
});
```

### Integration Testing API Endpoints

```typescript
describe('DebugController', () => {
  it('GET /debug/sessions should return session list', async () => {
    const response = await request(app)
      .get('/api/debug/sessions')
      .expect(200);
    
    expect(Array.isArray(response.body)).toBe(true);
  });

  it('POST /debug/clear-all-sessions should clear state', async () => {
    const response = await request(app)
      .post('/api/debug/clear-all-sessions')
      .expect(200);
    
    expect(response.body).toHaveProperty('clearedCount');
  });
});
```

## 📊 Monitoring & Observability

### Session Health Metrics

Track key indicators through debug endpoints:

**Active Session Count**:
```typescript
const activeSessions = await fetch('/api/debug/sessions');
const sessionCount = (await activeSessions.json()).length;
```

**Resource Distribution**:
```typescript
// Monitor gold distribution across players
const sessions = await getSessions();
const goldDistribution = sessions.map(s => ({ 
  playerId: s.playerId, 
  gold: s.gold 
}));
```

**Draft State Adoption**:
```typescript
// Track how many players are using save feature
const draftUsers = sessions.filter(s => s.hasDraftState).length;
const adoptionRate = draftUsers / sessions.length;
```

## 🔗 Frontend Integration

### Direct Debug Links

Frontend can provide direct links to debug data:

```tsx
// Footer component showing player info
function Footer({ playerId }) {
  const debugUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/debug/session/${playerId}`;
  
  return (
    <div>
      Player: {playerId} 
      <a href={debugUrl} target="_blank">🔍 Debug</a>
    </div>
  );
}
```

### Development Mode Features

```tsx
// Show debug info only in development
{process.env.NODE_ENV === 'development' && (
  <DebugPanel playerId={playerId} />
)}
```

## 🔮 Future Enhancements

### Advanced Analytics

```typescript
// Session analytics
interface SessionAnalytics {
  averageSessionDuration: number;
  mostPopularPieces: string[];
  goldFlowAnalysis: EconomyMetrics;
  playerProgressionPatterns: ProgressionData[];
}
```

### Real-time Monitoring

```typescript
// WebSocket debug events
@SubscribeMessage('debug:subscribe')
handleDebugSubscription(client: Socket) {
  // Send real-time session updates
  this.server.emit('debug:session-update', sessionData);
}
```

### Export Capabilities

```typescript
// Export session data for analysis
@Get('export/:playerId')
exportSession(@Param('playerId') playerId: string) {
  const session = this.getSessionDebug(playerId);
  // Return CSV, JSON, or other formats
}
```

## 🔗 Related Documentation

- [Player Module README](../player/README.md) - Session management integration
- [Game Module README](../game/README.md) - Game state structure
- [Game Engine README](../README.md) - Overall architecture
- [Frontend README](../../../frontend/README.md) - Client-side integration
- [Main Project README](../../../README.md) - Project overview