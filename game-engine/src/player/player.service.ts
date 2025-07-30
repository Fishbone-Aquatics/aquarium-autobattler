import { Injectable, NotFoundException } from '@nestjs/common';
import { GameState } from '@aquarium/shared-types';

export interface PlayerSession {
  playerId: string;
  gameState: GameState;
  lastActivity: Date;
}

@Injectable()
export class PlayerService {
  private sessions = new Map<string, GameState>();
  private socketToPlayer = new Map<string, string>(); // Maps socket ID to player ID

  /**
   * Map a socket connection to a player ID
   */
  mapSocketToPlayer(socketId: string, playerId: string): void {
    this.socketToPlayer.set(socketId, playerId);
  }

  /**
   * Get player ID from socket ID
   */
  getPlayerIdFromSocket(socketId: string): string {
    const playerId = this.socketToPlayer.get(socketId);
    if (!playerId) {
      throw new NotFoundException('Player ID not found for socket');
    }
    return playerId;
  }

  /**
   * Remove socket mapping when disconnected
   */
  removeSocketMapping(socketId: string): void {
    this.socketToPlayer.delete(socketId);
    console.log('🔌 Removed socket mapping for:', socketId);
  }

  /**
   * Get or create player session
   */
  getOrCreateSession(playerId: string, initialState: GameState): GameState {
    const existing = this.sessions.get(playerId);
    if (existing) {
      console.log('🔄 Reconnecting to existing session for player:', playerId);
      return existing;
    }
    
    console.log('🆕 Creating new session for player:', playerId);
    this.sessions.set(playerId, initialState);
    return initialState;
  }

  /**
   * Get player session
   */
  getSession(playerId: string): GameState {
    const session = this.sessions.get(playerId);
    if (!session) {
      throw new NotFoundException('Player session not found');
    }
    return session;
  }

  /**
   * Update player session
   */
  updateSession(playerId: string, gameState: GameState): void {
    this.sessions.set(playerId, gameState);
  }

  /**
   * Get all player sessions (for debugging)
   */
  getAllSessions(): Map<string, GameState> {
    return this.sessions;
  }

  /**
   * Get all socket mappings (for debugging)
   */
  getSocketMappings(): Map<string, string> {
    return this.socketToPlayer;
  }

  /**
   * Clear all sessions (for debugging)
   */
  clearAllSessions(): { sessionCount: number; socketCount: number } {
    const sessionCount = this.sessions.size;
    const socketCount = this.socketToPlayer.size;
    
    this.sessions.clear();
    this.socketToPlayer.clear();
    
    console.log(`🗑️ Cleared ${sessionCount} player sessions and ${socketCount} socket mappings`);
    
    return { sessionCount, socketCount };
  }
}