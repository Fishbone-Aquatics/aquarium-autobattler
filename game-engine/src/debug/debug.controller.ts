import { Controller, Get, Post, Delete, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { DebugService } from './debug.service';

@ApiTags('debug')
@Controller('debug')
export class DebugController {
  constructor(private readonly debugService: DebugService) {}

  @Get('sessions')
  @ApiOperation({ 
    summary: 'Get all active game sessions',
    description: 'Returns a summary of all active game sessions including player IDs, current game state, and draft save status.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Array of session summaries',
    example: [{
      playerId: 'player-abc123',
      socketIds: ['socket-123'],
      gold: 10,
      round: 1,
      pieces: 2,
      hasDraftState: true,
      draftStateLastModified: '2025-01-01T00:00:00.000Z'
    }]
  })
  getAllSessions() {
    return this.debugService.getAllSessions();
  }

  @Get('session/:playerId')
  @ApiOperation({ 
    summary: 'Get detailed session information',
    description: 'Returns complete game state and draft state for a specific player.'
  })
  @ApiParam({ name: 'playerId', description: 'Player ID to look up', example: 'player-abc123' })
  @ApiResponse({ 
    status: 200, 
    description: 'Detailed session data',
    example: {
      playerId: 'player-abc123',
      gameState: { phase: 'shop', round: 1, gold: 10 },
      draftState: { gold: 10, round: 1, pieces: 2 }
    }
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  getSession(@Param('playerId') playerId: string) {
    return this.debugService.getSessionDebug(playerId);
  }

  @Delete('player/:playerId')
  @ApiOperation({ 
    summary: 'Delete a player session',
    description: 'Removes a specific player session and all associated socket mappings.'
  })
  @ApiParam({ name: 'playerId', description: 'Player ID to delete', example: 'player-abc123' })
  @ApiResponse({ 
    status: 200, 
    description: 'Session deleted successfully',
    example: { message: 'Deleted session for player: player-abc123', playerId: 'player-abc123', success: true }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Session not found',
    example: { message: 'Session not found for player: player-abc123', playerId: 'player-abc123', success: false }
  })
  deletePlayerSession(@Param('playerId') playerId: string) {
    return this.debugService.deletePlayerSession(playerId);
  }

  @Post('player/:playerId')
  @ApiOperation({ 
    summary: 'Create or reset a player session',
    description: 'Creates a new session or resets an existing session with fresh game state.'
  })
  @ApiParam({ name: 'playerId', description: 'Player ID to create/reset', example: 'player-abc123' })
  @ApiResponse({ 
    status: 200, 
    description: 'Session created/reset successfully',
    example: { 
      message: 'Created/reset session for player: player-abc123', 
      playerId: 'player-abc123',
      gameState: { phase: 'shop', round: 1, gold: 10 },
      success: true 
    }
  })
  createPlayerSession(@Param('playerId') playerId: string) {
    return this.debugService.createPlayerSession(playerId);
  }

  @Patch('player/:playerId')
  @ApiOperation({ 
    summary: 'Update specific fields in a player session',
    description: 'Updates specific game state fields for debugging/testing purposes. Allowed fields: round, gold, phase, wins, losses, lossStreak, opponentLossStreak'
  })
  @ApiParam({ name: 'playerId', description: 'Player ID to update', example: 'player-abc123' })
  @ApiResponse({ 
    status: 200, 
    description: 'Session updated successfully',
    example: { 
      message: 'Updated player player-abc123', 
      success: true,
      playerId: 'player-abc123',
      updatedFields: ['round: 14', 'gold: 50'],
      currentState: { round: 14, gold: 50, phase: 'shop', wins: 5, losses: 2 }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid fields or player not found',
    example: { 
      message: 'No valid fields to update. Allowed: round, gold, phase, wins, losses, lossStreak, opponentLossStreak',
      success: false,
      playerId: 'player-abc123',
      allowedFields: ['round', 'gold', 'phase', 'wins', 'losses', 'lossStreak', 'opponentLossStreak']
    }
  })
  updatePlayerSession(@Param('playerId') playerId: string, @Body() updates: any) {
    return this.debugService.updatePlayerSession(playerId, updates);
  }

  @Post('clear-all-sessions')
  @ApiOperation({ 
    summary: 'Clear all game sessions',
    description: '⚠️ WARNING: This will delete ALL active game sessions and cannot be undone!'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'All sessions cleared',
    example: { message: 'Cleared 5 sessions', clearedCount: 5, socketMappingsCleared: 3 }
  })
  clearAllSessions() {
    return this.debugService.clearAllSessions();
  }
}