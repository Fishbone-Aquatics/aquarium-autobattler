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
   * Delete a specific player session
   */
  deletePlayerSession(playerId: string) {
    const existed = this.playerService.deleteSession(playerId);
    
    if (existed) {
      return {
        message: `Deleted session for player: ${playerId}`,
        playerId,
        success: true
      };
    } else {
      return {
        message: `Session not found for player: ${playerId}`,
        playerId,
        success: false
      };
    }
  }

  /**
   * Create or reset a player session
   */
  createPlayerSession(playerId: string) {
    // Create initial game state
    const initialState = {
      phase: 'shop' as const,
      round: 1,
      gold: 10,
      lossStreak: 0,
      opponentLossStreak: 0,
      wins: 0,
      losses: 0,
      opponentWins: 0,
      opponentLosses: 0,
      playerTank: {
        id: playerId,
        pieces: [],
        waterQuality: 5,
        temperature: 25,
        grid: Array(6).fill(null).map(() => Array(8).fill(null)),
      },
      opponentTank: {
        id: 'opponent',
        pieces: [],
        waterQuality: 5,
        temperature: 25,
        grid: Array(6).fill(null).map(() => Array(8).fill(null)),
      },
      shop: [],
      battleEvents: [],
      selectedPiece: null,
      opponentGold: 10,
      lockedShopIndex: null,
      goldHistory: [{
        id: `${Date.now()}-${Math.random()}`,
        round: 1,
        type: 'round_start' as const,
        amount: 10,
        description: 'Starting gold',
        timestamp: Date.now(),
      }],
      rerollsThisRound: 0,
    };
    
    const session = this.playerService.createOrResetSession(playerId, initialState);
    
    return {
      message: `Created/reset session for player: ${playerId}`,
      playerId,
      gameState: session,
      success: true
    };
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