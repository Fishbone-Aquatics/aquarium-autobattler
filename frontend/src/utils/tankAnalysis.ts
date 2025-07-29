import { GamePiece } from '@aquarium/shared-types';
import { PLANT_BONUSES, SCHOOLING_BONUSES, getPieceBonuses } from './bonusConfig';

export interface ConsumedEffect {
  consumableId: string;
  consumableName: string;
  effect: string;
  appliedAt: number;
  attackBonus?: number;
  healthBonus?: number;
  speedBonus?: number;
}

export interface EnhancedGamePiece extends GamePiece {
  consumedEffects?: ConsumedEffect[];
  originalStats?: {
    attack: number;
    health: number;
    speed: number;
    maxHealth: number;
  };
}

export interface TankAnalysis {
  totalAttack: number;
  baseAttack: number;
  bonusAttack: number;
  totalHealth: number;
  baseHealth: number;
  bonusHealth: number;
  averageSpeed: number;
  baseAverageSpeed: number;
  bonusAverageSpeed: number;
  fishCount: number;
  totalPieces: number;
  enhancedPieces: GamePiece[];
  pieceBreakdown: Array<{
    piece: EnhancedGamePiece;
    originalStats: { attack: number; health: number; speed: number };
    bonuses: { attack: number; health: number; speed: number };
    activeBonuses: Array<{ source: string; effect: string; color: string; type: 'adjacency' | 'consumable' | 'ability' }>;
    consumedItems: ConsumedEffect[];
  }>;
}

const GRID_WIDTH = 8;
const GRID_HEIGHT = 6;

// Helper function to get all cells occupied by a piece
const getPieceOccupiedCells = (piece: GamePiece) => {
  if (!piece.position) return [];
  
  const cells = [];
  for (const offset of piece.shape) {
    cells.push({
      x: piece.position.x + offset.x,
      y: piece.position.y + offset.y
    });
  }
  return cells;
};

// Helper function to check if two pieces are adjacent (any cell of one is adjacent to any cell of the other)
const arePiecesAdjacent = (piece1: GamePiece, piece2: GamePiece) => {
  if (!piece1.position || !piece2.position) return false;
  
  const piece1Cells = getPieceOccupiedCells(piece1);
  const piece2Cells = getPieceOccupiedCells(piece2);
  
  for (const cell1 of piece1Cells) {
    for (const cell2 of piece2Cells) {
      // Check if cells are adjacent (8 directions)
      const dx = Math.abs(cell1.x - cell2.x);
      const dy = Math.abs(cell1.y - cell2.y);
      if ((dx <= 1 && dy <= 1) && !(dx === 0 && dy === 0)) {
        return true;
      }
    }
  }
  return false;
};

