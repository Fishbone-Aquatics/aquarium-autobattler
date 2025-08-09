import { Injectable, BadRequestException } from '@nestjs/common';
import { GameState, GamePiece, Position, Tank, DraftState, BattleState, BattleEvent, BattlePiece } from '@aquarium/shared-types';
import { PIECE_LIBRARY } from '../app/data/pieces';
import { v4 as uuidv4 } from 'uuid';
import { PlayerService } from '../player/player.service';

// Game constants
const MAX_ROUNDS = 15;
const SELL_PERCENTAGE = 0.75;

// Type for battle pieces with team information
interface BattlePieceWithTeam extends BattlePiece {
  team: 'player' | 'opponent';
}

@Injectable()
export class GameService {
  constructor(private playerService: PlayerService) {}

  async createSession(socketId: string, playerId: string): Promise<GameState> {
    // Map socket to player
    this.playerService.mapSocketToPlayer(socketId, playerId);
    
    // Create initial game state
    const initialState: GameState = {
      phase: 'shop',
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
      shop: this.generateShop(),
      battleEvents: [],
      selectedPiece: null,
      opponentGold: 10,
      lockedShopIndex: null,
      goldHistory: [
        {
          id: uuidv4(),
          round: 1,
          type: 'round_start',
          amount: 10,
          description: 'Starting gold',
          timestamp: Date.now(),
        },
      ],
      rerollsThisRound: 0,
    };

    // Get or create session
    return this.playerService.getOrCreateSession(playerId, initialState);
  }

  async getSession(socketId: string): Promise<GameState> {
    const playerId = this.playerService.getPlayerIdFromSocket(socketId);
    return this.playerService.getSession(playerId);
  }

  async removeSession(socketId: string): Promise<void> {
    this.playerService.removeSocketMapping(socketId);
  }

  async purchasePiece(
    socketId: string,
    pieceId: string,
    shopIndex: number,
  ): Promise<GameState> {
    const gameState = await this.getSession(socketId);
    
    if (gameState.phase !== 'shop') {
      throw new BadRequestException('Can only purchase during shop phase');
    }

    const piece = gameState.shop[shopIndex];
    if (!piece || piece.id !== pieceId) {
      throw new BadRequestException('Invalid shop item');
    }

    if (gameState.gold < piece.cost) {
      throw new BadRequestException('Insufficient gold');
    }

    // Deduct gold
    gameState.gold -= piece.cost;
    
    // Add to tank pieces
    const purchasedPiece = { ...piece, id: uuidv4() };
    gameState.playerTank.pieces.push(purchasedPiece);
    
    // Remove from shop
    gameState.shop[shopIndex] = null;
    
    // If this was the locked item, clear the lock
    if (gameState.lockedShopIndex === shopIndex) {
      gameState.lockedShopIndex = null;
      console.log(`🔓 Cleared lock on index ${shopIndex} after purchase`);
    }

    // Add gold transaction
    gameState.goldHistory.push({
      id: uuidv4(),
      round: gameState.round,
      type: 'purchase',
      amount: -piece.cost,
      description: `Purchased ${piece.name}`,
      timestamp: Date.now(),
      pieceId: purchasedPiece.id,
      pieceName: piece.name,
    });

    this.updateGameState(socketId, gameState);
    return gameState;
  }

  async sellPiece(socketId: string, pieceId: string): Promise<GameState> {
    const gameState = await this.getSession(socketId);
    
    if (gameState.phase !== 'shop') {
      throw new BadRequestException('Can only sell during shop phase');
    }

    const pieceIndex = gameState.playerTank.pieces.findIndex(p => p.id === pieceId);
    if (pieceIndex === -1) {
      throw new BadRequestException('Piece not found');
    }

    const piece = gameState.playerTank.pieces[pieceIndex];
    const sellPrice = Math.floor(piece.cost * SELL_PERCENTAGE);
    
    // Add gold
    gameState.gold += sellPrice;
    
    // Remove piece from tank and grid
    gameState.playerTank.pieces.splice(pieceIndex, 1);
    this.removePieceFromGrid(gameState.playerTank, piece);

    // Add gold transaction
    gameState.goldHistory.push({
      id: uuidv4(),
      round: gameState.round,
      type: 'sell',
      amount: sellPrice,
      description: `Sold ${piece.name}`,
      timestamp: Date.now(),
      pieceId: piece.id,
      pieceName: piece.name,
    });

    this.updateGameState(socketId, gameState);
    return gameState;
  }

  async rerollShop(socketId: string): Promise<GameState> {
    const gameState = await this.getSession(socketId);
    
    if (gameState.phase !== 'shop') {
      throw new BadRequestException('Can only reroll during shop phase');
    }

    const rerollCost = 2;
    if (gameState.gold < rerollCost) {
      throw new BadRequestException('Insufficient gold for reroll');
    }

    // Deduct gold
    gameState.gold -= rerollCost;
    gameState.rerollsThisRound++;

    // Generate new shop (preserve locked slot)
    gameState.shop = this.generateShop(gameState.shop, gameState.lockedShopIndex);

    // Add gold transaction
    gameState.goldHistory.push({
      id: uuidv4(),
      round: gameState.round,
      type: 'reroll',
      amount: -rerollCost,
      description: 'Shop reroll',
      timestamp: Date.now(),
    });

    this.updateGameState(socketId, gameState);
    return gameState;
  }

  async updateTankPiece(
    socketId: string,
    pieceId: string,
    position: Position,
    action: 'place' | 'move' | 'remove',
  ): Promise<GameState> {
    const gameState = await this.getSession(socketId);
    
    if (gameState.phase !== 'shop') {
      throw new BadRequestException('Can only modify tank during shop phase');
    }

    const piece = gameState.playerTank.pieces.find(p => p.id === pieceId);
    if (!piece) {
      throw new BadRequestException('Piece not found');
    }

    if (action === 'remove') {
      this.removePieceFromGrid(gameState.playerTank, piece);
      piece.position = undefined;
    } else {
      // Validate position
      if (!this.isValidPosition(gameState.playerTank, piece, position)) {
        throw new BadRequestException('Invalid position for piece');
      }

      // Remove from old position
      if (piece.position) {
        this.removePieceFromGrid(gameState.playerTank, piece);
      }

      // Place at new position
      piece.position = position;
      this.placePieceOnGrid(gameState.playerTank, piece);
    }

    this.updateGameState(socketId, gameState);
    return gameState;
  }

