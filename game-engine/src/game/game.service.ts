import { Injectable, BadRequestException } from '@nestjs/common';
import { GameState, GamePiece, Position, Tank, DraftState, BattleState, BattleEvent, BattlePiece } from '@aquarium/shared-types';
import { PIECE_LIBRARY } from '../app/data/pieces';
import { v4 as uuidv4 } from 'uuid';
import { PlayerService } from '../player/player.service';
import { AIService } from '../ai/ai.service';
import { BattleService } from '../battle/battle.service';
import { EconomyService } from '../economy/economy.service';
import { TankService } from '../tank/tank.service';

// Game constants
const MAX_ROUNDS = 15;

// Type for battle pieces with team information
interface BattlePieceWithTeam extends BattlePiece {
  team: 'player' | 'opponent';
}

@Injectable()
export class GameService {
  constructor(
    private playerService: PlayerService,
    private aiService: AIService,
    private battleService: BattleService,
    private economyService: EconomyService,
    private tankService: TankService
  ) {}

  async createSession(socketId: string, playerId: string): Promise<GameState> {
    // Map socket to player
    this.playerService.mapSocketToPlayer(socketId, playerId);
    
    // Create initial game state
    const playerStartingQuality = Math.floor(Math.random() * 3) + 6; // 6-8 random start
    const opponentStartingQuality = Math.floor(Math.random() * 3) + 6; // 6-8 random start
    const initialState: GameState = {
      phase: 'shop',
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
        waterQuality: playerStartingQuality,
        baseWaterQuality: playerStartingQuality, // Store original for calculations
        temperature: 25,
        grid: Array(6).fill(null).map(() => Array(8).fill(null)),
      },
      opponentTank: {
        id: 'opponent',
        pieces: [],
        waterQuality: opponentStartingQuality,
        baseWaterQuality: opponentStartingQuality, // Store original for calculations
        temperature: 25,
        grid: Array(6).fill(null).map(() => Array(8).fill(null)),
      },
      shop: this.economyService.generateShop(),
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

    // Recalculate water quality after adding new piece
    gameState.playerTank.waterQuality = this.tankService.calculateWaterQuality(gameState.playerTank);

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
    const sellPrice = this.economyService.calculateSellValue(piece.cost);
    
    // Add gold
    gameState.gold += sellPrice;
    
    // Remove piece from tank and grid
    gameState.playerTank.pieces.splice(pieceIndex, 1);
    this.tankService.removePieceFromGrid(gameState.playerTank, piece);

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

    // Recalculate water quality after removing piece
    gameState.playerTank.waterQuality = this.tankService.calculateWaterQuality(gameState.playerTank);

    this.updateGameState(socketId, gameState);
    return gameState;
  }

