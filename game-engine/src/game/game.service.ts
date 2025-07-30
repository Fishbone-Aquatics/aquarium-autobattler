import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { GameState, GamePiece, Position, Tank, DraftState, BattleState, BattleEvent, BattlePiece, StatusEffect } from '@aquarium/shared-types';
import { PIECE_LIBRARY } from '../app/data/pieces';
import { v4 as uuidv4 } from 'uuid';
import { PlayerService } from '../player/player.service';

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
    
    // Remove from shop (unless locked)
    if (gameState.lockedShopIndex !== shopIndex) {
      gameState.shop[shopIndex] = null;
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
    const sellPrice = Math.floor(piece.cost * 0.5); // Sell for 50% of cost
    
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
    const newShop = this.generateShop();
    if (gameState.lockedShopIndex !== null && gameState.shop[gameState.lockedShopIndex]) {
      newShop[gameState.lockedShopIndex] = gameState.shop[gameState.lockedShopIndex];
    }
    gameState.shop = newShop;

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
    const playerTotalReward = playerBaseReward + playerWinBonus + playerLossStreakBonus;

    gameState.gold += playerTotalReward;
    gameState.goldHistory.push({
      id: uuidv4(),
      round: gameState.round,
      type: 'battle_reward',
      amount: playerTotalReward,
      description: `Battle ${battleResult.winner === 'player' ? 'won' : battleResult.winner === 'draw' ? 'tied' : 'lost'}`,
      timestamp: Date.now(),
    });

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

    // Advance round
    gameState.round++;
    // Keep the game in battle phase so user can see results and click continue
    // Phase will be changed to 'shop' when user clicks "Continue to Next Round"
    gameState.rerollsThisRound = 0;
    
    // Generate new shop for when they return
    gameState.shop = this.generateShop();
    
    // Keep battle state so user can see battle results
    // battleState will be cleared when user clicks continue
    
    this.updateGameState(socketId, gameState);

    return {
      winner: battleResult.winner,
      rewards: {
        playerGold: playerTotalReward,
        playerInterest,
        opponentGold: opponentTotalReward,
        opponentInterest,
      },
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
    
    // Return to shop phase and clear battle results
    // (Rewards should have already been applied by finalizeBattleRewards)
    gameState.phase = 'shop';
    gameState.rerollsThisRound = 0;
    
    // Clear battle state now that user has seen results
    gameState.battleState = undefined;
    
    // Shop should already be generated from finalizeBattleRewards, but ensure it exists
    if (!gameState.shop || gameState.shop.length === 0) {
      gameState.shop = this.generateShop();
    }
    
    this.updateGameState(socketId, gameState);
    return gameState;
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

    // Generate opponent tank for battle comparison
    // Use current opponent gold (which scales with rounds) instead of fixed 10
    const { tank, remainingGold } = this.generateOpponentTankWithGold(gameState.opponentGold);
    gameState.opponentTank = tank;
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
      description: `Turn ${battleState.currentTurn} begins`,
    };
    
    battleState.events.push(roundEvent);
    turnEvents.push(roundEvent);

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
        turn: battleState.currentTurn,
        timestamp: Date.now(),
        description: `Your tank deals ${playerDamage} damage`,
      };
      
      battleState.events.push(attackEvent);
      turnEvents.push(attackEvent);
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
        turn: battleState.currentTurn,
        timestamp: Date.now(),
        description: `Opponent tank deals ${opponentDamage} damage`,
      };
      
      battleState.events.push(attackEvent);
      turnEvents.push(attackEvent);
    }

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

  private generateShop(): (GamePiece | null)[] {
    const shopSize = 6;
    const shop: (GamePiece | null)[] = [];
    
    for (let i = 0; i < shopSize; i++) {
      const piece = this.getRandomPiece();
      shop.push(piece ? { ...piece, id: uuidv4() } : null);
    }
    
    return shop;
  }

  private getRandomPiece(): GamePiece | null {
    const pieces = [...PIECE_LIBRARY];
    return pieces[Math.floor(Math.random() * pieces.length)] || null;
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

    // Get adjacent positions
    const adjacentPositions = [
      { x: piece.position.x - 1, y: piece.position.y - 1 },
      { x: piece.position.x, y: piece.position.y - 1 },
      { x: piece.position.x + 1, y: piece.position.y - 1 },
      { x: piece.position.x - 1, y: piece.position.y },
      { x: piece.position.x + 1, y: piece.position.y },
      { x: piece.position.x - 1, y: piece.position.y + 1 },
      { x: piece.position.x, y: piece.position.y + 1 },
      { x: piece.position.x + 1, y: piece.position.y + 1 },
    ];

    // Find adjacent pieces
    const adjacentPieces = allPieces.filter(p => 
      p.position && p.id !== piece.id && adjacentPositions.some(pos => 
        p.position!.x === pos.x && p.position!.y === pos.y
      )
    );

    // Apply adjacency bonuses
    adjacentPieces.forEach(adjacentPiece => {
      if ((adjacentPiece.type === 'plant' || adjacentPiece.type === 'consumable') && piece.type === 'fish') {
        if (adjacentPiece.attackBonus) attackBonus += adjacentPiece.attackBonus;
        if (adjacentPiece.healthBonus) healthBonus += adjacentPiece.healthBonus;
        if (adjacentPiece.speedBonus) speedBonus += adjacentPiece.speedBonus;
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

    return {
      attack: piece.stats.attack + attackBonus,
      health: piece.stats.health + healthBonus,
      speed: piece.stats.speed + speedBonus
    };
  }

  private generateOpponentTankWithGold(startingGold: number = 10): { tank: Tank; remainingGold: number } {
    console.log(`🤖 Generating opponent tank with ${startingGold} gold`);
    
    // Generate a simple opponent tank for testing
    const opponentPieces: GamePiece[] = [];
    const grid: (string | null)[][] = Array(6).fill(null).map(() => Array(8).fill(null));
    
    // Use the opponent's actual gold amount
    let opponentGold = startingGold;
    const maxPieces = 5;
    let pieceCount = 0;
    
    // Generate pieces within budget with safety limits
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 10;
    
    while (opponentGold > 0 && pieceCount < maxPieces && consecutiveFailures < maxConsecutiveFailures) {
      const piece = this.getRandomPiece();
      
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
    };
  }

  private convertToBattlePieces(pieces: GamePiece[]): BattlePiece[] {
    return pieces.filter(p => p.position).map(piece => ({
      ...piece,
      currentHealth: piece.stats.maxHealth,
      isDead: false,
      statusEffects: [],
      nextActionTime: 0,
    }));
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