  async toggleShopLock(socketId: string, shopIndex: number): Promise<GameState> {
    const gameState = await this.getSession(socketId);
    
    if (gameState.phase !== 'shop') {
      throw new BadRequestException('Can only lock/unlock during shop phase');
    }

    if (shopIndex < 0 || shopIndex >= gameState.shop.length) {
      throw new BadRequestException('Invalid shop index');
    }

    // Toggle lock
    if (gameState.lockedShopIndex === shopIndex) {
      gameState.lockedShopIndex = null;
    } else {
      gameState.lockedShopIndex = shopIndex;
    }

    this.updateGameState(socketId, gameState);
    return gameState;
  }

  async finalizeBattleRewards(socketId: string): Promise<any> {
    const gameState = await this.getSession(socketId);
    
    if (!gameState.battleState) {
      throw new BadRequestException('No battle state found');
    }
    
    // Capture the winner immediately to avoid race conditions
    const winner = gameState.battleState.winner;
    if (!winner) {
      throw new BadRequestException('Battle not finished - no winner determined');
    }
    
    const battleResult = { winner };
    
    // Update win/loss counts
    if (battleResult.winner === 'player') {
      gameState.wins++;
      gameState.opponentLosses++;
      gameState.lossStreak = 0;
      gameState.opponentLossStreak++;
    } else if (battleResult.winner === 'opponent') {
      gameState.losses++;
      gameState.opponentWins++;
      gameState.lossStreak++;
      gameState.opponentLossStreak = 0;
    } else if (battleResult.winner === 'draw') {
      // For draws, both parties "win" - no losses, reset loss streaks
      gameState.wins++;
      gameState.opponentWins++;
      gameState.lossStreak = 0;
      gameState.opponentLossStreak = 0;
    }

    // Calculate player rewards
    const playerBaseReward = 5;
    const playerWinBonus = (battleResult.winner === 'player' || battleResult.winner === 'draw') ? 3 : 0;
    const playerLossStreakBonus = Math.min(gameState.lossStreak, 3);
    const playerBaseAndWin = playerBaseReward + playerWinBonus;

    // Add base battle reward
    gameState.gold += playerBaseAndWin;
    gameState.goldHistory.push({
      id: uuidv4(),
      round: gameState.round,
      type: 'battle_reward',
      amount: playerBaseAndWin,
      description: `Battle ${battleResult.winner === 'player' ? 'won (+3 bonus)' : battleResult.winner === 'draw' ? 'tied (+3 bonus)' : 'lost'} (+5 base)`,
      timestamp: Date.now(),
    });

    // Add separate loss streak bonus if applicable  
    if (playerLossStreakBonus > 0) {
      gameState.gold += playerLossStreakBonus;
      gameState.goldHistory.push({
        id: uuidv4(),
        round: gameState.round,
        type: 'loss_streak_bonus',
        amount: playerLossStreakBonus,
        description: `Loss streak bonus (${gameState.lossStreak} ${gameState.lossStreak === 1 ? 'loss' : 'losses'})`,
        timestamp: Date.now(),
      });
    }

    // Calculate opponent rewards (same mechanics as player)
    const opponentBaseReward = 5;
    const opponentWinBonus = (battleResult.winner === 'opponent' || battleResult.winner === 'draw') ? 3 : 0;
    const opponentLossStreakBonus = Math.min(gameState.opponentLossStreak, 3);
    const opponentTotalReward = opponentBaseReward + opponentWinBonus + opponentLossStreakBonus;

    gameState.opponentGold += opponentTotalReward;

    // Player Interest
    const playerInterest = Math.min(Math.floor(gameState.gold / 10), 5);
    if (playerInterest > 0) {
      gameState.gold += playerInterest;
      gameState.goldHistory.push({
        id: uuidv4(),
        round: gameState.round,
        type: 'interest',
        amount: playerInterest,
        description: 'Interest earned',
        timestamp: Date.now(),
      });
    }

    // Opponent Interest (same calculation as player)
    const opponentInterest = Math.min(Math.floor(gameState.opponentGold / 10), 5);
    if (opponentInterest > 0) {
      gameState.opponentGold += opponentInterest;
    }

    // Check if we've reached the maximum rounds
    const isGameComplete = gameState.round >= MAX_ROUNDS;
    
    // Advance round
    gameState.round++;
    // Keep the game in battle phase so user can see results and click continue
    // Phase will be changed to 'shop' when user clicks "Continue to Next Round"
    gameState.rerollsThisRound = 0;
    
    // Generate new shop for when they return, preserving locked items
    gameState.shop = this.generateShop(gameState.shop, gameState.lockedShopIndex);
    
    // Keep battle state so user can see battle results
    // battleState will be cleared when user clicks continue
    
    this.updateGameState(socketId, gameState);

    return {
      winner: battleResult.winner,
      rewards: {
        playerGold: playerBaseAndWin + playerLossStreakBonus,
        playerInterest,
        opponentGold: opponentTotalReward,
        opponentInterest,
      },
      isGameComplete,
    };
  }

  async simulateBattleEvents(socketId: string): Promise<any> {
    const gameState = await this.getSession(socketId);
    
    // Legacy method - only used for generating battle events for non-live battles  
    // This method does NOT apply any rewards or update game state
    const battleResult = this.simulateBattle(gameState.playerTank, gameState.opponentTank);
    
    return {
      winner: battleResult.winner,
      events: battleResult.events,
    };
  }

  async returnToShopPhase(socketId: string): Promise<GameState> {
    const gameState = await this.getSession(socketId);
    
    // Check if campaign is complete (round > MAX_ROUNDS means we just finished round 15)
    if (gameState.round > MAX_ROUNDS) {
      // Reset the entire game instead of continuing
      return await this.resetGameAfterCampaign(socketId);
    }
    
    // Return to shop phase and clear battle results
    // (Rewards should have already been applied by finalizeBattleRewards)
    gameState.phase = 'shop';
    gameState.rerollsThisRound = 0;
    
    // Clear battle state now that user has seen results
    gameState.battleState = undefined;
    
    // Respawn all dead fish and plants (but not consumables)
    this.respawnPieces(gameState.playerTank);
    this.respawnPieces(gameState.opponentTank);
    
    // Shop should already be generated from finalizeBattleRewards, but ensure it exists
    if (!gameState.shop || gameState.shop.length === 0) {
      gameState.shop = this.generateShop(gameState.shop, gameState.lockedShopIndex);
    }
    
    this.updateGameState(socketId, gameState);
    return gameState;
  }