// Helper function to calculate adjacency bonuses for a piece
const calculateAdjacencyBonuses = (targetPiece: GamePiece, allPieces: GamePiece[]) => {
  if (!targetPiece.position) return { attack: 0, health: 0, speed: 0, bonuses: [] };

  const bonuses: Array<{ source: string; effect: string; color: string; type: 'adjacency' | 'consumable' | 'ability' }> = [];
  let attackBonus = 0;
  let healthBonus = 0;
  let speedBonus = 0;

  // Find adjacent pieces using shape-aware adjacency
  const adjacentPieces = allPieces.filter(p => 
    p.id !== targetPiece.id && arePiecesAdjacent(targetPiece, p)
  );

  // Adjacency bonuses from adjacent pieces
  adjacentPieces.forEach(adjacentPiece => {
    // Check if piece provides bonuses (plants, consumables, etc)
    const pieceBonus = getPieceBonuses(adjacentPiece);
    
    if (pieceBonus) {
      // Check if this bonus applies to the target piece
      // For now, plants/consumables only affect fish
      if ((adjacentPiece.type === 'plant' || adjacentPiece.type === 'consumable') && targetPiece.type === 'fish') {
        if (pieceBonus.attack) attackBonus += pieceBonus.attack;
        if (pieceBonus.health) healthBonus += pieceBonus.health;
        if (pieceBonus.speed) speedBonus += pieceBonus.speed;
        bonuses.push({ 
          source: adjacentPiece.name, 
          effect: pieceBonus.description, 
          color: adjacentPiece.type === 'plant' ? 'text-green-500' : 'text-orange-500', 
          type: 'adjacency' 
        });
      }
    } else {
      // Fallback to hardcoded values for pieces without bonus fields
      const plantBonus = PLANT_BONUSES[adjacentPiece.name];
      if (plantBonus && targetPiece.type === plantBonus.targetType) {
        if (plantBonus.effect.attack) attackBonus += plantBonus.effect.attack;
        if (plantBonus.effect.health) healthBonus += plantBonus.effect.health;
        if (plantBonus.effect.speed) speedBonus += plantBonus.effect.speed;
        bonuses.push({ 
          source: adjacentPiece.name, 
          effect: plantBonus.effect.description, 
          color: 'text-green-500', 
          type: 'adjacency' 
        });
      }
    }
  });

  // Schooling fish bonuses
  if (targetPiece.tags.includes('schooling')) {
    const adjacentSchoolingCount = adjacentPieces.filter(p => p.tags.includes('schooling')).length;
    
    const schoolingBonus = SCHOOLING_BONUSES[targetPiece.name];
    if (schoolingBonus && adjacentSchoolingCount > 0) {
      const attackGain = adjacentSchoolingCount * schoolingBonus.attackPerSchooling;
      attackBonus += attackGain;
      bonuses.push({ 
        source: 'Schooling', 
        effect: `+${attackGain} ATK`, 
        color: 'text-blue-500', 
        type: 'adjacency' 
      });
    }

    // Double speed if 3+ schooling fish adjacent
    if (adjacentSchoolingCount >= SCHOOLING_BONUSES.schoolFrenzyThreshold) {
      speedBonus += targetPiece.stats.speed; // Double speed = +current speed
      bonuses.push({ 
        source: 'School Frenzy', 
        effect: SCHOOLING_BONUSES.schoolFrenzyEffect, 
        color: 'text-purple-500', 
        type: 'adjacency' 
      });
    }
  }

  // Stack duplicate bonuses from the same source
  const stackedBonuses: Array<{ source: string; effect: string; color: string; type: 'adjacency' | 'consumable' | 'ability' }> = [];
  const bonusMap = new Map<string, { count: number; attackTotal: number; healthTotal: number; speedTotal: number; color: string; type: 'adjacency' | 'consumable' | 'ability' }>();
  
  bonuses.forEach(bonus => {
    const key = bonus.source;
    if (bonusMap.has(key)) {
      const existing = bonusMap.get(key)!;
      existing.count++;
      // Extract numbers from effect string to sum them
      if (bonus.effect.includes('ATK')) {
        const atkMatch = bonus.effect.match(/\+(\d+) ATK/);
        if (atkMatch) existing.attackTotal += parseInt(atkMatch[1]);
      }
      if (bonus.effect.includes('HP')) {
        const hpMatch = bonus.effect.match(/\+(\d+) HP/);
        if (hpMatch) existing.healthTotal += parseInt(hpMatch[1]);
      }
    } else {
      let attackFromBonus = 0, healthFromBonus = 0, speedFromBonus = 0;
      if (bonus.effect.includes('ATK')) {
        const atkMatch = bonus.effect.match(/\+(\d+) ATK/);
        if (atkMatch) attackFromBonus = parseInt(atkMatch[1]);
      }
      if (bonus.effect.includes('HP')) {
        const hpMatch = bonus.effect.match(/\+(\d+) HP/);
        if (hpMatch) healthFromBonus = parseInt(hpMatch[1]);
      }
      if (bonus.effect.includes('Double Speed')) {
        speedFromBonus = targetPiece.stats.speed; // Double speed bonus
      }
      
      bonusMap.set(key, {
        count: 1,
        attackTotal: attackFromBonus,
        healthTotal: healthFromBonus,
        speedTotal: speedFromBonus,
        color: bonus.color,
        type: bonus.type
      });
    }
  });
  
  // Convert map back to array with stacked format
  bonusMap.forEach((data, source) => {
    let effectParts = [];
    if (data.attackTotal > 0) effectParts.push(`+${data.attackTotal} ATK`);
    if (data.healthTotal > 0) effectParts.push(`+${data.healthTotal} HP`);
    if (data.speedTotal > 0) effectParts.push('Double Speed');
    
    const effect = data.count > 1 
      ? `${source} x${data.count} (${effectParts.join(', ')})`
      : `${effectParts.join(', ')}`;
    
    stackedBonuses.push({
      source: data.count > 1 ? `${source} x${data.count}` : source,
      effect,
      color: data.color,
      type: data.type
    });
  });

  return { attack: attackBonus, health: healthBonus, speed: speedBonus, bonuses: stackedBonuses };
};

