import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { GameState, GamePiece, Position, BattleResult, Tank, DraftState } from '@aquarium/shared-types';
import { PIECE_LIBRARY } from './data/pieces';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class GameService {
  private sessions = new Map<string, GameState>();

  async createSession(sessionId: string, playerId: string): Promise<GameState> {
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
      opponentShop: this.generateShop(),
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

    this.sessions.set(sessionId, initialState);
    return initialState;
  }

  async getSession(sessionId: string): Promise<GameState> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundException('Game session not found');
    }
    return session;
  }

  async removeSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async purchasePiece(
    sessionId: string,
    pieceId: string,
    shopIndex: number,
  ): Promise<GameState> {
    const gameState = await this.getSession(sessionId);
    
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

    this.sessions.set(sessionId, gameState);
    return gameState;
  }

  async sellPiece(sessionId: string, pieceId: string): Promise<GameState> {
    const gameState = await this.getSession(sessionId);
    
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

    this.sessions.set(sessionId, gameState);
    return gameState;
  }

  async rerollShop(sessionId: string): Promise<GameState> {
    const gameState = await this.getSession(sessionId);
    
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

    this.sessions.set(sessionId, gameState);
    return gameState;
  }

  async updateTankPiece(
    sessionId: string,
    pieceId: string,
    position: Position,
    action: 'place' | 'move' | 'remove',
  ): Promise<GameState> {
    const gameState = await this.getSession(sessionId);
    
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

    this.sessions.set(sessionId, gameState);
    
    // Automatically save draft state after tank updates
    await this.saveDraftState(sessionId);
    
    return gameState;
  }

  async startBattle(sessionId: string): Promise<any> {
    const gameState = await this.getSession(sessionId);
    
    // Simulate battle
    const battleResult = this.simulateBattle(gameState.playerTank, gameState.opponentTank);
    
    // Update game state based on result
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
    }

    // Calculate rewards
    const baseReward = 5;
    const winBonus = battleResult.winner === 'player' ? 3 : 0;
    const lossStreakBonus = Math.min(gameState.lossStreak, 3);
    const totalReward = baseReward + winBonus + lossStreakBonus;

    gameState.gold += totalReward;
    gameState.goldHistory.push({
      id: uuidv4(),
      round: gameState.round,
      type: 'battle_reward',
      amount: totalReward,
      description: `Battle ${battleResult.winner === 'player' ? 'won' : 'lost'}`,
      timestamp: Date.now(),
    });

    // Interest
    const interest = Math.min(Math.floor(gameState.gold / 10), 5);
    if (interest > 0) {
      gameState.gold += interest;
      gameState.goldHistory.push({
        id: uuidv4(),
        round: gameState.round,
        type: 'interest',
        amount: interest,
        description: 'Interest earned',
        timestamp: Date.now(),
      });
    }

    // Advance round
    gameState.round++;
    gameState.phase = 'shop';
    gameState.rerollsThisRound = 0;
    
    // Generate new shop
    gameState.shop = this.generateShop();
    
    this.sessions.set(sessionId, gameState);

    return {
      winner: battleResult.winner,
      events: battleResult.events,
      rewards: {
        gold: totalReward,
        interest,
      },
    };
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
    // Simplified random selection - in production, use rarity weights
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

  async toggleShopLock(sessionId: string, shopIndex: number): Promise<GameState> {
    const gameState = await this.getSession(sessionId);
    
    if (gameState.phase !== 'shop') {
      throw new BadRequestException('Can only lock/unlock during shop phase');
    }

    if (shopIndex < 0 || shopIndex >= gameState.shop.length) {
      throw new BadRequestException('Invalid shop index');
    }

    // Toggle lock: if already locked at this index, unlock; otherwise lock at this index
    if (gameState.lockedShopIndex === shopIndex) {
      gameState.lockedShopIndex = null; // Unlock
    } else {
      gameState.lockedShopIndex = shopIndex; // Lock this slot
    }

    this.sessions.set(sessionId, gameState);
    return gameState;
  }

  private simulateBattle(playerTank: Tank, opponentTank: Tank): any {
    // Simplified battle simulation
    const playerPower = playerTank.pieces.reduce((sum, p) => sum + p.stats.attack + p.stats.health, 0);
    const opponentPower = opponentTank.pieces.reduce((sum, p) => sum + p.stats.attack + p.stats.health, 0);
    
    const winner = playerPower > opponentPower ? 'player' : 
                   opponentPower > playerPower ? 'opponent' : 'draw';
    
    return {
      winner,
      events: [],
    };
  }

  // Calculate piece stats with adjacency bonuses
  private calculatePieceStats(piece: GamePiece, allPieces: GamePiece[]): { attack: number; health: number; speed: number } {
    if (!piece.position) {
      return { attack: piece.stats.attack, health: piece.stats.health, speed: piece.stats.speed };
    }

    let attackBonus = 0;
    let healthBonus = 0;
    let speedBonus = 0;

    // Get adjacent positions (8 directions)
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

  // Get calculated stats for all pieces
  async getCalculatedStats(sessionId: string): Promise<{ [pieceId: string]: { attack: number; health: number; speed: number } }> {
    const gameState = await this.getSession(sessionId);
    const result: { [pieceId: string]: { attack: number; health: number; speed: number } } = {};
    
    const placedPieces = gameState.playerTank.pieces.filter(p => p.position);
    
    placedPieces.forEach(piece => {
      result[piece.id] = this.calculatePieceStats(piece, placedPieces);
    });
    
    return result;
  }

  // Save draft state (called on each action)
  async saveDraftState(sessionId: string): Promise<DraftState> {
    const gameState = await this.getSession(sessionId);
    
    const draftState: DraftState = {
      pieces: gameState.playerTank.pieces,
      grid: gameState.playerTank.grid,
      lastModified: Date.now()
    };
    
    gameState.draftState = draftState;
    this.sessions.set(sessionId, gameState);
    
    return draftState;
  }

  // Restore draft state
  async restoreDraftState(sessionId: string, draftState: DraftState): Promise<GameState> {
    const gameState = await this.getSession(sessionId);
    
    // Only restore if in shop phase
    if (gameState.phase !== 'shop') {
      throw new BadRequestException('Can only restore draft during shop phase');
    }
    
    // Validate draft state pieces
    const validPieces = draftState.pieces.filter(piece => {
      // Ensure pieces are actually owned
      return gameState.playerTank.pieces.some(p => p.id === piece.id);
    });
    
    gameState.playerTank.pieces = validPieces;
    gameState.playerTank.grid = draftState.grid;
    gameState.draftState = draftState;
    
    this.sessions.set(sessionId, gameState);
    return gameState;
  }

  // Confirm placement and lock in state
  async confirmPlacement(sessionId: string): Promise<GameState> {
    const gameState = await this.getSession(sessionId);
    
    if (gameState.phase !== 'shop') {
      throw new BadRequestException('Can only confirm placement during shop phase');
    }
    
    // Clear draft state as it's now confirmed
    gameState.draftState = undefined;
    
    this.sessions.set(sessionId, gameState);
    return gameState;
  }
}