  async resetGameAfterCampaign(socketId: string): Promise<GameState> {
    const playerId = this.playerService.getPlayerIdFromSocket(socketId);
    
    // Create fresh game state (same as initial creation)
    const resetState: GameState = {
      phase: 'shop',
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
      shop: this.generateShop(),
      battleEvents: [],
      selectedPiece: null,
      opponentGold: 10,
      lockedShopIndex: null,
      goldHistory: [
        {
          id: uuidv4(),
          round: 1,
          type: 'round_start',
          amount: 10,
          description: 'Starting gold',
          timestamp: Date.now(),
        },
      ],
      rerollsThisRound: 0,
      battleState: undefined,
      draftState: undefined,
    };

    // Update the session with reset state
    this.playerService.updateSession(playerId, resetState);
    return resetState;
  }

  async saveDraftState(socketId: string, draftState?: DraftState): Promise<DraftState> {
    const gameState = await this.getSession(socketId);
    
    let stateToSave: DraftState;
    if (draftState) {
      const { draftState: _, ...cleanDraftState } = draftState as any;
      stateToSave = {
        ...cleanDraftState,
        lastModified: draftState.lastModified || Date.now()
      };
    } else {
      const { draftState: _, ...gameStateWithoutDraft } = gameState;
      stateToSave = {
        ...gameStateWithoutDraft,
        lastModified: Date.now()
      };
    }
    
    gameState.draftState = stateToSave;
    this.updateGameState(socketId, gameState);
    
    console.log('💾 Complete game state saved:', {
      gold: stateToSave.gold,
      pieces: stateToSave.playerTank?.pieces?.length || 0,
      round: stateToSave.round
    });
    
    return stateToSave;
  }

  async restoreDraftState(socketId: string): Promise<GameState> {
    const gameState = await this.getSession(socketId);
    
    const draftState = gameState.draftState;
    if (!draftState) {
      console.log('No saved draft state found - returning current state');
      return gameState;
    }
    
    if (gameState.phase !== 'shop') {
      throw new BadRequestException('Can only restore draft during shop phase');
    }
    
    const restoredState: GameState = {
      ...draftState,
      playerTank: {
        ...draftState.playerTank,
        id: gameState.playerTank.id
      }
    };
    
    console.log('🔄 Restoring complete game state:', {
      gold: restoredState.gold,
      pieces: restoredState.playerTank?.pieces?.length || 0,
      round: restoredState.round
    });

    this.updateGameState(socketId, restoredState);
    return restoredState;
  }

  async clearDraftState(socketId: string): Promise<GameState> {
    const gameState = await this.getSession(socketId);
    
    gameState.draftState = null;
    this.updateGameState(socketId, gameState);
    
    console.log('🗑️ Draft state cleared');
    return gameState;
  }

  async confirmPlacement(socketId: string): Promise<GameState> {
    const gameState = await this.getSession(socketId);
    
    if (gameState.phase !== 'shop') {
      throw new BadRequestException('Can only confirm placement during shop phase');
    }
    
    // Clear draft state as it's now confirmed
    gameState.draftState = undefined;
    
    this.updateGameState(socketId, gameState);
    return gameState;
  }

  async getCalculatedStats(socketId: string): Promise<{ [pieceId: string]: { attack: number; health: number; speed: number } }> {
    const gameState = await this.getSession(socketId);
    const result: { [pieceId: string]: { attack: number; health: number; speed: number } } = {};
    
    const placedPieces = gameState.playerTank.pieces.filter(p => p.position);
    
    placedPieces.forEach(piece => {
      result[piece.id] = this.calculatePieceStats(piece, placedPieces);
    });
    
    return result;
  }

  async enterPlacementPhase(socketId: string): Promise<GameState> {
    const gameState = await this.getSession(socketId);
    
    if (gameState.phase !== 'shop') {
      throw new BadRequestException('Can only enter placement phase from shop phase');
    }

    // Update opponent tank for battle comparison (persistent like player)
    // Only add new pieces to existing tank, don't regenerate from scratch
    const { remainingGold } = this.updateOpponentTank(gameState);
    gameState.opponentGold = remainingGold; // Track remaining gold
    gameState.phase = 'placement';
    
    this.updateGameState(socketId, gameState);
    return gameState;
  }

  async enterBattlePhase(socketId: string): Promise<GameState> {
    const gameState = await this.getSession(socketId);
    
    if (gameState.phase !== 'placement') {
      throw new BadRequestException('Can only enter battle phase from placement phase');
    }

    // Process consumables before battle starts
    this.processConsumables(gameState.playerTank);
    this.processConsumables(gameState.opponentTank);

    // Initialize battle state but keep on placement phase
    const battleState = this.initializeBattleState(gameState);
    gameState.battleState = battleState;
    gameState.phase = 'battle'; // Still need to track battle state internally
    
    this.updateGameState(socketId, gameState);
    
    return gameState;
  }

