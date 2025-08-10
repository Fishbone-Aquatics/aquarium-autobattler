import { Injectable } from '@nestjs/common';
import { PlayerService } from '../player/player.service';
import { GameService } from '../game/game.service';
import { EconomyService } from '../economy/economy.service';

@Injectable()
export class DebugService {
  constructor(
    private playerService: PlayerService,
    private gameService: GameService,
    private economyService: EconomyService
  ) {}

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
      winStreak: 0,
      opponentLossStreak: 0,
      opponentWinStreak: 0,
      wins: 0,
      losses: 0,
      opponentWins: 0,
      opponentLosses: 0,
      playerTank: {
        id: playerId,
        pieces: [],
        waterQuality: 7, // Debug default
        baseWaterQuality: 7, // Debug default
        temperature: 25,
        grid: Array(6).fill(null).map(() => Array(8).fill(null)),
      },
      opponentTank: {
        id: 'opponent',
        pieces: [],
        waterQuality: 7, // Debug default
        baseWaterQuality: 7, // Debug default
        temperature: 25,
        grid: Array(6).fill(null).map(() => Array(8).fill(null)),
      },
      shop: this.economyService.generateShop(),
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
   * Update specific fields in a player session
   */
  updatePlayerSession(playerId: string, updates: any) {
    try {
      const gameState = this.playerService.getSession(playerId);
      
      // Allow updating specific fields
      const allowedFields = ['round', 'gold', 'phase', 'wins', 'losses', 'lossStreak', 'opponentLossStreak'];
      const updatedFields: string[] = [];
      
      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          (gameState as any)[key] = value;
          updatedFields.push(`${key}: ${value}`);
        }
      }
      
      if (updatedFields.length === 0) {
        return {
          message: `No valid fields to update. Allowed: ${allowedFields.join(', ')}`,
          success: false,
          playerId,
          allowedFields
        };
      }
      
      this.playerService.updateSession(playerId, gameState);
      
      return {
        message: `Updated player ${playerId}`,
        success: true,
        playerId,
        updatedFields,
        currentState: {
          round: gameState.round,
          gold: gameState.gold,
          phase: gameState.phase,
          wins: gameState.wins,
          losses: gameState.losses,
          lossStreak: gameState.lossStreak,
          opponentLossStreak: gameState.opponentLossStreak
        }
      };
    } catch (error) {
      return {
        message: `Failed to update player ${playerId}: ${error.message}`,
        success: false,
        playerId,
        error: error.message
      };
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