'use client';

import React, { useState, useEffect } from 'react';
import { GamePiece, Position, BattlePiece } from '@aquarium/shared-types';
import { PLANT_BONUSES, SCHOOLING_BONUSES, getPieceBonuses } from '../../utils/bonusConfig';

interface TankGridProps {
  grid: (string | null)[][];
  pieces: GamePiece[];
  waterQuality: number;
  onPlacePiece?: (piece: GamePiece, position: Position) => void;
  onMovePiece?: (pieceId: string, position: Position) => void;
  selectedPiece?: GamePiece | null;
  interactive?: boolean;
  externalDraggedPiece?: GamePiece | null;
  highlightedPieceId?: string | null;
  onPieceHover?: (piece: GamePiece | null) => void;
  getTypeColors?: (type: string) => { grid: string; border: string; tag: string; tagActive: string };
  gamePhase?: string;
  battlePieces?: BattlePiece[];
}

export function TankGrid({
  grid,
  pieces,
  waterQuality,
  onPlacePiece,
  onMovePiece,
  selectedPiece,
  interactive = true,
  externalDraggedPiece,
  highlightedPieceId,
  onPieceHover,
  getTypeColors,
  gamePhase,
  battlePieces,
}: TankGridProps) {
  const [draggedPiece, setDraggedPiece] = useState<GamePiece | null>(null);
  const [validDropPositions, setValidDropPositions] = useState<Position[]>([]);
  const [hoverPosition, setHoverPosition] = useState<Position | null>(null);

  const getPieceById = (id: string) => pieces.find(p => p.id === id);

  const isValidPosition = (piece: GamePiece, position: Position): boolean => {
    // Check if all tiles of the piece would be within bounds
    for (const offset of piece.shape) {
      const x = position.x + offset.x;
      const y = position.y + offset.y;
      
      if (x < 0 || x >= 8 || y < 0 || y >= 6) {
        return false;
      }
      
      // Check if position is occupied by another piece
      if (grid[y][x] && grid[y][x] !== piece.id) {
        return false;
      }
    }
    
    return true;
  };

  const calculateValidPositions = (piece: GamePiece) => {
    const validPositions: Position[] = [];
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 8; x++) {
        if (isValidPosition(piece, { x, y })) {
          validPositions.push({ x, y });
        }
      }
    }
    return validPositions;
  };

  // Calculate valid positions when external dragged piece changes
  useEffect(() => {
    if (externalDraggedPiece && !draggedPiece) {
      setValidDropPositions(calculateValidPositions(externalDraggedPiece));
    } else if (!externalDraggedPiece && !draggedPiece) {
      setValidDropPositions([]);
    }
  }, [externalDraggedPiece, draggedPiece]);

  const handleDragStart = (piece: GamePiece) => {
    if (!interactive) return;
    
    setDraggedPiece(piece);
    setValidDropPositions(calculateValidPositions(piece));
  };

  const handleDragEnd = () => {
    setDraggedPiece(null);
    setValidDropPositions([]);
    setHoverPosition(null);
  };

  const handleCellHover = (position: Position) => {
    const activeDraggedPiece = externalDraggedPiece || draggedPiece;
    if (activeDraggedPiece) {
      if (isValidPosition(activeDraggedPiece, position)) {
        setHoverPosition(position);
      } else {
        setHoverPosition(null);
      }
    }
  };

  const handleCellLeave = () => {
    // Only clear hover position if we're not dragging
    if (!externalDraggedPiece && !draggedPiece) {
      setHoverPosition(null);
    }
  };

  const handleDrop = (e: React.DragEvent, position: Position) => {
    e.preventDefault();
    if (!interactive) return;
    
    // First try to get piece from drag data (for external drops)
    let draggedPieceFromData: GamePiece | null = null;
    try {
      const dragData = e.dataTransfer.getData('application/json');
      if (dragData) {
        draggedPieceFromData = JSON.parse(dragData);
      }
    } catch (error) {
      console.warn('Failed to parse drag data:', error);
    }
    
    // Use dragged piece from data, external state, or internal state
    const activeDraggedPiece = draggedPieceFromData || externalDraggedPiece || draggedPiece;
    if (!activeDraggedPiece) return;
    
    if (isValidPosition(activeDraggedPiece, position)) {
      if (activeDraggedPiece.position) {
        // Moving existing piece within tank
        onMovePiece?.(activeDraggedPiece.id, position);
      } else {
        // Placing new piece from shop or inventory
        onPlacePiece?.(activeDraggedPiece, position);
      }
    }
    
    handleDragEnd();
  };

  const handleCellClick = (position: Position) => {
    if (!interactive || !selectedPiece || !onPlacePiece) return;
    
    if (isValidPosition(selectedPiece, position)) {
      onPlacePiece(selectedPiece, position);
    }
  };

  const isValidDropCell = (x: number, y: number) => {
    // Calculate valid positions for external dragged piece as well
    const activeDraggedPiece = externalDraggedPiece || draggedPiece;
    if (externalDraggedPiece && !draggedPiece) {
      // For external pieces, calculate valid positions on the fly
      return isValidPosition(externalDraggedPiece, { x, y });
    }
    return validDropPositions.some(pos => pos.x === x && pos.y === y);
  };

  const isHoverPreviewCell = (x: number, y: number) => {
    if (!hoverPosition) {
      return false;
    }
    
    const activeDraggedPiece = externalDraggedPiece || draggedPiece;
    if (!activeDraggedPiece) {
      return false;
    }
    
    // Check each shape offset to see if this cell should be highlighted
    for (const offset of activeDraggedPiece.shape) {
      const expectedX = hoverPosition.x + offset.x;
      const expectedY = hoverPosition.y + offset.y;
      
      if (expectedX === x && expectedY === y) {
        return true;
      }
    }
    
    return false;
  };

  // Calculate water quality color gradient
  const waterQualityPercent = (waterQuality / 10) * 100;
  const waterQualityColor = waterQuality >= 7 ? 'from-green-200 to-green-100' 
    : waterQuality >= 4 ? 'from-yellow-200 to-yellow-100' 
    : 'from-red-200 to-red-100';

  return (
    <div className={`relative p-4 rounded-lg bg-gradient-to-b ${waterQualityColor}`}>
      <div className="absolute top-2 left-2 text-xs text-gray-700">
        Water Quality: {waterQuality}/10
      </div>
      
      <div className="grid grid-cols-8 grid-rows-6 gap-1 aspect-[8/6] mt-6">
        {Array.from({ length: 6 }).map((_, y) => (
          Array.from({ length: 8 }).map((_, x) => {
            const pieceId = grid[y][x];
            const piece = pieceId ? getPieceById(pieceId) : null;
            const isValid = isValidDropCell(x, y);
            const isHoverPreview = isHoverPreviewCell(x, y);
            
            return (
              <div
                key={`${x}-${y}`}
                className={`
                  relative border border-gray-400 bg-white aspect-square transition-all
                  ${isHoverPreview ? 'bg-red-500 border-red-700 border-4' : ''}
                  ${(draggedPiece || externalDraggedPiece) && !isValid && !isHoverPreview ? 'opacity-50' : ''}
                `}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, { x, y })}
                onClick={() => handleCellClick({ x, y })}
                onMouseEnter={() => {
                  if (!externalDraggedPiece && !draggedPiece) {
                    handleCellHover({ x, y });
                  }
                }}
                onMouseLeave={() => {
                  handleCellLeave();
                }}
                onDragEnter={() => {
                  handleCellHover({ x, y });
                }}
              >
                {piece && piece.position && (
                  piece.shape.some(offset => 
                    piece.position!.x + offset.x === x && 
                    piece.position!.y + offset.y === y
                  ) && (
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${getTypeColors ? getTypeColors(piece.type).grid : 'from-blue-400 to-blue-600'} rounded border-2 ${getTypeColors ? getTypeColors(piece.type).border : 'border-blue-700'} flex items-center justify-center text-white text-xs font-bold transition-all duration-300 ${
                        highlightedPieceId === piece.id 
                          ? 'ring-4 ring-yellow-400 ring-opacity-75 scale-110 shadow-2xl z-10' 
                          : ''
                      } ${
                        (piece as any).isDead || (gamePhase === 'battle' && battlePieces && battlePieces.find(bp => bp.id === piece.id)?.currentHealth === 0)
                          ? 'opacity-50 grayscale saturate-0' 
                          : 'cursor-pointer hover:scale-105'
                      }`}
                      draggable={interactive}
                      onDragStart={() => handleDragStart(piece)}
                      onDragEnd={handleDragEnd}
                      onMouseEnter={() => onPieceHover?.(piece)}
                      onMouseLeave={() => onPieceHover?.(null)}
                    >
                      {/* Only show text on the origin cell */}
                      {piece.position!.x === x && piece.position!.y === y && (
                        <div className="text-center pointer-events-none">
                          {(piece as any).isDead || (gamePhase === 'battle' && battlePieces && battlePieces.find(bp => bp.id === piece.id)?.currentHealth === 0) ? (
                            <div className="text-center">
                              <div className="text-xs font-bold text-red-300">{piece.name.split(' ')[0]}</div>
                              <div className="text-red-400 text-lg">💀</div>
                              <div className="text-[8px] text-red-300">KO</div>
                            </div>
                          ) : (
                            (() => {
                              // Calculate buffed stats for display
                              const placedPieces = pieces.filter(p => p.position);
                              
                              // Simple adjacency calculation for display (replicating the logic from GameView)
                              let attackBonus = 0;
                              let healthBonus = 0;
                              
                              if (piece.position) {
                                // Helper function for multi-cell adjacency (matching GameView.tsx)
                                const getAdjacentPositionsForPiece = (targetPiece: GamePiece): Position[] => {
                                  if (!targetPiece.position) return [];
                                  
                                  // Get all cells occupied by this piece
                                  const occupiedCells = targetPiece.shape.map(offset => ({
                                    x: targetPiece.position!.x + offset.x,
                                    y: targetPiece.position!.y + offset.y
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
                                };

                                // Get all adjacent positions for this multi-cell piece
                                const adjacentPositions = getAdjacentPositionsForPiece(piece);

                                // Find adjacent pieces - check if any of their cells are adjacent to any of our cells
                                const adjacentPieces = placedPieces.filter(p => {
                                  if (!p.position || p.id === piece.id) return false;
                                  
                                  // Check if any cell of piece p is adjacent to our piece
                                  return p.shape.some(offset => {
                                    const cellPos = { x: p.position!.x + offset.x, y: p.position!.y + offset.y };
                                    return adjacentPositions.some(adjPos => adjPos.x === cellPos.x && adjPos.y === cellPos.y);
                                  });
                                });

                                // Adjacency bonuses from plants and consumables
                                adjacentPieces.forEach(adjacentPiece => {
                                  const pieceBonus = getPieceBonuses(adjacentPiece);
                                  if (pieceBonus && (adjacentPiece.type === 'plant' || adjacentPiece.type === 'consumable') && piece.type === 'fish') {
                                    let bonusAttack = pieceBonus.attack || 0;
                                    let bonusHealth = pieceBonus.health || 0;
                                    
                                    // Check if there's a filter adjacent to the plant to boost its effects by 20%
                                    if (adjacentPiece.type === 'plant') {
                                      const filterAdjacent = adjacentPieces.some(p => p.type === 'equipment' && p.tags.includes('filter'));
                                      if (filterAdjacent) {
                                        const originalBonus = Math.max(bonusAttack, bonusHealth);
                                        const boost = Math.ceil(originalBonus * 0.2);
                                        bonusAttack = bonusAttack > 0 ? bonusAttack + boost : bonusAttack;
                                        bonusHealth = bonusHealth > 0 ? bonusHealth + boost : bonusHealth;
                                      }
                                    }
                                    
                                    attackBonus += bonusAttack;
                                    healthBonus += bonusHealth;
                                  }
                                });

                                // Schooling fish bonuses
                                if (piece.tags.includes('schooling')) {
                                  const adjacentSchoolingCount = adjacentPieces.filter(p => p.tags.includes('schooling')).length;
                                  const schoolingBonus = SCHOOLING_BONUSES[piece.name as keyof typeof SCHOOLING_BONUSES];
                                  
                                  if (schoolingBonus && typeof schoolingBonus === 'object' && 'attackPerSchooling' in schoolingBonus && adjacentSchoolingCount > 0) {
                                    attackBonus += adjacentSchoolingCount * schoolingBonus.attackPerSchooling;
                                  }
                                }
                              }
                              
                              const finalAttack = piece.stats.attack + attackBonus;
                              const finalHealth = piece.stats.health + healthBonus;
                              
                              // During battle phase, show current values from battle pieces
                              let displayAttack = finalAttack;
                              let displayHealth = finalHealth;
                              if (gamePhase === 'battle' && battlePieces) {
                                const battlePiece = battlePieces.find(bp => bp.id === piece.id);
                                if (battlePiece) {
                                  if (battlePiece.currentHealth !== undefined) {
                                    displayHealth = battlePiece.currentHealth; // Current HP from battle state
                                  }
                                  if (battlePiece.stats.attack !== undefined) {
                                    displayAttack = battlePiece.stats.attack; // Current buffed attack from battle state
                                  }
                                }
                              }
                              
                              return (
                                <div className="text-center">
                                  <div className="text-xs font-bold">{piece.name.split(' ')[0]}</div>
                                  <div className="text-[10px]">
                                    {displayAttack}/{displayHealth}
                                  </div>
                                </div>
                              );
                            })()
                          )}
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            );
          })
        ))}
      </div>
    </div>
  );
}