  // Method to advance battle by one turn (called from gateway)
  async advanceBattleTurn(socketId: string): Promise<{ gameState: GameState; turnEvents: any[] }> {
    const gameState = await this.getSession(socketId);
    const battleState = gameState.battleState;
    
    if (!battleState || !battleState.active) {
      throw new BadRequestException('No active battle');
    }

    const turnEvents = [];

    // Add round start event
    const roundEvent: BattleEvent = {
      id: uuidv4(),
      type: 'round_start',
      source: 'system',
      value: 0,
      round: battleState.currentRound,
      turn: battleState.currentTurn,
      timestamp: Date.now(),
      description: `--- Turn ${battleState.currentTurn} ---`,
    };
    
    battleState.events.push(roundEvent);
    turnEvents.push(roundEvent);

    // Get all alive pieces from both sides (excluding plants - they don't attack)
    const alivePieces: BattlePieceWithTeam[] = [
      ...battleState.playerPieces.filter(p => !p.isDead && p.type !== 'plant').map(p => ({ ...p, team: 'player' as const })),
      ...battleState.opponentPieces.filter(p => !p.isDead && p.type !== 'plant').map(p => ({ ...p, team: 'opponent' as const }))
    ];

    // Skip turn if no attacking pieces left on either side
    if (alivePieces.length === 0) {
      // No attacking pieces left, but battle continues until HP reaches 0
      // Add a log event to indicate this
      const noAttackersEvent: BattleEvent = {
        id: uuidv4(),
        type: 'round_start',
        source: 'system',
        value: 0,
        round: battleState.currentRound,
        turn: battleState.currentTurn,
        timestamp: Date.now(),
        description: `💤 No attacking pieces remain, but ${battleState.playerHealth > 0 ? 'plants still stand guard' : 'the battle rages on'}!`,
      };
      
      battleState.events.push(noAttackersEvent);
      turnEvents.push(noAttackersEvent);
      
      // Check if we should end due to turn limit in this edge case
      if (battleState.currentTurn >= 20) {
        battleState.winner = 'draw';
        battleState.active = false;
      }
      
      battleState.currentTurn++;
      this.updateGameState(socketId, gameState);
      return { gameState, turnEvents };
    }

    // Sort by speed (highest first), then by random for ties
    alivePieces.sort((a, b) => {
      if (b.stats.speed !== a.stats.speed) {
        return b.stats.speed - a.stats.speed;
      }
      return Math.random() - 0.5; // Random tiebreaker
    });

    // Each piece attacks in speed order
    for (const attacker of alivePieces) {
      // Skip if this attacker died earlier in this turn
      const attackerBattlePieces = attacker.team === 'player' 
        ? battleState.playerPieces 
        : battleState.opponentPieces;
      
      const currentAttacker = attackerBattlePieces.find(p => p.id === attacker.id);
      if (!currentAttacker || currentAttacker.isDead) {
        continue; // This attacker died earlier in this turn, skip
      }
      
      // Get current alive enemies with team information
      const enemies: BattlePieceWithTeam[] = attacker.team === 'player' 
        ? battleState.opponentPieces.filter(p => !p.isDead).map(p => ({ ...p, team: 'opponent' as const }))
        : battleState.playerPieces.filter(p => !p.isDead).map(p => ({ ...p, team: 'player' as const }));

      if (enemies.length === 0) {
        break; // No enemies left, battle is over
      }

      // Select target (random for now, could be strategic later)
      const target = enemies[Math.floor(Math.random() * enemies.length)];

      // Calculate detailed damage with proper base/bonus breakdown
      const originalPiece = attacker.team === 'player' 
        ? gameState.playerTank.pieces.find(p => p.id === attacker.id)
        : gameState.opponentTank.pieces.find(p => p.id === attacker.id);
      
      const baseDamage = originalPiece?.stats.attack || attacker.stats.attack;
      const attackBonus = attacker.stats.attack - baseDamage; // Calculate bonus from adjacency/schooling
      const waterQuality = attacker.team === 'player' ? gameState.playerTank.waterQuality : gameState.opponentTank.waterQuality;
      const waterBonus = Math.floor(attacker.stats.attack * (waterQuality / 10) * 0.1); // 10% bonus per water quality point
      const finalDamage = attacker.stats.attack + waterBonus;

      // Find the actual battleState piece to update (not the local copy)
      const battleStatePieces = target.team === 'player' 
        ? battleState.playerPieces 
        : battleState.opponentPieces;
      
      const battlePiece = battleStatePieces.find(p => p.id === target.id);
      if (!battlePiece) {
        console.error(`Could not find battle piece with id ${target.id}`);
        continue;
      }

      // Apply damage to the actual battleState piece
      const damageDealt = Math.min(finalDamage, battlePiece.currentHealth);
      battlePiece.currentHealth = Math.max(0, battlePiece.currentHealth - finalDamage);
      
      // Check if target died
      const targetDied = battlePiece.currentHealth <= 0;
      if (targetDied) {
        battlePiece.isDead = true;
        
        // Also mark the original tank piece as dead for visual display
        const originalTankPieces = target.team === 'player' 
          ? gameState.playerTank.pieces 
          : gameState.opponentTank.pieces;
        
        const originalPiece = originalTankPieces.find(p => p.id === target.id);
        if (originalPiece) {
          (originalPiece as any).isDead = true;
        }
      }

      // UPDATE: Recalculate tank health immediately after each attack
      const currentPlayerHealth = battleState.playerPieces
        .filter(p => !p.isDead)
        .reduce((sum, p) => sum + p.currentHealth, 0);
      
      const currentOpponentHealth = battleState.opponentPieces
        .filter(p => !p.isDead)
        .reduce((sum, p) => sum + p.currentHealth, 0);

      // Update battleState health values immediately
      battleState.playerHealth = currentPlayerHealth;
      battleState.opponentHealth = currentOpponentHealth;

      // Create detailed attack event with health states
      const attackEvent: BattleEvent = {
        id: uuidv4(),
        type: 'attack',
        source: attacker.team === 'player' ? 'player-piece' : 'opponent-piece',
        sourceName: attacker.name,
        target: attacker.team === 'player' ? 'opponent-piece' : 'player-piece',
        targetName: target.name,
        value: damageDealt,
        round: battleState.currentRound,
        turn: battleState.currentTurn,
        timestamp: Date.now(),
        description: `${attacker.team === 'player' ? '🟢' : '🔴'} ${attacker.name} (Speed ${attacker.stats.speed}) attacks ${target.team === 'player' ? '🟢' : '🔴'} ${target.name}! ${baseDamage} base attack${attackBonus > 0 ? ` + ${attackBonus} bonuses` : ''}${waterBonus > 0 ? ` + ${waterBonus} water quality` : ''} = ${finalDamage} damage → ${target.name} ${targetDied ? 'is KO\'d!' : `has ${battlePiece.currentHealth}/${battlePiece.stats.maxHealth} HP left`}`,
        // Include real-time health states for frontend updates (using immediately calculated values)
        healthStates: {
          playerHealth: currentPlayerHealth,
          opponentHealth: currentOpponentHealth,
          targetPieceId: target.id,
          targetCurrentHealth: battlePiece.currentHealth,
          targetMaxHealth: battlePiece.stats.maxHealth,
          targetDied: targetDied
        }
      };
      
      battleState.events.push(attackEvent);
      turnEvents.push(attackEvent);

      // Add death event if target died
      if (targetDied) {
        const deathEvent: BattleEvent = {
          id: uuidv4(),
          type: 'death',
          source: 'system',
          sourceName: target.name,
          target: attacker.team === 'player' ? 'opponent-team' : 'player-team',
          targetName: attacker.team === 'player' ? 'Opponent' : 'You',
          value: 0,
          round: battleState.currentRound,
          turn: battleState.currentTurn,
          timestamp: Date.now(),
          description: `💀 ${target.team === 'player' ? '🟢' : '🔴'} ${target.name} has been defeated!`,
        };
        
        battleState.events.push(deathEvent);
        turnEvents.push(deathEvent);
      }
    }

    // Update tank health based on remaining pieces
    battleState.playerHealth = battleState.playerPieces
      .filter(p => !p.isDead)
      .reduce((sum, p) => sum + p.currentHealth, 0);
    
    battleState.opponentHealth = battleState.opponentPieces
      .filter(p => !p.isDead)
      .reduce((sum, p) => sum + p.currentHealth, 0);

    // Check for winner
    if (battleState.playerHealth <= 0) {
      battleState.winner = 'opponent';
      battleState.active = false;
    } else if (battleState.opponentHealth <= 0) {
      battleState.winner = 'player';
      battleState.active = false;
    } else if (battleState.currentTurn >= 20) {
      battleState.winner = 'draw';
      battleState.active = false;
    }

    battleState.currentTurn++;
    this.updateGameState(socketId, gameState);

    return { gameState, turnEvents };
  }

