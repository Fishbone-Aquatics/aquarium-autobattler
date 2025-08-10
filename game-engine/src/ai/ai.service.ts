import { Injectable } from '@nestjs/common';
import { GamePiece, Position, Tank } from '@aquarium/shared-types';
import { PIECE_LIBRARY } from '../app/data/pieces';

@Injectable()
export class AIService {
  
  getOpponentPieceForRound(round: number, maxCost: number, currentWaterQuality: number, lossStreak: number): GamePiece | null {
    const pieces = [...PIECE_LIBRARY].filter(piece => piece.cost <= maxCost);
    
    if (pieces.length === 0) return null;
    
    // Water quality considerations - prioritize based on current state
    const isInToxicWater = currentWaterQuality <= 3; // Poison damage range
    const isInGoodWater = currentWaterQuality >= 8; // Damage bonus range
    const needsWaterQualityHelp = isInToxicWater || (lossStreak >= 2 && currentWaterQuality < 7);
    
    // If in toxic water or losing and need help, prioritize water quality improvers
    if (needsWaterQualityHelp) {
      const waterQualityPieces = pieces.filter(piece => 
        piece.type === 'plant' || (piece.type === 'equipment' && piece.tags.includes('filter'))
      );
      if (waterQualityPieces.length > 0) {
        // 80% chance to buy water quality pieces when water quality is bad
        if (Math.random() < 0.8) {
          console.log(`🤖 💧 Water quality ${currentWaterQuality} is bad, prioritizing plants/filters`);
          return waterQualityPieces[Math.floor(Math.random() * waterQualityPieces.length)];
        }
      }
    }
    
    // If in good water, prioritize fish to maximize damage bonus
    if (isInGoodWater) {
      const fish = pieces.filter(piece => piece.type === 'fish');
      if (fish.length > 0 && Math.random() < 0.6) {
        console.log(`🤖 💧 Water quality ${currentWaterQuality} is good, prioritizing fish`);
        return fish[Math.floor(Math.random() * fish.length)];
      }
    }
    
    // Normal piece selection logic with cost-based preferences
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

  calculateOpponentSpendingBudget(
    currentGold: number, 
    round: number, 
    lossStreak: number, 
    winStreak: number
  ): number {
    // Game phase definitions
    const isEarlyGame = round <= 5;
    const isMidGame = round > 5 && round <= 10;
    const isLateGame = round > 10;
    
    // Interest breakpoints (10g, 20g, 30g, 40g, 50g)
    const nextInterestBreakpoint = Math.ceil(currentGold / 10) * 10;
    const goldToNextBreakpoint = nextInterestBreakpoint - currentGold;
    
    let spendingBudget = currentGold;
    
    // Early game: Aggressive spending, must build board strength first
    if (isEarlyGame) {
      if (round <= 3) {
        // Rounds 1-3: Spend almost everything to build board
        spendingBudget = Math.max(0, currentGold - 1); 
      } else {
        // Rounds 4-5: Start considering interest if doing well
        if (lossStreak >= 2) {
          spendingBudget = currentGold; // Spend everything when losing
        } else if (currentGold >= 20 && winStreak >= 2) {
          spendingBudget = currentGold - 10; // Eco only when winning and rich
        } else {
          spendingBudget = Math.max(0, currentGold - 2); // Keep minimal buffer
        }
      }
    }
    
    // Mid game: More aggressive, but still respect interest
    else if (isMidGame) {
      if (lossStreak >= 3) {
        spendingBudget = currentGold; // All-in when losing badly
      } else if (winStreak >= 3) {
        spendingBudget = Math.max(0, currentGold - 20); // Eco when winning
      } else {
        spendingBudget = Math.max(0, currentGold - 10); // Standard play
      }
    }
    
    // Late game: Spend for power, interest less important
    else if (isLateGame) {
      if (lossStreak >= 2) {
        spendingBudget = currentGold; // Must spend to survive
      } else {
        spendingBudget = Math.max(0, currentGold - 5); // Keep small buffer
      }
    }
    
    console.log(`🤖 Round ${round}: Budget ${spendingBudget}g out of ${currentGold}g (L${lossStreak} W${winStreak})`);
    return spendingBudget;
  }

  shouldReplaceWeakerPiece(
    opponentTank: Tank,
    newPiece: GamePiece,
    currentRound: number,
    findValidPosition: (tank: Tank, piece: GamePiece) => Position | null,
    placePieceOnGrid: (tank: Tank, piece: GamePiece) => void,
    removePieceFromGrid: (tank: Tank, piece: GamePiece) => void
  ): { name: string, cost: number } | null {
    // Only consider replacing after having a reasonable board
    if (opponentTank.pieces.length < 5) {
      return null;
    }
    
    // Calculate power rating for pieces  
    const getPiecePower = (piece: GamePiece): number => {
      const attackWeight = piece.type === 'fish' ? 1.2 : 0.5;
      const healthWeight = 1.0;
      const speedWeight = piece.type === 'fish' ? 0.3 : 0.1;
      const abilityWeight = (piece.abilities?.length || 0) * 2;
      const waterQualityWeight = piece.type === 'plant' ? 5 : (piece.type === 'equipment' ? 3 : 0);
      
      return (piece.stats.attack * attackWeight) + 
             (piece.stats.health * healthWeight) + 
             (piece.stats.speed * speedWeight) +
             abilityWeight +
             waterQualityWeight;
    };
    
    const newPiecePower = getPiecePower(newPiece);
    
    // In later rounds, be more aggressive about upgrading
    const powerThreshold = currentRound > 10 ? 1.2 : 1.5;
    
    // Don't replace equipment unless the new piece is significantly better
    if (newPiece.type !== 'equipment') {
      const equipment = opponentTank.pieces.filter(p => p.type === 'equipment');
      if (equipment.length > 0 && opponentTank.pieces.length <= 8) {
        return null; // Keep equipment when not at max capacity
      }
    }
    
    // Find pieces that are weaker than the new piece and worth replacing
    const replaceablePieces = opponentTank.pieces
      .map(piece => ({
        piece,
        power: getPiecePower(piece),
      }))
      .filter(item => {
        // Must be significantly weaker to justify replacement
        return item.power * powerThreshold < newPiecePower;
      })
      .sort((a, b) => a.power - b.power); // Weakest first
    
    if (replaceablePieces.length === 0) {
      return null;
    }
    
    // Try to replace the weakest piece
    const toReplace = replaceablePieces[0];
    
    // Remove the old piece from tank and grid
    const pieceIndex = opponentTank.pieces.findIndex(p => p.id === toReplace.piece.id);
    if (pieceIndex !== -1) {
      opponentTank.pieces.splice(pieceIndex, 1);
      removePieceFromGrid(opponentTank, toReplace.piece);
      
      // Try to place the new piece in the freed space or anywhere else
      const position = findValidPosition(opponentTank, newPiece);
      if (position) {
        const placedPiece = {
          ...newPiece,
          position,
          id: `${newPiece.name}-${Date.now()}-${Math.random()}`
        };
        
        console.log(`🤖 🔄 Replacing ${toReplace.piece.name} with ${placedPiece.name} at (${position.x},${position.y})`);
        console.log(`🤖 🔄 Grid before replacement:`, opponentTank.grid[position.y]?.slice(0, 3));
        placePieceOnGrid(opponentTank, placedPiece);
        console.log(`🤖 🔄 Grid after replacement:`, opponentTank.grid[position.y]?.slice(0, 3));
        opponentTank.pieces.push(placedPiece);
        
        return {
          name: toReplace.piece.name,
          cost: toReplace.piece.cost
        };
      } else {
        // Couldn't place new piece, put old one back
        placePieceOnGrid(opponentTank, toReplace.piece);
        opponentTank.pieces.push(toReplace.piece);
      }
    }
    
    return null;
  }


  updateOpponentTank(
    gameState: any,
    calculateWaterQuality: (tank: Tank) => number,
    findValidPosition: (tank: Tank, piece: GamePiece) => Position | null,
    placePieceOnGrid: (tank: Tank, piece: GamePiece) => void,
    removePieceFromGrid: (tank: Tank, piece: GamePiece) => void,
    findOptimalPosition: (tank: Tank, piece: GamePiece, targetType: string) => Position | null
  ): { remainingGold: number } {
    const round = gameState.round;
    let opponentGold = gameState.opponentGold;
    const opponentTank = gameState.opponentTank;
    const lossStreak = gameState.opponentLossStreak;
    const winStreak = gameState.opponentWinStreak;
    
    console.log(`🤖 Updating opponent tank for round ${round} with ${opponentGold} gold (L${lossStreak} W${winStreak})`);
    console.log(`🤖 Current opponent pieces: ${opponentTank.pieces.length}`);
    
    // Smart gold spending decisions
    let spendingBudget = this.calculateOpponentSpendingBudget(opponentGold, round, lossStreak, winStreak);
    console.log(`🤖 Spending budget: ${spendingBudget}g out of ${opponentGold}g available`);
    
    // Crisis mode: if losing badly with lots of gold, spend aggressively
    const isInCrisis = lossStreak >= 3 && spendingBudget > 20;
    const isLateGameDesperate = round >= 10 && lossStreak >= 2 && spendingBudget > 15;
    
    console.log(`🤖 Crisis mode: ${isInCrisis}, Late game desperate: ${isLateGameDesperate}`);
    
    let piecesBought = 0;
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 25; // More attempts when desperate
    
    // Spend until budget exhausted or can't find valid pieces/positions
    while (spendingBudget > 0 && consecutiveFailures < maxConsecutiveFailures) {
      const piece = this.getOpponentPieceForRound(round, spendingBudget, opponentTank.waterQuality, lossStreak);
      
      if (!piece || piece.cost > spendingBudget) {
        consecutiveFailures++;
        continue;
      }
      
      // Find optimal position for the new piece
      let position: Position | null;
      if (piece.type === 'consumable') {
        // Consumables go directly on fish if available
        const targetFish = opponentTank.pieces.find(p => p.type === 'fish');
        position = targetFish ? targetFish.position : findValidPosition(opponentTank, piece);
      } else if (piece.type === 'plant' || piece.type === 'equipment') {
        // Place support pieces optimally near fish
        position = findOptimalPosition(opponentTank, piece, 'fish');
      } else {
        // Place fish normally
        position = findValidPosition(opponentTank, piece);
      }
      
      if (position) {
        const newPiece: GamePiece = {
          ...piece,
          position: position,
          id: `${piece.name}-${Date.now()}-${Math.random()}`
        };
        
        console.log(`🤖 🔧 Placing ${newPiece.name} at (${position.x},${position.y}) - Grid before:`, 
          opponentTank.grid[position.y]?.slice(0, 3));
        placePieceOnGrid(opponentTank, newPiece);
        console.log(`🤖 🔧 Grid after placing ${newPiece.name}:`, 
          opponentTank.grid[position.y]?.slice(0, 3));
        
        // Add to pieces array
        opponentTank.pieces.push(newPiece);
        opponentGold -= piece.cost;
        spendingBudget -= piece.cost;
        piecesBought++;
        consecutiveFailures = 0;
        
        console.log(`🤖 Bought ${piece.name} for ${piece.cost}g (${spendingBudget}g budget left)`);
      } else {
        // If we can't place the piece, try replacing a weaker one
        const replaced = this.shouldReplaceWeakerPiece(
          opponentTank,
          piece,
          round,
          findValidPosition,
          placePieceOnGrid,
          removePieceFromGrid
        );
        
        if (replaced) {
          opponentGold -= piece.cost;
          spendingBudget -= piece.cost;
          piecesBought++;
          consecutiveFailures = 0;
          console.log(`🤖 Replaced ${replaced.name} (${replaced.cost}g) with ${piece.name} (${piece.cost}g)`);
        } else {
          consecutiveFailures++;
        }
      }
    }
    
    console.log(`🤖 Opponent tank updated: ${opponentTank.pieces.length} total pieces, ${opponentGold} gold remaining`);
    
    // Recalculate water quality after updating opponent tank
    gameState.opponentTank.waterQuality = calculateWaterQuality(gameState.opponentTank);
    
    return { remainingGold: opponentGold };
  }
}