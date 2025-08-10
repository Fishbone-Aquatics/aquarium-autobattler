import { Injectable } from '@nestjs/common';
import { GamePiece, Position, Tank } from '@aquarium/shared-types';
import { PIECE_LIBRARY } from '../app/data/pieces';

@Injectable()
export class TankService {

  /**
   * Validate if a piece can be placed at a specific position in the tank
   */
  isValidPosition(tank: Tank, piece: GamePiece, position: Position): boolean {
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

  /**
   * Validate position for a new piece (used for opponent AI placement)
   */
  isValidPositionForNewPiece(tank: Tank, piece: GamePiece, position: Position): boolean {
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

  /**
   * Validate position against a grid (utility method)
   */
  isValidPositionForGrid(grid: (string | null)[][], piece: GamePiece, position: Position): boolean {
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

  /**
   * Remove a piece from the tank grid
   */
  removePieceFromGrid(tank: Tank, piece: GamePiece): void {
    if (!piece.position) return;
    
    for (const offset of piece.shape) {
      const x = piece.position.x + offset.x;
      const y = piece.position.y + offset.y;
      
      if (x >= 0 && x < 8 && y >= 0 && y < 6) {
        tank.grid[y][x] = null;
      }
    }
  }

  /**
   * Place a piece on the tank grid
   */
  placePieceOnGrid(tank: Tank, piece: GamePiece): void {
    if (!piece.position) return;
    
    for (const offset of piece.shape) {
      const x = piece.position.x + offset.x;
      const y = piece.position.y + offset.y;
      
      if (x >= 0 && x < 8 && y >= 0 && y < 6) {
        tank.grid[y][x] = piece.id;
      }
    }
  }

  /**
   * Calculate water quality based on pieces in the tank
   */
  calculateWaterQuality(tank: Tank): number {
    // Start with the tank's original baseline quality (never changes)
    let quality = tank.baseWaterQuality;
    
    // Count placed pieces and calculate the total effect
    let totalEffect = 0;
    
    for (const piece of tank.pieces) {
      if (!piece.position) continue; // Only count placed pieces
      
      if (piece.type === 'fish') {
        totalEffect -= 1; // Fish decrease quality
      } else if (piece.type === 'plant') {
        totalEffect += 1; // Plants increase quality
      } else if (piece.type === 'equipment') {
        // Most equipment is neutral, but check for special items
        if (piece.name === 'Sponge Filter' || piece.tags?.includes('filter')) {
          totalEffect += 1; // Filters improve quality
        }
      }
    }
    
    // Apply the effect to the starting quality
    quality += totalEffect;
    
    // Clamp quality between 1-10
    return Math.max(1, Math.min(10, quality));
  }

  /**
   * Calculate piece stats including adjacency bonuses
   */
  calculatePieceStats(piece: GamePiece, allPieces: GamePiece[]): { attack: number; health: number; speed: number } {
    if (!piece.position) {
      return { attack: piece.stats.attack, health: piece.stats.health, speed: piece.stats.speed };
    }

    let attackBonus = 0;
    let healthBonus = 0;
    let speedBonus = 0;

    // Find adjacent pieces using the proper adjacency check
    const adjacentPieces = allPieces.filter(p => this.areTwoPiecesAdjacent(piece, p));

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

  /**
   * Process consumables and apply their permanent effects
   */
  processConsumables(tank: Tank): void {
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

  /**
   * Respawn dead pieces (fish and plants, but not consumables)
   */
  respawnPieces(tank: Tank): void {
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

  /**
   * Update a piece's position in the tank (main piece placement logic)
   */
  updateTankPiece(tank: Tank, pieceId: string, position: Position, action: 'place' | 'move' | 'remove'): void {
    const piece = tank.pieces.find(p => p.id === pieceId);
    if (!piece) {
      throw new Error('Piece not found');
    }

    if (action === 'remove') {
      this.removePieceFromGrid(tank, piece);
      piece.position = undefined;
    } else {
      // For place/move actions, validate position first
      if (!this.isValidPosition(tank, piece, position)) {
        throw new Error('Invalid position for piece placement');
      }

      // Remove from current position if it exists (for move operations)
      if (piece.position) {
        this.removePieceFromGrid(tank, piece);
      }

      // Set new position and place on grid
      piece.position = position;
      this.placePieceOnGrid(tank, piece);
    }

    // Update water quality after any tank change
    tank.waterQuality = this.calculateWaterQuality(tank);
  }

  /**
   * Find optimal position for a consumable to maximize adjacent fish
   */
  findOptimalConsumablePosition(tank: Tank, consumable: GamePiece): Position | null {
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

  /**
   * Count adjacent fish for a consumable at a given position
   */
  countAdjacentFish(tank: Tank, consumable: GamePiece, position: Position): number {
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

  /**
   * Find valid position for opponent pieces (used by AI)
   */
  findValidPositionForOpponent(tank: Tank, piece: GamePiece): Position | null {
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 8; x++) {
        const position = { x, y };
        if (this.isValidPositionForNewPiece(tank, piece, position)) {
          return position;
        }
      }
    }
    return null;
  }

  /**
   * Get all adjacent positions for a piece
   */
  getAdjacentPositionsForPiece(piece: GamePiece): Position[] {
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

  /**
   * Check if two pieces are adjacent (accounting for multi-cell shapes)
   */
  private areTwoPiecesAdjacent(piece1: GamePiece, piece2: GamePiece): boolean {
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
}