  // Private helper methods
  private updateGameState(socketId: string, gameState: GameState): void {
    const playerId = this.playerService.getPlayerIdFromSocket(socketId);
    this.playerService.updateSession(playerId, gameState);
  }

  private generateShop(existingShop?: (GamePiece | null)[], lockedIndex?: number | null): (GamePiece | null)[] {
    const shopSize = 6;
    const shop: (GamePiece | null)[] = [];
    
    for (let i = 0; i < shopSize; i++) {
      // Preserve locked item if this is the locked index
      if (lockedIndex !== null && lockedIndex === i && existingShop && existingShop[i]) {
        shop.push(existingShop[i]);
        console.log(`🔒 Preserving locked item at index ${i}: ${existingShop[i]?.name}`);
      } else {
        const piece = this.getRandomPiece();
        shop.push(piece ? { ...piece, id: uuidv4() } : null);
      }
    }
    
    return shop;
  }

  private getRandomPiece(): GamePiece | null {
    const pieces = [...PIECE_LIBRARY];
    return pieces[Math.floor(Math.random() * pieces.length)] || null;
  }

  private getOpponentPieceForRound(round: number, maxCost: number): GamePiece | null {
    const pieces = [...PIECE_LIBRARY].filter(piece => piece.cost <= maxCost);
    
    if (pieces.length === 0) return null;
    
    // Early rounds (1-3): Random selection
    if (round <= 3) {
      return pieces[Math.floor(Math.random() * pieces.length)];
    }
    
    // Mid rounds (4-7): Prefer medium-high cost pieces
    if (round <= 7) {
      const goodPieces = pieces.filter(piece => piece.cost >= 3);
      if (goodPieces.length > 0) {
        // 70% chance for higher cost pieces, 30% chance for any piece
        return Math.random() < 0.7 
          ? goodPieces[Math.floor(Math.random() * goodPieces.length)]
          : pieces[Math.floor(Math.random() * pieces.length)];
      }
    }
    
    // Late rounds (8+): Strongly prefer high cost pieces
    const expensivePieces = pieces.filter(piece => piece.cost >= 4);
    if (expensivePieces.length > 0) {
      // 85% chance for expensive pieces, 15% chance for any piece
      return Math.random() < 0.85 
        ? expensivePieces[Math.floor(Math.random() * expensivePieces.length)]
        : pieces[Math.floor(Math.random() * pieces.length)];
    }
    
    // Fallback to random if no expensive pieces available
    return pieces[Math.floor(Math.random() * pieces.length)];
  }

  private isValidPosition(tank: Tank, piece: GamePiece, position: Position): boolean {
    for (const offset of piece.shape) {
      const x = position.x + offset.x;
      const y = position.y + offset.y;
      
      if (x < 0 || x >= 8 || y < 0 || y >= 6) {
        return false;
      }
      
      if (tank.grid[y][x] && tank.grid[y][x] !== piece.id) {
        return false;
      }
    }
    
    return true;
  }

  private removePieceFromGrid(tank: Tank, piece: GamePiece): void {
    if (!piece.position) return;
    
    for (const offset of piece.shape) {
      const x = piece.position.x + offset.x;
      const y = piece.position.y + offset.y;
      
      if (x >= 0 && x < 8 && y >= 0 && y < 6) {
        tank.grid[y][x] = null;
      }
    }
  }

  private placePieceOnGrid(tank: Tank, piece: GamePiece): void {
    if (!piece.position) return;
    
    for (const offset of piece.shape) {
      const x = piece.position.x + offset.x;
      const y = piece.position.y + offset.y;
      
      if (x >= 0 && x < 8 && y >= 0 && y < 6) {
        tank.grid[y][x] = piece.id;
      }
    }
  }

