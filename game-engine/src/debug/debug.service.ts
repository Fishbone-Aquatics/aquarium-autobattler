import { Injectable } from '@nestjs/common';
import { PlayerService } from '../player/player.service';

@Injectable()
export class DebugService {
  constructor(private playerService: PlayerService) {}

  /**
   * Get all active sessions for debugging
   */
  getAllSessions() {
    const sessions = [];
    const allSessions = this.playerService.getAllSessions();
    const socketMappings = this.playerService.getSocketMappings();
    
    for (const [playerId, gameState] of allSessions.entries()) {
      // Find active socket IDs for this player
      const socketIds = [];
      for (const [socketId, pId] of socketMappings.entries()) {
        if (pId === playerId) {
          socketIds.push(socketId);
        }
      }
      
      sessions.push({
        playerId,
        socketIds,
        gold: gameState.gold,
        round: gameState.round,
        pieces: gameState.playerTank.pieces.length,
        hasDraftState: !!gameState.draftState,
        draftStateLastModified: gameState.draftState?.lastModified ? 
          new Date(gameState.draftState.lastModified).toISOString() : null
      });
    }
    return sessions;
  }

  /**
   * Get detailed information about a specific session
   */
  getSessionDebug(playerId: string) {
    try {
      const gameState = this.playerService.getSession(playerId);
      
      return {
        playerId,
        gameState: gameState,
        draftState: gameState.draftState ? {
          gold: gameState.draftState.gold,
          round: gameState.draftState.round,
          pieces: gameState.draftState.playerTank?.pieces?.length || 0,
          lastModified: new Date(gameState.draftState.lastModified).toISOString(),
          fullDraftState: gameState.draftState
        } : null
      };
    } catch (error) {
      return { error: 'Session not found' };
    }
  }

  /**
   * Clear all sessions for debugging
   */
  clearAllSessions() {
    const { sessionCount, socketCount } = this.playerService.clearAllSessions();
    
    return {
      message: `Cleared ${sessionCount} sessions`,
      clearedCount: sessionCount,
      socketMappingsCleared: socketCount
    };
  }
}