  async rerollShop(socketId: string): Promise<GameState> {
    const gameState = await this.getSession(socketId);
    
    if (gameState.phase !== 'shop') {
      throw new BadRequestException('Can only reroll during shop phase');
    }

    // Calculate scaled reroll cost: base 2g, +1g per reroll after 5th
    const rerollCost = this.economyService.calculateRerollCost(gameState.rerollsThisRound);
    
    if (gameState.gold < rerollCost) {
      throw new BadRequestException(`Insufficient gold for reroll (costs ${rerollCost}g)`);
    }

    // Deduct gold
    gameState.gold -= rerollCost;
    gameState.rerollsThisRound++;

    // Generate new shop (preserve locked slot)
    gameState.shop = this.economyService.generateShop(gameState.shop, gameState.lockedShopIndex);

    // Add gold transaction
    gameState.goldHistory.push(this.economyService.createGoldTransaction(
      gameState.round,
      'reroll',
      -rerollCost,
      this.economyService.formatRerollDescription(gameState.rerollsThisRound)
    ));

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

    try {
      this.tankService.updateTankPiece(gameState.playerTank, pieceId, position, action);
    } catch (error) {
      throw new BadRequestException(error.message);
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
      gameState.winStreak++;
      gameState.opponentLossStreak++;
      gameState.opponentWinStreak = 0;
    } else if (battleResult.winner === 'opponent') {
      gameState.losses++;
      gameState.opponentWins++;
      gameState.lossStreak++;
      gameState.winStreak = 0;
      gameState.opponentLossStreak = 0;
      gameState.opponentWinStreak++;
    } else if (battleResult.winner === 'draw') {
      // Check if this is a double loss (both HP at 0) or a normal draw
      const isDoubleLoss = gameState.battleState?.playerHealth === 0 && gameState.battleState?.opponentHealth === 0;
      
      if (isDoubleLoss) {
        // Double loss - both players lose
        gameState.losses++;
        gameState.opponentLosses++;
        gameState.lossStreak++;
        gameState.winStreak = 0;
        gameState.opponentLossStreak++;
        gameState.opponentWinStreak = 0;
      } else {
        // Normal draw (timeout) - both parties "win"
        gameState.wins++;
        gameState.opponentWins++;
        gameState.lossStreak = 0;
        gameState.winStreak++;
        gameState.opponentLossStreak = 0;
        gameState.opponentWinStreak++;
      }
    }

    // Check if this is a double loss scenario
    const isDoubleLoss = battleResult.winner === 'draw' && 
                         gameState.battleState?.playerHealth === 0 && 
                         gameState.battleState?.opponentHealth === 0;
    
    // Calculate player rewards - everyone gets base, only streaks provide bonuses
    const playerBaseReward = this.economyService.calculateGoldReward(battleResult.winner === 'player');
    // NO win/loss bonuses - only streaks matter
    
    // New loss streak bonuses: 2/4/6/8/10/12 gold
    const playerLossStreakBonus = this.economyService.calculateLossStreakBonus(gameState.lossStreak);
    
    // New win streak bonuses: 1/2/3/4 gold
    const playerWinStreakBonus = this.economyService.calculateWinStreakBonus(gameState.winStreak);
    
    // Add base battle reward (everyone gets this regardless of outcome)
    gameState.gold += playerBaseReward;
    gameState.goldHistory.push(this.economyService.createGoldTransaction(
      gameState.round,
      'battle_reward',
      playerBaseReward,
      `Battle ${battleResult.winner === 'player' ? 'won' : battleResult.winner === 'draw' ? (isDoubleLoss ? 'double loss (no attackers)' : 'tied') : 'lost'} (+5 base)`
    ));

    // Add separate loss streak bonus if applicable  
    if (playerLossStreakBonus > 0) {
      gameState.gold += playerLossStreakBonus;
      gameState.goldHistory.push(this.economyService.createGoldTransaction(
        gameState.round,
        'loss_streak_bonus',
        playerLossStreakBonus,
        `Loss streak bonus (L${gameState.lossStreak}: +${playerLossStreakBonus}g)`
      ));
    }
    
    // Add win streak bonus if applicable
    if (playerWinStreakBonus > 0) {
      gameState.gold += playerWinStreakBonus;
      gameState.goldHistory.push(this.economyService.createGoldTransaction(
        gameState.round,
        'win_streak_bonus',
        playerWinStreakBonus,
        `Win streak bonus (W${gameState.winStreak}: +${playerWinStreakBonus}g)`
      ));
    }

    // Calculate opponent rewards (same mechanics as player)
    const opponentBaseReward = this.economyService.calculateGoldReward(battleResult.winner === 'opponent');
    // NO win/loss bonuses - only streaks matter
    
    // Opponent loss streak bonuses
    const opponentLossStreakBonus = this.economyService.calculateLossStreakBonus(gameState.opponentLossStreak);
    
    // Opponent win streak bonuses
    const opponentWinStreakBonus = this.economyService.calculateWinStreakBonus(gameState.opponentWinStreak);
    
    // Give opponent base reward
    gameState.opponentGold += opponentBaseReward;
    
    // Add opponent streak bonuses separately
    if (opponentLossStreakBonus > 0) {
      gameState.opponentGold += opponentLossStreakBonus;
    }
    if (opponentWinStreakBonus > 0) {
      gameState.opponentGold += opponentWinStreakBonus;
    }

    // Player Interest
    const playerInterest = this.economyService.calculateInterest(gameState.gold);
    if (playerInterest > 0) {
      gameState.gold += playerInterest;
      gameState.goldHistory.push(this.economyService.createGoldTransaction(
        gameState.round,
        'interest',
        playerInterest,
        'Interest earned'
      ));
    }

    // Opponent Interest (same calculation as player)
    const opponentInterest = this.economyService.calculateInterest(gameState.opponentGold);
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
    gameState.shop = this.economyService.generateShop(gameState.shop, gameState.lockedShopIndex);
    
    // Keep battle state so user can see battle results
    // battleState will be cleared when user clicks continue
    
    this.updateGameState(socketId, gameState);

    return {
      winner: battleResult.winner,
      rewards: {
        playerGold: playerBaseReward + playerLossStreakBonus + playerWinStreakBonus,
        playerInterest,
        opponentGold: opponentBaseReward + opponentLossStreakBonus + opponentWinStreakBonus,
        opponentInterest,
      },
      isGameComplete,
    };
  }