// Main analysis function
export const analyzeTank = (pieces: GamePiece[]): TankAnalysis => {
  const placedPieces = pieces.filter(piece => piece.position);
  
  let totalAttack = 0;
  let baseAttack = 0;
  let bonusAttack = 0;
  let totalHealth = 0;
  let baseHealth = 0;
  let bonusHealth = 0;
  let totalSpeed = 0;
  let baseSpeed = 0;
  let bonusSpeed = 0;
  
  const pieceBreakdown: TankAnalysis['pieceBreakdown'] = [];
  const combatPieces: GamePiece[] = []; // Only pieces with combat stats for speed average
  
  placedPieces.forEach(piece => {
    const adjacencyBonuses = calculateAdjacencyBonuses(piece, placedPieces);
    
    const originalStats = {
      attack: piece.stats.attack || 0,
      health: piece.stats.health || 0,
      speed: piece.stats.speed || 0
    };
    
    const bonuses = {
      attack: adjacencyBonuses.attack,
      health: adjacencyBonuses.health,
      speed: adjacencyBonuses.speed
    };
    
    
    const finalAttack = originalStats.attack + bonuses.attack;
    const finalHealth = originalStats.health + bonuses.health;
    const finalSpeed = originalStats.speed + bonuses.speed;
    
    // Plants contribute health but not attack to tank totals
    if (piece.type !== 'plant') {
      baseAttack += originalStats.attack;
      bonusAttack += bonuses.attack;
      totalAttack += finalAttack;
    }
    
    // All pieces (including plants) contribute to health totals
    baseHealth += originalStats.health;
    bonusHealth += bonuses.health;
    totalHealth += finalHealth;
    
    // Only include pieces with speed > 0 in speed calculations (excludes plants/equipment)
    if (originalStats.speed > 0) {
      baseSpeed += originalStats.speed;
      bonusSpeed += bonuses.speed;
      totalSpeed += finalSpeed;
      combatPieces.push(piece);
    }
    
    pieceBreakdown.push({
      piece: piece as EnhancedGamePiece,
      originalStats,
      bonuses,
      activeBonuses: adjacencyBonuses.bonuses,
      consumedItems: []
    });
  });
  
  const fishCount = placedPieces.filter(piece => piece.tags.includes('fish')).length;
  const averageSpeed = combatPieces.length > 0 ? totalSpeed / combatPieces.length : 0;
  const baseAverageSpeed = combatPieces.length > 0 ? baseSpeed / combatPieces.length : 0;
  const bonusAverageSpeed = averageSpeed - baseAverageSpeed;
  
  return {
    totalAttack,
    baseAttack,
    bonusAttack,
    totalHealth,
    baseHealth,
    bonusHealth,
    averageSpeed,
    baseAverageSpeed,
    bonusAverageSpeed,
    fishCount,
    totalPieces: placedPieces.length,
    enhancedPieces: placedPieces,
    pieceBreakdown
  };
};