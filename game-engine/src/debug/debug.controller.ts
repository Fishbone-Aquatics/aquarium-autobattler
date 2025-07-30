import { Controller, Get, Post, Param } from '@nestjs/common';
import { DebugService } from './debug.service';

@Controller('debug')
export class DebugController {
  constructor(private readonly debugService: DebugService) {}

  /**
   * Debug endpoint to get all active game sessions
   * @returns Array of session summaries including player IDs, game state, and draft status
   * 
   * Example response:
   * [
   *   {
   *     "playerId": "player-abc123",
   *     "socketIds": ["socket-123"],
   *     "gold": 10,
   *     "round": 1,
   *     "pieces": 2,
   *     "hasDraftState": true,
   *     "draftStateLastModified": "2025-01-01T00:00:00.000Z"
   *   }
   * ]
   */
  @Get('sessions')
  getAllSessions() {
    return this.debugService.getAllSessions();
  }

  /**
   * Debug endpoint to get detailed information about a specific session
   * @param playerId - The player ID to look up
   * @returns Detailed session data including full game state and draft state
   * 
   * Example: GET /api/debug/session/player-abc123
   * Returns complete game state with all pieces, shop, gold history, etc.
   */
  @Get('session/:playerId')
  getSession(@Param('playerId') playerId: string) {
    return this.debugService.getSessionDebug(playerId);
  }

  /**
   * Debug endpoint to clear all game sessions
   * WARNING: This will delete all active game sessions and cannot be undone
   * @returns Confirmation message with number of sessions cleared
   * 
   * Example: POST /api/debug/clear-all-sessions
   * Returns: { "message": "Cleared 5 sessions", "clearedCount": 5 }
   */
  @Post('clear-all-sessions')
  clearAllSessions() {
    return this.debugService.clearAllSessions();
  }
}