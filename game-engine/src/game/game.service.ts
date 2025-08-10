import { Injectable, BadRequestException } from '@nestjs/common';
import { GameState, GamePiece, Position, Tank, DraftState, BattleState, BattleEvent, BattlePiece } from '@aquarium/shared-types';
import { PIECE_LIBRARY } from '../app/data/pieces';
import { v4 as uuidv4 } from 'uuid';
import { PlayerService } from '../player/player.service';
import { AIService } from '../ai/ai.service';
import { BattleService } from '../battle/battle.service';
import { EconomyService } from '../economy/economy.service';

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
    private economyService: EconomyService
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
    gameState.playerTank.waterQuality = this.calculateWaterQuality(gameState.playerTank);

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

    // Recalculate water quality after removing piece
    gameState.playerTank.waterQuality = this.calculateWaterQuality(gameState.playerTank);

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

    // Recalculate water quality after placing/moving/removing pieces
    gameState.playerTank.waterQuality = this.calculateWaterQuality(gameState.playerTank);

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
    this.respawnPieces(gameState.playerTank);
    this.respawnPieces(gameState.opponentTank);
    
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
    const { remainingGold } = this.aiService.updateOpponentTank(
      gameState,
      (tank) => this.calculateWaterQuality(tank),
      (tank, piece) => this.findValidPositionForOpponent(tank, piece),
      (tank, piece) => this.placePieceOnGrid(tank, piece),
      (tank, piece) => this.removePieceFromGrid(tank, piece),
      (tank, piece, targetType) => this.findOptimalConsumablePosition(tank, piece)
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
    this.processConsumables(gameState.playerTank);
    this.processConsumables(gameState.opponentTank);

    // Initialize battle state but keep on placement phase
    const battleState = this.battleService.initializeBattleState(gameState, (piece, pieces) => this.calculatePieceStats(piece, pieces));
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

  private calculateWaterQuality(tank: Tank): number {
    // Start with the tank's original baseline quality (never changes)
    let quality = tank.baseWaterQuality;
    
    // Count placed pieces and calculate the total effect
    let totalEffect = 0;
    let fishCount = 0;
    let plantCount = 0;
    let filterCount = 0;
    
    for (const piece of tank.pieces) {
      if (!piece.position) continue; // Only count placed pieces
      
      
      if (piece.type === 'fish') {
        totalEffect -= 1; // Fish decrease quality
        fishCount++;
      } else if (piece.type === 'plant') {
        totalEffect += 1; // Plants increase quality
        plantCount++;
      } else if (piece.type === 'equipment') {
        // Most equipment is neutral, but check for special items
        if (piece.name === 'Sponge Filter' || piece.tags?.includes('filter')) {
          totalEffect += 1; // Filters improve quality
          filterCount++;
        }
      }
    }
    
    
    // Apply the effect to the starting quality
    quality += totalEffect;
    
    
    // Clamp quality between 1-10
    return Math.max(1, Math.min(10, quality));
  }

  private respawnPieces(tank: Tank): void {
    // Respawn all non-consumable pieces (fish, plants, equipment), preserving their permanent bonuses
    for (const piece of tank.pieces) {
      if (piece.type === 'fish' || piece.type === 'plant' || piece.type === 'equipment') {
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

  private aretwoPiecesAdjacent(piece1: GamePiece, piece2: GamePiece): boolean {
    if (!piece1.position || !piece2.position || piece1.id === piece2.id) return false;
    
    // Get all cells occupied by piece1
    const piece1Cells = piece1.shape.map(offset => ({
      x: piece1.position!.x + offset.x,
      y: piece1.position!.y + offset.y
    }));
    
    // Get all cells occupied by piece2
    const piece2Cells = piece2.shape.map(offset => ({
      x: piece2.position!.x + offset.x,
      y: piece2.position!.y + offset.y
    }));
    
    // Check if any cell of piece1 is adjacent to any cell of piece2
    return piece1Cells.some(cell1 => {
      return piece2Cells.some(cell2 => {
        const dx = Math.abs(cell1.x - cell2.x);
        const dy = Math.abs(cell1.y - cell2.y);
        // Adjacent if within 1 cell in both directions (8-directional adjacency)
        return dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0);
      });
    });
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


  private calculatePieceStats(piece: GamePiece, allPieces: GamePiece[]): { attack: number; health: number; speed: number } {
    if (!piece.position) {
      return { attack: piece.stats.attack, health: piece.stats.health, speed: piece.stats.speed };
    }

    let attackBonus = 0;
    let healthBonus = 0;
    let speedBonus = 0;

    // Find adjacent pieces using the proper adjacency check
    const adjacentPieces = allPieces.filter(p => this.aretwoPiecesAdjacent(piece, p));

    // Apply adjacency bonuses from plants and consumables to fish
    adjacentPieces.forEach(adjacentPiece => {
      if ((adjacentPiece.type === 'plant' || adjacentPiece.type === 'consumable') && piece.type === 'fish') {
        const bonusAttack = adjacentPiece.attackBonus || 0;
        const bonusHealth = adjacentPiece.healthBonus || 0;
        const bonusSpeed = adjacentPiece.speedBonus || 0;
        
        attackBonus += bonusAttack;
        healthBonus += bonusHealth;
        speedBonus += bonusSpeed;
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




  private findOptimalConsumablePosition(tank: Tank, consumable: GamePiece): Position | null {
    let bestPosition: Position | null = null;
    let maxFishTouched = 0;
    
    console.log(`🤖 Finding optimal position for consumable ${consumable.name}`);
    
    // Try every possible position and count adjacent fish
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 8; x++) {
        const position = { x, y };
        
        // Check if this position is valid for placement
        if (!this.isValidPosition(tank, consumable, position)) {
          continue;
        }
        
        // Count how many fish this position would touch
        const fishTouched = this.countAdjacentFish(tank, consumable, position);
        
        if (fishTouched > maxFishTouched) {
          maxFishTouched = fishTouched;
          bestPosition = position;
        }
      }
    }
    
    console.log(`🤖 Best consumable position touches ${maxFishTouched} fish at ${bestPosition ? `(${bestPosition.x},${bestPosition.y})` : 'none'}`);
    return bestPosition;
  }

  private countAdjacentFish(tank: Tank, consumable: GamePiece, position: Position): number {
    const consumablePositions = consumable.shape.map(offset => ({
      x: position.x + offset.x,
      y: position.y + offset.y
    }));
    
    // Get all positions adjacent to the consumable
    const adjacentPositions = new Set<string>();
    
    consumablePositions.forEach(consPos => {
      // Add all 8 adjacent positions for this consumable cell
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue; // Skip the consumable cell itself
          
          const adjPos = { x: consPos.x + dx, y: consPos.y + dy };
          
          // Only add if it's within bounds and not occupied by the consumable itself
          if (adjPos.x >= 0 && adjPos.x < 8 && adjPos.y >= 0 && adjPos.y < 6) {
            const isConsumableCell = consumablePositions.some(cp => cp.x === adjPos.x && cp.y === adjPos.y);
            if (!isConsumableCell) {
              adjacentPositions.add(`${adjPos.x},${adjPos.y}`);
            }
          }
        }
      }
    });
    
    // Count how many fish are at these adjacent positions
    let fishCount = 0;
    const adjacentPosArray = Array.from(adjacentPositions).map(posStr => {
      const [x, y] = posStr.split(',').map(Number);
      return { x, y };
    });
    
    for (const adjPos of adjacentPosArray) {
      // Find if there's a fish piece at this position
      const fishAtPosition = tank.pieces.find(piece => {
        if (piece.type !== 'fish' || !piece.position) return false;
        
        // Check if any part of this fish occupies the adjacent position
        return piece.shape.some(offset => {
          const fishCellX = piece.position!.x + offset.x;
          const fishCellY = piece.position!.y + offset.y;
          return fishCellX === adjPos.x && fishCellY === adjPos.y;
        });
      });
      
      if (fishAtPosition) {
        fishCount++;
      }
    }
    
    return fishCount;
  }



  private findValidPositionForOpponent(tank: Tank, piece: GamePiece): Position | null {
    // Try to find a valid position for the piece without overlapping existing pieces
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 8; x++) {
        const position = { x, y };
        if (this.isValidPositionForNewPiece(tank, piece, position)) {
          return position;
        }
      }
    }
    return null; // No valid position found
  }

  private isValidPositionForNewPiece(tank: Tank, piece: GamePiece, position: Position): boolean {
    // For new pieces, simply check if grid cells are empty
    for (const offset of piece.shape) {
      const x = position.x + offset.x;
      const y = position.y + offset.y;
      
      if (x < 0 || x >= 8 || y < 0 || y >= 6) {
        return false;
      }
      
      // For new pieces, any occupied cell means invalid position
      if (tank.grid[y][x] !== null) {
        return false;
      }
    }
    
    return true;
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