  async simulateBattleEvents(socketId: string): Promise<any> {
    const gameState = await this.getSession(socketId);
    
    // Legacy method - only used for generating battle events for non-live battles  
    // This method does NOT apply any rewards or update game state
    const battleResult = this.battleService.simulateBattle(gameState.playerTank, gameState.opponentTank);
    
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
    this.tankService.respawnPieces(gameState.playerTank);
    this.tankService.respawnPieces(gameState.opponentTank);
    
    // Shop should already be generated from finalizeBattleRewards, but ensure it exists
    if (!gameState.shop || gameState.shop.length === 0) {
      gameState.shop = this.economyService.generateShop(gameState.shop, gameState.lockedShopIndex);
    }
    
    this.updateGameState(socketId, gameState);
    return gameState;
  }

  async resetGameAfterCampaign(socketId: string): Promise<GameState> {
    const playerId = this.playerService.getPlayerIdFromSocket(socketId);
    
    // Create fresh game state (same as initial creation)
    const playerStartingQuality = Math.floor(Math.random() * 3) + 6; // 6-8 random start
    const opponentStartingQuality = Math.floor(Math.random() * 3) + 6; // 6-8 random start
    const resetState: GameState = {
      phase: 'shop',
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
        waterQuality: playerStartingQuality,
        baseWaterQuality: playerStartingQuality, // Store original for calculations
        temperature: 25,
        grid: Array(6).fill(null).map(() => Array(8).fill(null)),
      },
      opponentTank: {
        id: 'opponent',
        pieces: [],
        waterQuality: opponentStartingQuality,
        baseWaterQuality: opponentStartingQuality, // Store original for calculations
        temperature: 25,
        grid: Array(6).fill(null).map(() => Array(8).fill(null)),
      },
      shop: this.economyService.generateShop(),
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
      result[piece.id] = this.tankService.calculatePieceStats(piece, placedPieces);
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
    const { remainingGold } = this.aiService.updateOpponentTank(
      gameState,
      (tank) => this.tankService.calculateWaterQuality(tank),
      (tank, piece) => this.tankService.findValidPositionForOpponent(tank, piece),
      (tank, piece) => this.tankService.placePieceOnGrid(tank, piece),
      (tank, piece) => this.tankService.removePieceFromGrid(tank, piece),
      (tank, piece, targetType) => this.tankService.findOptimalConsumablePosition(tank, piece)
    );
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
    this.tankService.processConsumables(gameState.playerTank);
    this.tankService.processConsumables(gameState.opponentTank);

    // Initialize battle state but keep on placement phase
    const battleState = this.battleService.initializeBattleState(gameState, (piece, pieces) => this.tankService.calculatePieceStats(piece, pieces));
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

    const turnEvents = this.battleService.processBattleTurn(
      battleState,
      gameState.playerTank.waterQuality,
      gameState.opponentTank.waterQuality,
      gameState
    );
    this.updateGameState(socketId, gameState);

    return { gameState, turnEvents };
  }

  // Private helper methods
  private updateGameState(socketId: string, gameState: GameState): void {
    const playerId = this.playerService.getPlayerIdFromSocket(socketId);
    this.playerService.updateSession(playerId, gameState);
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

      // Simple damage calculation (only fish can attack)
      const playerDamage = battleState.playerPieces
        .filter(p => !p.isDead && p.type === 'fish')
        .reduce((sum, p) => sum + p.stats.attack, 0);
      
      const opponentDamage = battleState.opponentPieces
        .filter(p => !p.isDead && p.type === 'fish')
        .reduce((sum, p) => sum + p.stats.attack, 0);
      
      // Check for double loss scenario (no attackers on either side)
      if (playerDamage === 0 && opponentDamage === 0) {
        battleState.playerHealth = 0;
        battleState.opponentHealth = 0;
        battleState.winner = 'draw'; // Double loss
        break;
      }

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