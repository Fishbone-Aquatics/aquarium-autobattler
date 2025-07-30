'use client';

import React, { useState, useEffect } from 'react';
import { useGame } from '../../contexts/GameContext';
import { Header } from '../ui/Header';
import { Footer } from '../ui/Footer';
import { Shop } from './Shop';
import { TankGrid } from './TankGrid';
import { TankSummary } from './TankSummary';
import { Loader2 } from 'lucide-react';
import { GamePiece, Position } from '@aquarium/shared-types';
import { analyzeTank } from '../../utils/tankAnalysis';
import { PLANT_BONUSES, SCHOOLING_BONUSES, getPieceBonuses } from '../../utils/bonusConfig';

// Type-based color mapping
const getTypeColors = (type: string) => {
  switch (type) {
    case 'plant':
      return {
        grid: 'from-green-400 to-green-600',
        border: 'border-green-700',
        tag: 'bg-green-600 text-white',
        tagActive: 'bg-green-400 text-black'
      };
    case 'consumable':
      return {
        grid: 'from-orange-400 to-orange-600',
        border: 'border-orange-700',
        tag: 'bg-orange-600 text-white',
        tagActive: 'bg-orange-400 text-black'
      };
    case 'equipment':
      return {
        grid: 'from-gray-400 to-gray-600',
        border: 'border-gray-700',
        tag: 'bg-gray-600 text-white',
        tagActive: 'bg-gray-400 text-black'
      };
    case 'fish':
    default:
      return {
        grid: 'from-blue-400 to-blue-600',
        border: 'border-blue-700',
        tag: 'bg-blue-600 text-white',
        tagActive: 'bg-blue-400 text-black'
      };
  }
};

