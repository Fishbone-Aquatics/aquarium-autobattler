import { Test, TestingModule } from '@nestjs/testing';
import { GameService } from './game.service';
import { PlayerService } from '../player/player.service';
import { AIService } from '../ai/ai.service';
import { BattleService } from '../battle/battle.service';
import { GameState } from '@aquarium/shared-types';

describe('Game Flow Integration Tests', () => {
  let gameService: GameService;
  let playerService: PlayerService;
  let testSocketId: string;
  let testPlayerId: string;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameService,
        PlayerService,
        AIService,
        BattleService,
      ],
    }).compile();

    gameService = module.get<GameService>(GameService);
    playerService = module.get<PlayerService>(PlayerService);
    testSocketId = `test-socket-${Date.now()}`;
    testPlayerId = `test-player-${Date.now()}`;
  });

  afterEach(async () => {
    // Clean up test sessions
    try {
      gameService.removeSession(testSocketId);
    } catch (error) {
      // Session might not exist, which is fine
    }
  });

  describe('Core Game Flow', () => {
    it('should create a new game session', async () => {
      const gameState = await gameService.createSession(testSocketId, testPlayerId);

      expect(gameState).toBeDefined();
      expect(gameState.phase).toBe('shop');
      expect(gameState.round).toBe(1);
      expect(gameState.gold).toBe(10); // Starting gold
      expect(gameState.playerTank).toBeDefined();
      expect(gameState.opponentTank).toBeDefined();
      expect(gameState.shop).toBeDefined();
      expect(gameState.shop.length).toBe(6); // Standard shop size
      expect(gameState.playerTank.waterQuality).toBeGreaterThanOrEqual(6);
      expect(gameState.playerTank.waterQuality).toBeLessThanOrEqual(8);
    });

    it('should allow purchasing pieces from shop', async () => {
      const gameState = await gameService.createSession(testSocketId, testPlayerId);
      const initialGold = gameState.gold;
      
      // Find a piece in shop to buy
      const shopIndex = gameState.shop.findIndex(piece => piece && piece.cost <= initialGold);
      expect(shopIndex).toBeGreaterThanOrEqual(0);
      
      const pieceToBuy = gameState.shop[shopIndex]!;

      // Purchase the piece
      const updatedState = await gameService.purchasePiece(testSocketId, pieceToBuy.id, shopIndex);
      
      // Verify purchase
      expect(updatedState.gold).toBe(initialGold - pieceToBuy.cost);
      
      // Find the piece in inventory (not yet placed)
      const inventoryPiece = updatedState.playerTank.pieces.find(p => 
        p.name === pieceToBuy.name && !p.position
      );
      expect(inventoryPiece).toBeDefined();
      
      // Shop slot should now be empty
      expect(updatedState.shop[shopIndex]).toBeNull();
    });

    it('should allow placing pieces on tank grid', async () => {
      const gameState = await gameService.createSession(testSocketId, testPlayerId);
      
      // Buy a simple single-cell piece
      const shopIndex = gameState.shop.findIndex(piece => 
        piece && piece.shape.length === 1 && piece.cost <= gameState.gold
      );
      expect(shopIndex).toBeGreaterThanOrEqual(0);
      
      const simplePiece = gameState.shop[shopIndex]!;
      let updatedState = await gameService.purchasePiece(testSocketId, simplePiece.id, shopIndex);
      
      // Get the bought piece from inventory
      const inventoryPiece = updatedState.playerTank.pieces.find(p => 
        p.name === simplePiece.name && !p.position
      );
      expect(inventoryPiece).toBeDefined();

      // Place the piece at position (0,0) using tank update
      const finalState = await gameService.updateTankPiece(
        testSocketId,
        inventoryPiece!.id,
        { x: 0, y: 0 },
        'place'
      );

      // Verify placement
      const placedPiece = finalState.playerTank.pieces.find(p => p.id === inventoryPiece!.id);
      expect(placedPiece!.position).toEqual({ x: 0, y: 0 });
      expect(finalState.playerTank.grid[0][0]).toBe(inventoryPiece!.id);
    });

    it('should calculate water quality correctly', async () => {
      const gameState = await gameService.createSession(testSocketId, testPlayerId);
      
      // Initial water quality should be in the 6-8 range
      expect(gameState.playerTank.waterQuality).toBeGreaterThanOrEqual(6);
      expect(gameState.playerTank.waterQuality).toBeLessThanOrEqual(8);
      
      // Buy and place a plant (should increase water quality)
      const shopIndex = gameState.shop.findIndex(piece => 
        piece && piece.type === 'plant' && piece.cost <= gameState.gold
      );
      
      if (shopIndex >= 0) {
        const plant = gameState.shop[shopIndex]!;
        let updatedState = await gameService.purchasePiece(testSocketId, plant.id, shopIndex);
        
        const plantPiece = updatedState.playerTank.pieces.find(p => p.name === plant.name);
        
        const finalState = await gameService.updateTankPiece(
          testSocketId,
          plantPiece!.id,
          { x: 0, y: 0 },
          'place'
        );

        expect(finalState.playerTank.waterQuality).toBeGreaterThan(gameState.playerTank.waterQuality);
      }
    });

    it('should handle shop reroll mechanics', async () => {
      const gameState = await gameService.createSession(testSocketId, testPlayerId);
      const originalShop = gameState.shop.slice(); // Copy shop
      const initialGold = gameState.gold;
      
      // Reroll shop
      const updatedState = await gameService.rerollShop(testSocketId);
      
      // Gold should be reduced by reroll cost (2 gold)
      expect(updatedState.gold).toBe(initialGold - 2);
      
      // Shop should be different (at least some pieces should change)
      const newShop = updatedState.shop;
      let differentPieces = 0;
      for (let i = 0; i < 6; i++) {
        if (originalShop[i]?.id !== newShop[i]?.id) {
          differentPieces++;
        }
      }
      expect(differentPieces).toBeGreaterThan(0); // At least some pieces should be different
    });

    it('should handle selling pieces', async () => {
      const gameState = await gameService.createSession(testSocketId, testPlayerId);
      
      // Buy a piece first
      const shopIndex = gameState.shop.findIndex(piece => 
        piece && piece.cost <= gameState.gold
      );
      expect(shopIndex).toBeGreaterThanOrEqual(0);
      
      const pieceToBuy = gameState.shop[shopIndex]!;
      let updatedState = await gameService.purchasePiece(testSocketId, pieceToBuy.id, shopIndex);
      
      const goldAfterPurchase = updatedState.gold;
      const purchasedPiece = updatedState.playerTank.pieces.find(p => p.name === pieceToBuy.name);
      expect(purchasedPiece).toBeDefined();
      
      // Sell the piece
      const finalState = await gameService.sellPiece(testSocketId, purchasedPiece!.id);
      
      // Should get back 75% of cost (SELL_PERCENTAGE = 0.75)
      const expectedRefund = Math.floor(pieceToBuy.cost * 0.75);
      expect(finalState.gold).toBe(goldAfterPurchase + expectedRefund);
      
      // Piece should be removed from tank
      const soldPiece = finalState.playerTank.pieces.find(p => p.id === purchasedPiece!.id);
      expect(soldPiece).toBeUndefined();
    });

    it('should start and complete battles', async () => {
      const gameState = await gameService.createSession(testSocketId, testPlayerId);
      
      // Place a fish for battle (if available in shop)
      const fishIndex = gameState.shop.findIndex(piece => 
        piece && piece.type === 'fish' && piece.cost <= gameState.gold
      );
      
      if (fishIndex >= 0) {
        const fish = gameState.shop[fishIndex]!;
        let updatedState = await gameService.purchasePiece(testSocketId, fish.id, fishIndex);
        
        const fishPiece = updatedState.playerTank.pieces.find(p => p.name === fish.name);
        updatedState = await gameService.updateTankPiece(
          testSocketId,
          fishPiece!.id,
          { x: 0, y: 0 },
          'place'
        );
        
        // Start battle
        const battleState = await gameService.simulateBattleEvents(testSocketId);
        
        expect(battleState).toBeDefined();
        expect(['player', 'opponent', 'draw']).toContain(battleState.winner);
        expect(battleState.events).toBeDefined();
        expect(Array.isArray(battleState.events)).toBe(true);
        
        // Battle should be complete
        expect(battleState.active).toBe(false);
      }
    });

    it('should progress to next round after returning to shop', async () => {
      const gameState = await gameService.createSession(testSocketId, testPlayerId);
      expect(gameState.round).toBe(1);
      
      // Start battle
      await gameService.simulateBattleEvents(testSocketId);
      
      // Return to shop (simulates round progression)
      const updatedState = await gameService.returnToShopPhase(testSocketId);
      
      expect(updatedState.phase).toBe('placement');
      expect(updatedState.round).toBe(2); // Should progress to next round
    });
  });

  describe('AI Opponent Behavior', () => {
    it('should generate opponent pieces during battles', async () => {
      const gameState = await gameService.createSession(testSocketId, testPlayerId);
      
      // Start battle to trigger AI opponent generation
      const battleState = await gameService.simulateBattleEvents(testSocketId);
      
      // Get updated game state to check opponent
      const updatedState = await playerService.getSession(testPlayerId);
      
      // Opponent should have some pieces
      expect(updatedState.opponentTank.pieces.length).toBeGreaterThan(0);
      
      // Opponent pieces should have valid positions (collision fix verification)
      const placedOpponentPieces = updatedState.opponentTank.pieces.filter(p => p.position);
      expect(placedOpponentPieces.length).toBeGreaterThan(0);
      
      // Check for position conflicts (no two pieces at same position)
      const positions = new Set();
      for (const piece of placedOpponentPieces) {
        for (const offset of piece.shape) {
          const pos = `${piece.position!.x + offset.x},${piece.position!.y + offset.y}`;
          expect(positions.has(pos)).toBe(false); // No conflicts!
          positions.add(pos);
        }
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid piece placement gracefully', async () => {
      const gameState = await gameService.createSession(testSocketId, testPlayerId);
      
      // Try to place a piece without buying it first
      await expect(
        gameService.updateTankPiece(
          testSocketId,
          'non-existent-piece',
          { x: 0, y: 0 },
          'place'
        )
      ).rejects.toThrow();
    });

    it('should handle insufficient gold for purchases', async () => {
      const gameState = await gameService.createSession(testSocketId, testPlayerId);
      
      // Find the most expensive piece in shop
      const expensivePiece = gameState.shop.reduce((most, current) => {
        if (!current || !most) return current || most;
        return current.cost > most.cost ? current : most;
      });
      
      const expensiveIndex = gameState.shop.findIndex(p => p === expensivePiece);
      
      if (expensivePiece && expensivePiece.cost > gameState.gold) {
        await expect(
          gameService.purchasePiece(testSocketId, expensivePiece.id, expensiveIndex)
        ).rejects.toThrow();
      }
    });

    it('should handle invalid shop reroll when insufficient gold', async () => {
      const gameState = await gameService.createSession(testSocketId, testPlayerId);
      
      // Spend all gold first
      while (gameState.gold >= 2) {
        try {
          const cheapPieceIndex = gameState.shop.findIndex(p => p && p.cost <= gameState.gold);
          if (cheapPieceIndex === -1) break;
          await gameService.purchasePiece(testSocketId, gameState.shop[cheapPieceIndex]!.id, cheapPieceIndex);
          const updatedState = await playerService.getSession(testPlayerId);
          gameState.gold = updatedState.gold;
        } catch {
          break;
        }
      }
      
      // Now try to reroll with insufficient gold
      if (gameState.gold < 2) {
        await expect(gameService.rerollShop(testSocketId)).rejects.toThrow();
      }
    });
  });
});