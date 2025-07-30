import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SOCKET_EVENTS } from '@aquarium/shared-types';

@ApiTags('websocket')
@Controller('websocket')
export class WebSocketDocsController {
  @Get('events')
  @ApiOperation({ 
    summary: 'Get WebSocket events documentation',
    description: 'Returns comprehensive documentation of all WebSocket events, their payloads, and usage examples.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'WebSocket events documentation',
    example: {
      connection: { url: 'ws://localhost:3001', description: 'WebSocket connection endpoint' },
      events: {
        'session:init': {
          direction: 'Client → Server',
          description: 'Initialize a game session with player ID',
          payload: { playerId: 'player-abc123' }
        }
      }
    }
  })
  getWebSocketEvents() {
    return {
      connection: {
        url: 'ws://localhost:3001',
        description: 'WebSocket connection endpoint for real-time game communication',
        library: 'socket.io',
        cors: {
          origin: process.env.FRONTEND_URL || 'http://localhost:3000',
          credentials: true
        }
      },
      events: {
        // Client → Server Events
        [SOCKET_EVENTS.SESSION_INIT]: {
          direction: 'Client → Server',
          description: 'Initialize or reconnect to a game session',
          payload: {
            playerId: 'string (e.g., "player-abc123")'
          },
          example: {
            event: SOCKET_EVENTS.SESSION_INIT,
            data: { playerId: 'player-abc123' }
          },
          response: SOCKET_EVENTS.GAME_STATE_UPDATE
        },
        
        [SOCKET_EVENTS.SHOP_BUY]: {
          direction: 'Client → Server',
          description: 'Purchase a piece from the shop',
          payload: {
            sessionId: 'string',
            playerId: 'string',
            pieceId: 'string',
            shopIndex: 'number (0-5)'
          },
          example: {
            event: SOCKET_EVENTS.SHOP_BUY,
            data: { sessionId: 'player-123', playerId: 'player-123', pieceId: 'piece-456', shopIndex: 0 }
          },
          response: SOCKET_EVENTS.GAME_STATE_UPDATE
        },
        
        [SOCKET_EVENTS.SHOP_SELL]: {
          direction: 'Client → Server',
          description: 'Sell a piece from your tank',
          payload: {
            sessionId: 'string',
            playerId: 'string',
            pieceId: 'string'
          },
          example: {
            event: SOCKET_EVENTS.SHOP_SELL,
            data: { sessionId: 'player-123', playerId: 'player-123', pieceId: 'piece-456' }
          },
          response: SOCKET_EVENTS.GAME_STATE_UPDATE
        },
        
        [SOCKET_EVENTS.SHOP_REROLL]: {
          direction: 'Client → Server',
          description: 'Reroll the shop for new pieces (costs 2 gold)',
          payload: {
            sessionId: 'string',
            playerId: 'string'
          },
          example: {
            event: SOCKET_EVENTS.SHOP_REROLL,
            data: { sessionId: 'player-123', playerId: 'player-123' }
          },
          response: SOCKET_EVENTS.GAME_STATE_UPDATE
        },
        
        [SOCKET_EVENTS.SHOP_LOCK]: {
          direction: 'Client → Server',
          description: 'Lock/unlock a shop slot to prevent rerolling',
          payload: {
            sessionId: 'string',
            playerId: 'string',
            shopIndex: 'number (0-5)'
          },
          example: {
            event: SOCKET_EVENTS.SHOP_LOCK,
            data: { sessionId: 'player-123', playerId: 'player-123', shopIndex: 2 }
          },
          response: SOCKET_EVENTS.GAME_STATE_UPDATE
        },
        
        [SOCKET_EVENTS.TANK_UPDATE]: {
          direction: 'Client → Server',
          description: 'Place, move, or remove a piece in your tank',
          payload: {
            sessionId: 'string',
            playerId: 'string',
            pieceId: 'string',
            position: '{ x: number, y: number }',
            action: '"place" | "move" | "remove"'
          },
          example: {
            event: SOCKET_EVENTS.TANK_UPDATE,
            data: { 
              sessionId: 'player-123', 
              playerId: 'player-123', 
              pieceId: 'piece-456', 
              position: { x: 2, y: 1 }, 
              action: 'place' 
            }
          },
          response: SOCKET_EVENTS.GAME_STATE_UPDATE
        },
        
        [SOCKET_EVENTS.ENTER_PLACEMENT_PHASE]: {
          direction: 'Client → Server',
          description: 'Enter placement phase to view opponent and prepare for battle',
          payload: {
            sessionId: 'string',
            playerId: 'string'
          },
          example: {
            event: SOCKET_EVENTS.ENTER_PLACEMENT_PHASE,
            data: { sessionId: 'player-123', playerId: 'player-123' }
          },
          response: [SOCKET_EVENTS.GAME_STATE_UPDATE, SOCKET_EVENTS.PHASE_CHANGED]
        },
        
        [SOCKET_EVENTS.ENTER_BATTLE_PHASE]: {
          direction: 'Client → Server',
          description: 'Start live battle simulation',
          payload: {
            sessionId: 'string',
            playerId: 'string'
          },
          example: {
            event: SOCKET_EVENTS.ENTER_BATTLE_PHASE,
            data: { sessionId: 'player-123', playerId: 'player-123' }
          },
          response: [SOCKET_EVENTS.GAME_STATE_UPDATE, SOCKET_EVENTS.BATTLE_STEP, SOCKET_EVENTS.BATTLE_COMPLETE]
        },
        
        [SOCKET_EVENTS.GET_CALCULATED_STATS]: {
          direction: 'Client → Server',
          description: 'Request calculated stats for all placed pieces (includes bonuses)',
          payload: 'none',
          example: {
            event: SOCKET_EVENTS.GET_CALCULATED_STATS,
            data: {}
          },
          response: SOCKET_EVENTS.CALCULATED_STATS_UPDATE
        },
        
        [SOCKET_EVENTS.SAVE_DRAFT_STATE]: {
          direction: 'Client → Server',
          description: 'Save current game state as draft (for restore after disconnect)',
          payload: {
            draftState: 'GameState object (optional, uses current state if not provided)'
          },
          example: {
            event: SOCKET_EVENTS.SAVE_DRAFT_STATE,
            data: { draftState: { /* game state */ } }
          },
          response: SOCKET_EVENTS.DRAFT_STATE_SAVED
        },
        
        [SOCKET_EVENTS.RESTORE_DRAFT_STATE]: {
          direction: 'Client → Server',
          description: 'Restore previously saved draft state',
          payload: 'none',
          example: {
            event: SOCKET_EVENTS.RESTORE_DRAFT_STATE,
            data: {}
          },
          response: SOCKET_EVENTS.GAME_STATE_UPDATE
        },
        
        // Server → Client Events
        [SOCKET_EVENTS.GAME_STATE_UPDATE]: {
          direction: 'Server → Client',
          description: 'Complete game state update (sent after most actions)',
          payload: {
            phase: '"shop" | "placement" | "battle"',
            round: 'number',
            gold: 'number',
            playerTank: 'Tank object with pieces and grid',
            opponentTank: 'Tank object',
            shop: 'Array of 6 GamePiece objects (or null)',
            battleState: 'BattleState object (if in battle)',
            // ... and more game state properties
          },
          triggered_by: 'Most client actions'
        },
        
        [SOCKET_EVENTS.BATTLE_STEP]: {
          direction: 'Server → Client',
          description: 'Individual battle event during live battle simulation',
          payload: {
            id: 'string',
            type: '"round_start" | "attack" | "damage" | "heal" | etc.',
            source: 'string',
            sourceName: 'string',
            target: 'string (optional)',
            targetName: 'string (optional)',
            value: 'number',
            round: 'number',
            turn: 'number',
            timestamp: 'number',
            description: 'string'
          },
          triggered_by: SOCKET_EVENTS.ENTER_BATTLE_PHASE
        },
        
        [SOCKET_EVENTS.BATTLE_COMPLETE]: {
          direction: 'Server → Client',
          description: 'Battle finished with final results and rewards',
          payload: {
            result: '"player" | "opponent" | "draw"',
            events: 'Array of all battle events',
            rewards: {
              playerGold: 'number',
              playerInterest: 'number',
              opponentGold: 'number',
              opponentInterest: 'number'
            }
          },
          triggered_by: 'End of battle simulation'
        },
        
        [SOCKET_EVENTS.PHASE_CHANGED]: {
          direction: 'Server → Client',
          description: 'Game phase transition notification',
          payload: {
            phase: '"shop" | "placement" | "battle"'
          },
          triggered_by: [SOCKET_EVENTS.ENTER_PLACEMENT_PHASE, SOCKET_EVENTS.ENTER_BATTLE_PHASE]
        },
        
        [SOCKET_EVENTS.CALCULATED_STATS_UPDATE]: {
          direction: 'Server → Client',
          description: 'Updated stats for all pieces including adjacency bonuses',
          payload: {
            '[pieceId]': {
              attack: 'number',
              health: 'number',
              speed: 'number'
            }
            // ... for each placed piece
          },
          triggered_by: SOCKET_EVENTS.GET_CALCULATED_STATS
        },
        
        [SOCKET_EVENTS.DRAFT_STATE_SAVED]: {
          direction: 'Server → Client',
          description: 'Confirmation that draft state was saved',
          payload: {
            // Complete saved draft state
            lastModified: 'number (timestamp)'
            // ... rest of game state
          },
          triggered_by: SOCKET_EVENTS.SAVE_DRAFT_STATE
        },
        
        [SOCKET_EVENTS.ERROR]: {
          direction: 'Server → Client',
          description: 'Error occurred during operation',
          payload: {
            code: 'string (e.g., "PURCHASE_FAILED")',
            message: 'string (human readable error)',
            details: 'any (additional error info)'
          },
          triggered_by: 'Any failed operation'
        }
      },
      
      usage_examples: {
        javascript: {
          description: 'Basic usage with socket.io-client',
          code: `
import { io } from 'socket.io-client';
import { SOCKET_EVENTS } from '@aquarium/shared-types';

const socket = io('http://localhost:3001');

// Initialize session
socket.emit(SOCKET_EVENTS.SESSION_INIT, { 
  playerId: 'player-abc123' 
});

// Listen for game state updates
socket.on(SOCKET_EVENTS.GAME_STATE_UPDATE, (gameState) => {
  console.log('Game state updated:', gameState);
});

// Purchase a piece
socket.emit(SOCKET_EVENTS.SHOP_BUY, {
  sessionId: 'player-abc123',
  playerId: 'player-abc123',
  pieceId: 'piece-456',
  shopIndex: 0
});

// Handle errors
socket.on(SOCKET_EVENTS.ERROR, (error) => {
  console.error('Game error:', error);
});
          `.trim()
        },
        
        react: {
          description: 'React hook usage pattern',
          code: `
import { useGame } from './contexts/GameContext';

function GameComponent() {
  const { 
    gameState, 
    connected, 
    purchasePiece, 
    placePiece, 
    startBattle 
  } = useGame();
  
  const handlePurchase = (pieceId, shopIndex) => {
    purchasePiece(pieceId, shopIndex);
  };
  
  return (
    <div>
      {connected ? (
        <p>Gold: {gameState?.gold}</p>
      ) : (
        <p>Connecting...</p>
      )}
    </div>
  );
}
          `.trim()
        }
      },
      
      debugging: {
        common_issues: [
          {
            issue: 'Connection failed',
            solution: 'Check that game engine is running on port 3001 and CORS is configured'
          },
          {
            issue: 'Session not found',
            solution: 'Ensure SESSION_INIT was called successfully before other operations'
          },
          {
            issue: 'Purchase failed',
            solution: 'Check gold amount, shop index validity, and that piece exists'
          },
          {
            issue: 'Placement failed',
            solution: 'Verify position is valid and piece shape fits in tank grid'
          }
        ],
        debug_endpoints: [
          'GET /api/debug/sessions - View all active sessions',
          'GET /api/debug/session/:playerId - View specific session details',
          'DELETE /api/debug/player/:playerId - Delete player session',
          'POST /api/debug/player/:playerId - Create/reset player session'
        ]
      }
    };
  }
}