export function GameView() {
  const { gameState, connected, purchasePiece, placePiece, movePiece, rerollShop, toggleShopLock, confirmPlacement } = useGame();
  const [draggedPiece, setDraggedPiece] = useState<GamePiece | null>(null);
  const [hoveredPiece, setHoveredPiece] = useState<GamePiece | null>(null);
  const [hoveredGridPiece, setHoveredGridPiece] = useState<GamePiece | null>(null);
  const [highlightedPieceId, setHighlightedPieceId] = useState<string | null>(null);
  const [synergyBonuses, setSynergyBonuses] = useState<string[]>([]);
  const [pendingPlacement, setPendingPlacement] = useState<{piece: GamePiece, position: Position} | null>(null);
  const [mousePosition, setMousePosition] = useState<{x: number, y: number}>({x: 0, y: 0});

  const handleDragStart = (piece: GamePiece) => {
    console.log('🚀 DRAG START:', piece.name, 'with shape:', piece.shape);
    setDraggedPiece(piece);
    // Hide tooltip when dragging to prevent covering grid
    setHoveredPiece(null);
    setHighlightedPieceId(null);
  };

  const handleDragEnd = () => {
    console.log('🛑 DRAG END');
    setDraggedPiece(null);
    // Clear pending placement if drag was cancelled
    if (pendingPlacement) {
      setTimeout(() => {
        // Only clear if it hasn't been resolved yet
        setPendingPlacement(prev => prev?.piece.id === pendingPlacement.piece.id ? null : prev);
      }, 500);
    }
  };

  const handleHover = (piece: GamePiece | null) => {
    setHoveredPiece(piece);
  };

  const handleTankPieceHover = (piece: GamePiece | null) => {
    setHoveredPiece(piece);
    // If the piece is placed on the grid, highlight it
    if (piece && piece.position) {
      setHighlightedPieceId(piece.id);
    } else {
      setHighlightedPieceId(null);
    }
  };

  const calculateAdjacencyBonuses = (targetPiece: GamePiece, allPieces: GamePiece[]) => {
    if (!targetPiece.position) return { attack: 0, health: 0, speed: 0, bonuses: [] };

    const bonuses: string[] = [];
    let attackBonus = 0;
    let healthBonus = 0;
    let speedBonus = 0;

    // Get adjacent positions (8 directions)
    const adjacentPositions = [
      { x: targetPiece.position.x - 1, y: targetPiece.position.y - 1 },
      { x: targetPiece.position.x, y: targetPiece.position.y - 1 },
      { x: targetPiece.position.x + 1, y: targetPiece.position.y - 1 },
      { x: targetPiece.position.x - 1, y: targetPiece.position.y },
      { x: targetPiece.position.x + 1, y: targetPiece.position.y },
      { x: targetPiece.position.x - 1, y: targetPiece.position.y + 1 },
      { x: targetPiece.position.x, y: targetPiece.position.y + 1 },
      { x: targetPiece.position.x + 1, y: targetPiece.position.y + 1 },
    ];

    // Find adjacent pieces
    const adjacentPieces = allPieces.filter(p => 
      p.position && adjacentPositions.some(pos => 
        p.position!.x === pos.x && p.position!.y === pos.y
      )
    );

    // Adjacency bonuses
    adjacentPieces.forEach(adjacentPiece => {
      const pieceBonus = getPieceBonuses(adjacentPiece);
      
      if (pieceBonus && (adjacentPiece.type === 'plant' || adjacentPiece.type === 'consumable') && targetPiece.type === 'fish') {
        if (pieceBonus.attack) attackBonus += pieceBonus.attack;
        if (pieceBonus.health) healthBonus += pieceBonus.health;
        if (pieceBonus.speed) speedBonus += pieceBonus.speed;
        bonuses.push(`${adjacentPiece.name} (${pieceBonus.description})`);
      }
    });

    // Schooling fish bonuses
    if (targetPiece.tags.includes('schooling')) {
      const adjacentSchoolingCount = adjacentPieces.filter(p => p.tags.includes('schooling')).length;
      
      if (targetPiece.name === 'Neon Tetra') {
        attackBonus += adjacentSchoolingCount;
        if (adjacentSchoolingCount > 0) {
          bonuses.push(`Schooling (+${adjacentSchoolingCount} ATK)`);
        }
      }
      
      if (targetPiece.name === 'Cardinal Tetra') {
        attackBonus += adjacentSchoolingCount * 2;
        if (adjacentSchoolingCount > 0) {
          bonuses.push(`Schooling (+${adjacentSchoolingCount * 2} ATK)`);
        }
      }

      // Double speed if 3+ schooling fish adjacent
      if (adjacentSchoolingCount >= 3) {
        speedBonus += targetPiece.stats.speed; // Double speed = +current speed
        bonuses.push('School Frenzy (Double Speed)');
      }
    }

    return { attack: attackBonus, health: healthBonus, speed: speedBonus, bonuses };
  };

  const handleGridPieceHover = (piece: GamePiece | null) => {
    setHoveredGridPiece(piece);
    if (piece && gameState) {
      const placedPieces = gameState.playerTank.pieces.filter(p => p.position);
      const { bonuses } = calculateAdjacencyBonuses(piece, placedPieces);
      setSynergyBonuses(bonuses);
    } else {
      setSynergyBonuses([]);
    }
  };

  // Handle pending placement after purchase
  useEffect(() => {
    if (pendingPlacement && gameState) {
      // Look for a newly purchased piece that matches our pending placement
      const unplacedPiece = gameState.playerTank.pieces.find(p => 
        p.name === pendingPlacement.piece.name && 
        !p.position &&
        p.id !== pendingPlacement.piece.id // Different ID means it's newly purchased
      );
      
      if (unplacedPiece) {
        // Place the piece at the intended position
        placePiece(unplacedPiece, pendingPlacement.position);
        setPendingPlacement(null);
      }
    }
  }, [gameState, pendingPlacement, placePiece]);

  // Track mouse position for tooltip
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    if (hoveredPiece || hoveredGridPiece) {
      document.addEventListener('mousemove', handleMouseMove);
      return () => document.removeEventListener('mousemove', handleMouseMove);
    }
  }, [hoveredPiece, hoveredGridPiece]);

  const handleDragPlace = (piece: GamePiece, position: Position) => {
    console.log('🎯 DRAG PLACE:', piece.name, 'at position:', position);
    
    // If this piece is from the shop (doesn't have a position), purchase and place it
    const pieceInShop = gameState?.shop.find(shopPiece => shopPiece?.id === piece.id);
    if (pieceInShop) {
      const shopIndex = gameState?.shop.findIndex(shopPiece => shopPiece?.id === piece.id) ?? -1;
      
      console.log('🛒 Piece is from shop, purchasing from index:', shopIndex);
      // Set up pending placement - this will be resolved when game state updates
      setPendingPlacement({ piece, position });
      
      // Purchase the piece
      purchasePiece(piece.id, shopIndex);
    } else {
      console.log('🔄 Moving existing piece');
      // This is an existing piece being moved
      placePiece(piece, position);
    }
  };

  if (!connected || !gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto mb-4" size={48} />
          <p className="text-lg text-gray-600">Connecting to game server...</p>
        </div>
      </div>
    );
  }

  // Calculate tank analysis for the summary
  const tankAnalysis = analyzeTank(gameState.playerTank.pieces);

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        gold={gameState.gold}
        opponentGold={gameState.opponentGold}
        round={gameState.round}
        wins={gameState.wins}
        losses={gameState.losses}
        lossStreak={gameState.lossStreak}
        opponentLossStreak={gameState.opponentLossStreak}
      />

      <main className="flex-1 container mx-auto px-4 py-6">
        {/* Hover Tooltip */}
        {hoveredPiece && (
          <div 
            className="fixed z-50 bg-black text-white p-4 rounded-lg shadow-lg max-w-xs pointer-events-none"
            style={{
              left: mousePosition.x + 15 > window.innerWidth - 300 
                ? mousePosition.x - 315 
                : mousePosition.x + 15,
              top: Math.max(10, Math.min(window.innerHeight - 200, mousePosition.y - 10)),
              transform: 'translateY(-50%)',
            }}
          >
            <h3 className="font-bold text-yellow-300 mb-2">{hoveredPiece.name}</h3>
            <div className="text-sm space-y-1">
              <div className="flex gap-3">
                <span>⚔️ {hoveredPiece.stats.attack}</span>
                <span>❤️ {hoveredPiece.stats.health}</span>
                <span>⚡ {hoveredPiece.stats.speed}</span>
              </div>
              {hoveredPiece.position && (
                <div className="text-xs text-gray-400 border-t border-gray-600 pt-1 mt-2">
                  Position: ({hoveredPiece.position.x}, {hoveredPiece.position.y})
                </div>
              )}
              {hoveredPiece.abilities && hoveredPiece.abilities.length > 0 && (
                <div className="mt-2 border-t border-gray-600 pt-2">
                  <div className="text-blue-300 font-semibold mb-1">Abilities:</div>
                  {hoveredPiece.abilities.map((ability, index) => (
                    <div key={index} className="text-gray-300 text-xs italic">
                      {ability}
                    </div>
                  ))}
                </div>
              )}
              {hoveredPiece.tags.length > 0 && (
                <div className="mt-2">
                  <div className="text-purple-300 font-semibold mb-1">Tags:</div>
                  <div className="flex flex-wrap gap-1">
                    {hoveredPiece.tags.map((tag) => (
                      <span key={tag} className={`text-xs px-1 py-0.5 rounded ${getTypeColors(hoveredPiece.type).tag}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Grid Piece Tooltip */}
        {hoveredGridPiece && (
          <div 
            className="fixed z-50 bg-black text-white p-4 rounded-lg shadow-lg max-w-xs pointer-events-none"
            style={{
              left: mousePosition.x + 15 > window.innerWidth - 300 
                ? mousePosition.x - 315 
                : mousePosition.x + 15,
              top: Math.max(10, Math.min(window.innerHeight - 200, mousePosition.y - 10)),
              transform: 'translateY(-50%)',
            }}
          >
            <h3 className="font-bold text-yellow-300 mb-2">{hoveredGridPiece.name}</h3>
            <div className="text-sm space-y-1">
              {(() => {
                const placedPieces = gameState?.playerTank.pieces.filter(p => p.position) || [];
                const { attack: atkBonus, health: hpBonus, speed: spdBonus } = calculateAdjacencyBonuses(hoveredGridPiece, placedPieces);
                const baseAttack = hoveredGridPiece.stats.attack;
                const baseHealth = hoveredGridPiece.stats.health;
                const baseSpeed = hoveredGridPiece.stats.speed;
                const finalAttack = baseAttack + atkBonus;
                const finalHealth = baseHealth + hpBonus;
                const finalSpeed = baseSpeed + spdBonus;
                
                return (
                  <>
                    <div className="flex gap-3 mb-2">
                      <span className={atkBonus > 0 ? 'text-green-300 font-bold' : ''}>
                        ⚔️ {finalAttack}{atkBonus > 0 && ` (+${atkBonus})`}
                      </span>
                      <span className={hpBonus > 0 ? 'text-green-300 font-bold' : ''}>
                        ❤️ {finalHealth}{hpBonus > 0 && ` (+${hpBonus})`}
                      </span>
                      <span className={spdBonus > 0 ? 'text-green-300 font-bold' : ''}>
                        ⚡ {finalSpeed}{spdBonus > 0 && ` (+${spdBonus})`}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 border-t border-gray-600 pt-1">
                      Base: ⚔️{baseAttack} ❤️{baseHealth} ⚡{baseSpeed}
                    </div>
                  </>
                );
              })()}
              {hoveredGridPiece.position && (
                <div className="text-xs text-gray-400 border-t border-gray-600 pt-1 mt-2">
                  Position: ({hoveredGridPiece.position.x}, {hoveredGridPiece.position.y})
                </div>
              )}
              {synergyBonuses.length > 0 && (
                <div className="mt-2 border-t border-yellow-600 pt-2">
                  <div className="text-yellow-300 font-semibold mb-1">Adjacency Bonuses:</div>
                  <div className="space-y-1">
                    {synergyBonuses.map((bonus) => (
                      <div key={bonus} className="bg-yellow-600 text-black text-xs px-2 py-0.5 rounded font-bold">
                        {bonus}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {hoveredGridPiece.abilities && hoveredGridPiece.abilities.length > 0 && (
                <div className="mt-2 border-t border-gray-600 pt-2">
                  <div className="text-blue-300 font-semibold mb-1">Abilities:</div>
                  {hoveredGridPiece.abilities.map((ability, index) => (
                    <div key={index} className="text-gray-300 text-xs italic">
                      {ability}
                    </div>
                  ))}
                </div>
              )}
              {hoveredGridPiece.tags.length > 0 && (
                <div className="mt-2">
                  <div className="text-purple-300 font-semibold mb-1">Tags:</div>
                  <div className="flex flex-wrap gap-1">
                    {hoveredGridPiece.tags.map((tag) => (
                      <span key={tag} className={`text-xs px-1 py-0.5 rounded ${getTypeColors(hoveredGridPiece.type).tag}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Shop */}
          <div className="lg:col-span-1">
            <Shop
              shop={gameState.shop}
              gold={gameState.gold}
              onPurchase={purchasePiece}
              onReroll={rerollShop}
              rerollCost={2}
              nextInterest={Math.min(Math.floor(gameState.gold / 10), 5)}
              rerollsUsed={gameState.rerollsThisRound}
              lockedIndex={gameState.lockedShopIndex}
              onToggleLock={toggleShopLock}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onHover={handleHover}
              draggedPiece={draggedPiece}
              hoveredPiece={hoveredPiece}
              getTypeColors={getTypeColors}
            />
          </div>

          {/* Center Column - Tank Grid */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-4">
              <h2 className="text-xl font-bold mb-4 text-center">
                {gameState.phase === 'shop' ? '🏗️ Build Phase' : '⚔️ Battle Phase'}
              </h2>
              
              <TankGrid
                grid={gameState.playerTank.grid}
                pieces={gameState.playerTank.pieces}
                waterQuality={gameState.playerTank.waterQuality}
                onPlacePiece={handleDragPlace}
                onMovePiece={movePiece}
                selectedPiece={gameState.selectedPiece}
                interactive={gameState.phase === 'shop'}
                externalDraggedPiece={draggedPiece}
                highlightedPieceId={highlightedPieceId}
                onPieceHover={handleGridPieceHover}
                getTypeColors={getTypeColors}
              />

              {gameState.phase === 'shop' && (
                <button
                  className="w-full mt-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold rounded-lg hover:shadow-lg transition-all"
                  onClick={() => {
                    confirmPlacement();
                  }}
                >
                  Confirm Placement & Prepare for Battle
                </button>
              )}
            </div>
            
            {/* Tank Summary - Battle Stats */}
            <div className="mt-4">
              <TankSummary 
                analysis={tankAnalysis}
                waterQuality={gameState.playerTank.waterQuality}
                showDetailed={true}
              />
            </div>
          </div>

          {/* Right Column - Tank Pieces */}
          <div className="lg:col-span-1">
            <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
              <h2 className="text-xl font-bold text-green-800 mb-4">
                🐠 Tank Pieces
                <span className="text-sm font-normal text-gray-600 ml-2">
                  ({gameState.playerTank.pieces.length} items)
                </span>
              </h2>
              
              {gameState.playerTank.pieces.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-6xl mb-4">🐟</p>
                  <p className="text-lg font-semibold">No pieces yet</p>
                  <p className="text-sm">Purchase from shop to get started!</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {/* Sticky warning pieces at top */}
                  <div className="sticky top-0 z-10 space-y-2">
                    {gameState.playerTank.pieces
                      .filter(piece => !piece.position)
                      .map((piece) => (
                        <div
                          key={piece.id}
                          className="bg-yellow-50 rounded-lg p-3 shadow-sm hover:shadow-2xl hover:scale-105 hover:-rotate-1 transition-all duration-300 border-2 border-yellow-300 cursor-grab active:cursor-grabbing transform-gpu"
                          draggable={gameState.phase === 'shop'}
                          onDragStart={() => handleDragStart(piece)}
                          onDragEnd={handleDragEnd}
                          onMouseEnter={() => handleTankPieceHover(piece)}
                          onMouseLeave={() => handleTankPieceHover(null)}
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex-1">
                              <p className="font-semibold">{piece.name}</p>
                              <p className="text-xs text-gray-600">
                                {piece.type} • {piece.rarity}
                              </p>
                              <div className="flex gap-2 mt-1">
                                {(() => {
                                  const placedPieces = gameState.playerTank.pieces.filter(p => p.position);
                                  const { attack: atkBonus, health: hpBonus, speed: spdBonus } = calculateAdjacencyBonuses(piece, placedPieces);
                                  return (
                                    <>
                                      <span className={`text-xs px-1 py-0.5 rounded ${atkBonus > 0 ? 'bg-green-200 text-green-800 font-bold' : 'bg-red-100 text-red-700'}`}>
                                        ⚔️ {piece.stats.attack + atkBonus}{atkBonus > 0 && ` (+${atkBonus})`}
                                      </span>
                                      <span className={`text-xs px-1 py-0.5 rounded ${hpBonus > 0 ? 'bg-green-200 text-green-800 font-bold' : 'bg-pink-100 text-pink-700'}`}>
                                        ❤️ {piece.stats.health + hpBonus}{hpBonus > 0 && ` (+${hpBonus})`}
                                      </span>
                                      <span className={`text-xs px-1 py-0.5 rounded ${spdBonus > 0 ? 'bg-green-200 text-green-800 font-bold' : 'bg-blue-100 text-blue-700'}`}>
                                        ⚡ {piece.stats.speed + spdBonus}{spdBonus > 0 && ` (+${spdBonus})`}
                                      </span>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded font-semibold mb-1">
                                ⚠️ NOT PLACED
                              </span>
                              <span className="text-xs text-yellow-700 font-medium">
                                Drag to place
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                  
                  {/* Placed pieces below */}
                  {gameState.playerTank.pieces
                    .filter(piece => piece.position)
                    .map((piece) => (
                      <div
                        key={piece.id}
                        className="bg-white rounded-lg p-3 shadow-sm hover:shadow-2xl hover:scale-105 hover:rotate-1 transition-all duration-300 transform-gpu cursor-pointer"
                        onMouseEnter={() => handleTankPieceHover(piece)}
                        onMouseLeave={() => handleTankPieceHover(null)}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <p className="font-semibold">{piece.name}</p>
                            <p className="text-xs text-gray-600">
                              {piece.type} • {piece.rarity}
                            </p>
                            <div className="flex gap-2 mt-1">
                              {(() => {
                                const placedPieces = gameState.playerTank.pieces.filter(p => p.position);
                                const { attack: atkBonus, health: hpBonus, speed: spdBonus } = calculateAdjacencyBonuses(piece, placedPieces);
                                return (
                                  <>
                                    <span className={`text-xs px-1 py-0.5 rounded ${atkBonus > 0 ? 'bg-green-200 text-green-800 font-bold' : 'bg-red-100 text-red-700'}`}>
                                      ⚔️ {piece.stats.attack + atkBonus}{atkBonus > 0 && ` (+${atkBonus})`}
                                    </span>
                                    <span className={`text-xs px-1 py-0.5 rounded ${hpBonus > 0 ? 'bg-green-200 text-green-800 font-bold' : 'bg-pink-100 text-pink-700'}`}>
                                      ❤️ {piece.stats.health + hpBonus}{hpBonus > 0 && ` (+${hpBonus})`}
                                    </span>
                                    <span className={`text-xs px-1 py-0.5 rounded ${spdBonus > 0 ? 'bg-green-200 text-green-800 font-bold' : 'bg-blue-100 text-blue-700'}`}>
                                      ⚡ {piece.stats.speed + spdBonus}{spdBonus > 0 && ` (+${spdBonus})`}
                                    </span>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                            ✓ Placed
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer phase={gameState.phase} waterQuality={gameState.playerTank.waterQuality} />
    </div>
  );
}