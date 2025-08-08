// Centralized configuration for all adjacency bonuses
// This ensures consistency across all components

import { GamePiece } from '@aquarium/shared-types';

export interface BonusEffect {
  attack?: number;
  health?: number;
  speed?: number;
  description: string;
}

export interface PlantBonus {
  targetType: 'fish';
  effect: BonusEffect;
}

// Helper to get bonus values directly from piece data
export function getPieceBonuses(piece: GamePiece): BonusEffect | null {
  if (piece.attackBonus !== undefined || piece.healthBonus !== undefined || piece.speedBonus !== undefined) {
    const parts = [];
    if (piece.attackBonus && piece.attackBonus > 0) parts.push(`+${piece.attackBonus} ATK`);
    if (piece.healthBonus && piece.healthBonus > 0) parts.push(`+${piece.healthBonus} HP`);
    if (piece.speedBonus && piece.speedBonus > 0) parts.push(`+${piece.speedBonus} SPD`);
    
    return {
      attack: piece.attackBonus || 0,
      health: piece.healthBonus || 0,
      speed: piece.speedBonus || 0,
      description: parts.join(', ')
    };
  }
  return null;
}

// Fallback for pieces without bonus fields (will be removed once all pieces are updated)
export const PLANT_BONUSES: Record<string, PlantBonus> = {
  'Java Fern': {
    targetType: 'fish',
    effect: {
      attack: 1,
      health: 1,
      description: '+1 ATK, +1 HP'
    }
  },
  'Anubias': {
    targetType: 'fish',
    effect: {
      attack: 0,
      health: 2,
      description: '+2 HP'
    }
  }
};

export const SCHOOLING_BONUSES = {
  'Neon Tetra': {
    attackPerSchooling: 1,
    description: '+1 ATK per adjacent Schooling fish'
  },
  'Cardinal Tetra': {
    attackPerSchooling: 2,
    description: '+2 ATK per adjacent Schooling fish'
  },
  schoolFrenzyThreshold: 3,
  schoolFrenzyEffect: 'Double Speed'
};

// Helper function to get plant bonus for a specific plant
export function getPlantBonus(plantName: string): PlantBonus | null {
  return PLANT_BONUSES[plantName] || null;
}

// Helper function to format bonus description
export function formatBonusDescription(source: string, count = 1): string {
  const plantBonus = getPlantBonus(source);
  if (plantBonus && count > 1) {
    const effect = plantBonus.effect;
    const parts = [];
    if (effect.attack && effect.attack > 0) parts.push(`+${effect.attack * count} ATK`);
    if (effect.health && effect.health > 0) parts.push(`+${effect.health * count} HP`);
    return `${source} x${count} (${parts.join(', ')})`;
  }
  return source;
}