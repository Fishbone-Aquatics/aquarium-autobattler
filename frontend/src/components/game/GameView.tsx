'use client';

import React, { useState, useEffect } from 'react';
import { useGame } from '../../contexts/GameContext';
import { Header } from '../ui/Header';
import { Footer } from '../ui/Footer';
import { Shop } from './Shop';
import { TankGrid } from './TankGrid';
import { Loader2 } from 'lucide-react';
import { GamePiece, Position } from '@aquarium/shared-types';

export function GameView() {
  const { gameState, connected, purchasePiece, placePiece, movePiece, rerollShop, toggleShopLock } = useGame();
  const [draggedPiece, setDraggedPiece] = useState<GamePiece | null>(null);
  const [hoveredPiece, setHoveredPiece] = useState<GamePiece | null>(null);
  const [highlightedPieceId, setHighlightedPieceId] = useState<string | null>(null);
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

    if (hoveredPiece) {
      document.addEventListener('mousemove', handleMouseMove);
      return () => document.removeEventListener('mousemove', handleMouseMove);
    }
  }, [hoveredPiece]);

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
                      <span key={tag} className="bg-purple-800 text-xs px-1 py-0.5 rounded">
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
              />

              {gameState.phase === 'shop' && (
                <button
                  className="w-full mt-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold rounded-lg hover:shadow-lg transition-all"
                  onClick={() => {
                    // Handle battle preparation
                  }}
                >
                  Battle Preparation →
                </button>
              )}
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
                                <span className="text-xs bg-red-100 text-red-700 px-1 py-0.5 rounded">
                                  ⚔️ {piece.stats.attack}
                                </span>
                                <span className="text-xs bg-pink-100 text-pink-700 px-1 py-0.5 rounded">
                                  ❤️ {piece.stats.health}
                                </span>
                                <span className="text-xs bg-blue-100 text-blue-700 px-1 py-0.5 rounded">
                                  ⚡ {piece.stats.speed}
                                </span>
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
                              <span className="text-xs bg-red-100 text-red-700 px-1 py-0.5 rounded">
                                ⚔️ {piece.stats.attack}
                              </span>
                              <span className="text-xs bg-pink-100 text-pink-700 px-1 py-0.5 rounded">
                                ❤️ {piece.stats.health}
                              </span>
                              <span className="text-xs bg-blue-100 text-blue-700 px-1 py-0.5 rounded">
                                ⚡ {piece.stats.speed}
                              </span>
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