  private processConsumables(tank: Tank): void {
    // Find all consumables that are placed on the grid
    const consumables = tank.pieces.filter(p => p.type === 'consumable' && p.position);
    
    if (consumables.length === 0) return;
    
    console.log(`🍽️ Processing ${consumables.length} consumables for tank ${tank.id}`);
    
    // For each consumable, apply bonuses to adjacent fish
    for (const consumable of consumables) {
      if (!consumable.position) continue;
      
      // Get all adjacent positions for this multi-cell consumable
      const adjacentPositions = this.getAdjacentPositionsForPiece(consumable);
      
      // Find adjacent fish - check if any of their cells are adjacent to the consumable
      const adjacentFish = tank.pieces.filter(p => {
        if (p.type !== 'fish' || !p.position) return false;
        
        // Check if any cell of the fish is adjacent to the consumable
        return p.shape.some(offset => {
          const fishCellPos = { x: p.position!.x + offset.x, y: p.position!.y + offset.y };
          return adjacentPositions.some(adjPos => adjPos.x === fishCellPos.x && adjPos.y === fishCellPos.y);
        });
      });
      
      // Apply permanent bonuses to each adjacent fish
      for (const fish of adjacentFish) {
        // Initialize permanent bonuses if not exists
        if (!fish.permanentBonuses) {
          fish.permanentBonuses = {
            attack: 0,
            health: 0,
            speed: 0,
            sources: []
          };
        }
        
        // Apply bonuses
        const attackBonus = consumable.attackBonus || 0;
        const healthBonus = consumable.healthBonus || 0;
        const speedBonus = consumable.speedBonus || 0;
        
        fish.permanentBonuses.attack += attackBonus;
        fish.permanentBonuses.health += healthBonus;
        fish.permanentBonuses.speed += speedBonus;
        
        // Track the source
        const existingSource = fish.permanentBonuses.sources.find(s => s.name === consumable.name);
        if (existingSource) {
          existingSource.count++;
        } else {
          fish.permanentBonuses.sources.push({
            name: consumable.name,
            count: 1,
            attackBonus,
            healthBonus,
            speedBonus
          });
        }
        
        // Don't modify base stats - only track in permanentBonuses
        console.log(`🎯 ${consumable.name} applied permanent bonuses to ${fish.name}: +${attackBonus} ATK, +${healthBonus} HP, +${speedBonus} SPD`);
      }
      
      // Remove consumable from grid
      this.removePieceFromGrid(tank, consumable);
    }
    
    // Remove all consumables from the tank pieces array
    tank.pieces = tank.pieces.filter(p => p.type !== 'consumable' || !p.position);
  }

  private respawnPieces(tank: Tank): void {
    // Respawn all fish and plants, preserving their permanent bonuses
    for (const piece of tank.pieces) {
      if (piece.type === 'fish' || piece.type === 'plant') {
        // Clear the dead flag
        (piece as any).isDead = false;
        
        // Restore health to base max (permanent bonuses are applied separately in calculations)
        const baseMaxHealth = PIECE_LIBRARY.find(p => p.name === piece.name)?.stats.maxHealth || piece.stats.maxHealth;
        piece.stats.maxHealth = baseMaxHealth;
        piece.stats.health = baseMaxHealth;
        
        const permanentHealthBonus = piece.permanentBonuses?.health || 0;
        console.log(`🔄 Respawned ${piece.name} with ${piece.stats.health}/${piece.stats.maxHealth} HP base (+${permanentHealthBonus} permanent bonus tracked separately)`);
      }
    }
  }

  private getAdjacentPositionsForPiece(piece: GamePiece): Position[] {
    if (!piece.position) return [];
    
    // Get all cells occupied by this piece
    const occupiedCells = piece.shape.map(offset => ({
      x: piece.position!.x + offset.x,
      y: piece.position!.y + offset.y
    }));
    
    // Get all adjacent positions (8-directional) for each occupied cell
    const adjacentPositions = new Set<string>();
    
    occupiedCells.forEach(cell => {
      // Add all 8 adjacent positions for this cell
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue; // Skip the cell itself
          
          const adjPos = { x: cell.x + dx, y: cell.y + dy };
          
          // Only add if it's not already occupied by our own piece
          if (!occupiedCells.some(occupied => occupied.x === adjPos.x && occupied.y === adjPos.y)) {
            adjacentPositions.add(`${adjPos.x},${adjPos.y}`);
          }
        }
      }
    });
    
    // Convert back to Position objects
    return Array.from(adjacentPositions).map(posStr => {
      const [x, y] = posStr.split(',').map(Number);
      return { x, y };
    });
  }

  private simulateBattle(playerTank: Tank, opponentTank: Tank): any {
    const playerPower = playerTank.pieces.reduce((sum, p) => sum + p.stats.attack + p.stats.health, 0);
    const opponentPower = opponentTank.pieces.reduce((sum, p) => sum + p.stats.attack + p.stats.health, 0);
    
    const winner = playerPower > opponentPower ? 'player' : 
                   opponentPower > playerPower ? 'opponent' : 'draw';
    
    return {
      winner,
      events: [],
    };
  }

  private calculatePieceStats(piece: GamePiece, allPieces: GamePiece[]): { attack: number; health: number; speed: number } {
    if (!piece.position) {
      return { attack: piece.stats.attack, health: piece.stats.health, speed: piece.stats.speed };
    }

    let attackBonus = 0;
    let healthBonus = 0;
    let speedBonus = 0;

    // Get all adjacent positions for this multi-cell piece
    const adjacentPositions = this.getAdjacentPositionsForPiece(piece);

    // Find adjacent pieces - check if any of their cells are adjacent to any of our cells
    const adjacentPieces = allPieces.filter(p => {
      if (!p.position || p.id === piece.id) return false;
      
      // Check if any cell of piece p is adjacent to our piece
      return p.shape.some(offset => {
        const cellPos = { x: p.position!.x + offset.x, y: p.position!.y + offset.y };
        return adjacentPositions.some(adjPos => adjPos.x === cellPos.x && adjPos.y === cellPos.y);
      });
    });

    // Apply adjacency bonuses from plants and consumables
    adjacentPieces.forEach(adjacentPiece => {
      if ((adjacentPiece.type === 'plant' || adjacentPiece.type === 'consumable') && piece.type === 'fish') {
        let bonusAttack = adjacentPiece.attackBonus || 0;
        let bonusHealth = adjacentPiece.healthBonus || 0;
        let bonusSpeed = adjacentPiece.speedBonus || 0;
        
        // Equipment effects: filter boosts plant effects by 20%
        if (adjacentPiece.type === 'plant') {
          const filterAdjacent = adjacentPieces.some(p => p.type === 'equipment' && p.tags.includes('filter'));
          if (filterAdjacent) {
            const originalBonus = Math.max(bonusAttack, bonusHealth, bonusSpeed);
            const boost = Math.ceil(originalBonus * 0.2);
            bonusAttack = bonusAttack > 0 ? bonusAttack + boost : bonusAttack;
            bonusHealth = bonusHealth > 0 ? bonusHealth + boost : bonusHealth;
            bonusSpeed = bonusSpeed > 0 ? bonusSpeed + boost : bonusSpeed;
          }
        }
        
        attackBonus += bonusAttack;
        healthBonus += bonusHealth;
        speedBonus += bonusSpeed;
      }
    });

    // Apply equipment effects
    adjacentPieces.forEach(adjacentPiece => {
      if (adjacentPiece.type === 'equipment') {
        // Filter boosts plant effects by 20%
        if (adjacentPiece.tags.includes('filter')) {
          // Count plants adjacent to this piece and boost their effects
          const adjacentPlants = adjacentPieces.filter(p => p.type === 'plant');
          adjacentPlants.forEach(plant => {
            const baseAttackBonus = plant.attackBonus || 0;
            const baseHealthBonus = plant.healthBonus || 0;
            const baseSpeedBonus = plant.speedBonus || 0;
            
            // Add 20% boost to plant effects
            attackBonus += Math.floor(baseAttackBonus * 0.2);
            healthBonus += Math.floor(baseHealthBonus * 0.2);
            speedBonus += Math.floor(baseSpeedBonus * 0.2);
          });
        }
      }
    });

    // Schooling fish bonuses
    if (piece.tags.includes('schooling')) {
      const adjacentSchoolingCount = adjacentPieces.filter(p => p.tags.includes('schooling')).length;
      
      if (piece.name === 'Neon Tetra') {
        attackBonus += adjacentSchoolingCount;
      }
      
      if (piece.name === 'Cardinal Tetra') {
        attackBonus += adjacentSchoolingCount * 2;
      }

      // Double speed if 3+ schooling fish adjacent
      if (adjacentSchoolingCount >= 3) {
        speedBonus += piece.stats.speed;
      }
    }

    // Include permanent bonuses from consumables
    const permanentAttack = piece.permanentBonuses?.attack || 0;
    const permanentHealth = piece.permanentBonuses?.health || 0;
    const permanentSpeed = piece.permanentBonuses?.speed || 0;

    return {
      attack: piece.stats.attack + attackBonus + permanentAttack,
      health: piece.stats.health + healthBonus + permanentHealth,
      speed: piece.stats.speed + speedBonus + permanentSpeed
    };
  }

  private updateOpponentTank(gameState: GameState): { remainingGold: number } {
    const round = gameState.round;
    let opponentGold = gameState.opponentGold;
    const opponentTank = gameState.opponentTank;
    
    console.log(`🤖 Updating opponent tank for round ${round} with ${opponentGold} gold`);
    console.log(`🤖 Current opponent pieces: ${opponentTank.pieces.length}`);
    
    // Calculate how many new pieces to buy this round
    const currentPieceCount = opponentTank.pieces.length;
    
    // Scale target pieces with round progression, but don't exceed grid capacity
    const targetPieces = Math.min(8, Math.max(1, Math.floor(round * 0.7) + 2));
    const piecesToBuy = Math.max(0, targetPieces - currentPieceCount);
    
    console.log(`🤖 Target pieces: ${targetPieces}, Current: ${currentPieceCount}, To buy: ${piecesToBuy}`);
    
    let piecesBought = 0;
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 15;
    
    // Buy new pieces for this round
    while (opponentGold > 0 && piecesBought < piecesToBuy && consecutiveFailures < maxConsecutiveFailures) {
      const piece = typeof this.getOpponentPieceForRound === 'function' 
        ? this.getOpponentPieceForRound(round, opponentGold)
        : this.getRandomPiece();
      
      if (!piece || piece.cost > opponentGold) {
        consecutiveFailures++;
        continue;
      }
      
      // Find a valid position for the new piece
      const position = this.findValidPositionForOpponent(opponentTank, piece);
      
      if (position) {
        const newPiece = { 
          ...piece, 
          id: uuidv4(),
          position
        };
        
        // Place piece on grid
        this.placePieceOnGrid(opponentTank, newPiece);
        
        // Add to pieces array
        opponentTank.pieces.push(newPiece);
        opponentGold -= piece.cost;
        piecesBought++;
        consecutiveFailures = 0;
        
        console.log(`🤖 Bought ${piece.name} for ${piece.cost}g at (${position.x},${position.y})`);
      } else {
        // No valid position found, stop trying
        console.log(`🤖 No valid position for ${piece.name}, stopping purchases`);
        break;
      }
    }
    
    console.log(`🤖 Opponent tank updated: ${opponentTank.pieces.length} total pieces, ${opponentGold} gold remaining`);
    
    return { remainingGold: opponentGold };
  }

  private generateOpponentTankWithGold(startingGold = 10, round = 1): { tank: Tank; remainingGold: number } {
    console.log(`🤖 Generating opponent tank with ${startingGold} gold for round ${round}`);
    
    // Generate opponent tank that scales with round progression
    const opponentPieces: GamePiece[] = [];
    const grid: (string | null)[][] = Array(6).fill(null).map(() => Array(8).fill(null));
    
    // Use the opponent's actual gold amount
    let opponentGold = startingGold;
    
    // Scale max pieces with round progression
    // Round 1-3: 3-5 pieces, Round 4-7: 4-7 pieces, Round 8+: 5-8 pieces
    const baseMaxPieces = Math.min(8, Math.max(3, 2 + Math.floor(round / 2)));
    const maxPieces = Math.min(baseMaxPieces, Math.floor(startingGold / 3)); // Ensure we can afford pieces
    
    console.log(`🤖 Round ${round}: Target ${maxPieces} pieces with ${startingGold} gold`);
    
    let pieceCount = 0;
    
    // Generate pieces within budget with safety limits
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 10;
    
    while (opponentGold > 0 && pieceCount < maxPieces && consecutiveFailures < maxConsecutiveFailures) {
      // In later rounds, prefer higher cost pieces (better units)
      const piece = typeof this.getOpponentPieceForRound === 'function' 
        ? this.getOpponentPieceForRound(round, opponentGold)
        : this.getRandomPiece();
      
      if (!piece || piece.cost > opponentGold) {
        consecutiveFailures++;
        continue;
      }
      
      // Find a valid position for the piece
      let placed = false;
      let attempts = 0;
      while (!placed && attempts < 50) {
        const position = { 
          x: Math.floor(Math.random() * 8), 
          y: Math.floor(Math.random() * 6) 
        };
        
        // Check if position is valid for this piece
        if (this.isValidPositionForGrid(grid, piece, position)) {
          const opponentPiece = { 
            ...piece, 
            id: uuidv4(),
            position
          };
          
          // Place piece on grid
          for (const offset of piece.shape) {
            const x = position.x + offset.x;
            const y = position.y + offset.y;
            if (x >= 0 && x < 8 && y >= 0 && y < 6) {
              grid[y][x] = opponentPiece.id;
            }
          }
          
          opponentPieces.push(opponentPiece);
          opponentGold -= piece.cost;
          pieceCount++;
          placed = true;
          consecutiveFailures = 0; // Reset failure counter on success
        }
        attempts++;
      }
      
      if (!placed) {
        consecutiveFailures++;
      }
    }

    console.log(`🤖 Opponent tank generated: ${pieceCount} pieces, ${opponentGold} gold remaining`);
    
    const tank = {
      id: 'opponent',
      pieces: opponentPieces,
      waterQuality: Math.floor(Math.random() * 6) + 3, // 3-8
      temperature: 25,
      grid,
    };
    
    return {
      tank,
      remainingGold: opponentGold
    };
  }

  private generateOpponentTank(): Tank {
    return this.generateOpponentTankWithGold().tank;
  }

  private findValidPositionForOpponent(tank: Tank, piece: GamePiece): Position | null {
    // Try to find a valid position for the piece without overlapping existing pieces
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 8; x++) {
        const position = { x, y };
        if (this.isValidPosition(tank, piece, position)) {
          return position;
        }
      }
    }
    return null; // No valid position found
  }

  private isValidPositionForGrid(grid: (string | null)[][], piece: GamePiece, position: Position): boolean {
    for (const offset of piece.shape) {
      const x = position.x + offset.x;
      const y = position.y + offset.y;
      
      if (x < 0 || x >= 8 || y < 0 || y >= 6) {
        return false;
      }
      
      if (grid[y][x] !== null) {
        return false;
      }
    }
    
    return true;
  }

  private initializeBattleState(gameState: GameState): BattleState {
    const playerPieces = this.convertToBattlePieces(gameState.playerTank.pieces);
    const opponentPieces = this.convertToBattlePieces(gameState.opponentTank.pieces);

    const playerMaxHealth = playerPieces.reduce((sum, p) => sum + p.stats.maxHealth, 0);
    const opponentMaxHealth = opponentPieces.reduce((sum, p) => sum + p.stats.maxHealth, 0);

    return {
      active: true,
      currentRound: 1,
      currentTurn: 1,
      playerHealth: playerMaxHealth,
      opponentHealth: opponentMaxHealth,
      playerMaxHealth,
      opponentMaxHealth,
      winner: null,
      events: [],
      playerPieces,
      opponentPieces,
      isGameComplete: gameState.round >= MAX_ROUNDS,
    };
  }

  private convertToBattlePieces(pieces: GamePiece[]): BattlePiece[] {
    const placedPieces = pieces.filter(p => p.position);
    
    return placedPieces.map(piece => {
      // Calculate buffed stats for battle (same logic as calculatePieceStats)
      const buffedStats = this.calculatePieceStats(piece, placedPieces);
      
      return {
        ...piece,
        stats: {
          ...buffedStats,
          maxHealth: buffedStats.health // Store calculated health as maxHealth
        },
        currentHealth: buffedStats.health,
        isDead: false,
        statusEffects: [],
        nextActionTime: 0,
      };
    });
  }

  private async runBattleSimulation(socketId: string): Promise<void> {
    const gameState = await this.getSession(socketId);
    const battleState = gameState.battleState!;

    // Simple battle simulation - can be enhanced later
    let turn = 1;
    const maxTurns = 20;

    while (turn <= maxTurns && !battleState.winner) {
      // Add round start event
      const roundEvent: BattleEvent = {
        id: uuidv4(),
        type: 'round_start',
        source: 'system',
        value: 0,
        round: battleState.currentRound,
        turn,
        timestamp: Date.now(),
        description: `Turn ${turn} begins`,
      };
      
      battleState.events.push(roundEvent);

      // Simple damage calculation
      const playerDamage = battleState.playerPieces
        .filter(p => !p.isDead)
        .reduce((sum, p) => sum + p.stats.attack, 0);
      
      const opponentDamage = battleState.opponentPieces
        .filter(p => !p.isDead)
        .reduce((sum, p) => sum + p.stats.attack, 0);

      // Apply damage
      if (playerDamage > 0) {
        battleState.opponentHealth = Math.max(0, battleState.opponentHealth - playerDamage);
        
        const attackEvent: BattleEvent = {
          id: uuidv4(),
          type: 'attack',
          source: 'player-tank',
          sourceName: 'Your Tank',
          target: 'opponent-tank',
          targetName: 'Opponent Tank',
          value: playerDamage,
          round: battleState.currentRound,
          turn,
          timestamp: Date.now(),
          description: `Your tank deals ${playerDamage} damage`,
        };
        
        battleState.events.push(attackEvent);
      }

      if (opponentDamage > 0 && battleState.opponentHealth > 0) {
        battleState.playerHealth = Math.max(0, battleState.playerHealth - opponentDamage);
        
        const attackEvent: BattleEvent = {
          id: uuidv4(),
          type: 'attack',
          source: 'opponent-tank',
          sourceName: 'Opponent Tank',
          target: 'player-tank',
          targetName: 'Your Tank',
          value: opponentDamage,
          round: battleState.currentRound,
          turn,
          timestamp: Date.now(),
          description: `Opponent tank deals ${opponentDamage} damage`,
        };
        
        battleState.events.push(attackEvent);
      }

      // Check for winner
      if (battleState.playerHealth <= 0) {
        battleState.winner = 'opponent';
      } else if (battleState.opponentHealth <= 0) {
        battleState.winner = 'player';
      } else if (turn >= maxTurns) {
        battleState.winner = 'draw';
      }

      battleState.currentTurn = turn;
      turn++;

      // Update game state
      this.updateGameState(socketId, gameState);

      // Add delay for animation
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Battle complete
    battleState.active = false;
    this.updateGameState(socketId, gameState);

    console.log(`🏁 Battle complete! Winner: ${battleState.winner}`);
  }
}