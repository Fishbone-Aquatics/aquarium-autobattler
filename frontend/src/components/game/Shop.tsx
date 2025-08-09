'use client';

import React from 'react';
import { GamePiece } from '@aquarium/shared-types';
import { PieceCard } from './PieceCard';
import { RefreshCw, Lock, Unlock } from 'lucide-react';

interface ShopProps {
  shop: (GamePiece | null)[];
  gold: number;
  onPurchase: (pieceId: string, shopIndex: number) => void;
  onReroll: () => void;
  rerollCost: number;
  nextInterest: number;
  rerollsUsed: number;
  lockedIndex: number | null;
  onToggleLock: (index: number) => void;
  onDragStart?: (piece: GamePiece) => void;
  onDragEnd?: () => void;
  onHover?: (piece: GamePiece | null) => void;
  draggedPiece?: GamePiece | null;
  hoveredPiece?: GamePiece | null;
  getTypeColors?: (type: string) => { grid: string; border: string; tag: string; tagActive: string };
}

export function Shop({
  shop,
  gold,
  onPurchase,
  onReroll,
  rerollCost,
  nextInterest,
  rerollsUsed,
  lockedIndex,
  onToggleLock,
  onDragStart,
  onDragEnd,
  onHover,
  draggedPiece,
  hoveredPiece,
  getTypeColors,
}: ShopProps) {
  return (
    <div className="bg-gradient-to-b from-blue-500 to-teal-500 rounded-lg p-4 text-white">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏪</span>
          <h2 className="text-lg font-bold">Aquarium Shop</h2>
          <span className="text-sm bg-white/20 rounded-full w-5 h-5 flex items-center justify-center">?</span>
        </div>
        
        <button
          onClick={onReroll}
          disabled={gold < rerollCost}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
            gold >= rerollCost
              ? 'bg-white/20 hover:bg-white/30 backdrop-blur-sm'
              : 'bg-white/10 text-white/50 cursor-not-allowed'
          }`}
          title={rerollsUsed >= 5 ? `Cost increases after 5 rerolls (+1g per reroll)` : `${5 - rerollsUsed} rerolls left at 2g`}
        >
          <RefreshCw size={16} />
          Reroll {rerollCost}g
          {rerollsUsed >= 5 && (
            <span className="text-xs text-yellow-300 ml-1">
              (+{rerollsUsed - 5})
            </span>
          )}
        </button>
      </div>
      
      <div className="flex items-center justify-between mb-4 text-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span className="text-yellow-200">💰</span>
            <span>{gold}g</span>
          </div>
          {nextInterest > 0 && (
            <div className="text-yellow-200">
              Next: +{nextInterest}g interest
            </div>
          )}
          {rerollsUsed > 0 && (
            <div className="text-white/70">
              Rerolls: {rerollsUsed}
            </div>
          )}
        </div>
        {lockedIndex !== null && (
          <div className="flex items-center gap-2 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs">
            <span>🔒</span>
            <span>Shop slot {lockedIndex + 1} is locked</span>
            <button
              onClick={() => onToggleLock(lockedIndex)}
              className="underline hover:no-underline font-medium"
            >
              Clear lock
            </button>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {shop.map((piece, index) => (
          <div key={index} className="relative">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 border border-white/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium">Shop Slot</span>
                </div>
                <div className="flex items-center gap-1">
                  {lockedIndex === index && (
                    <div className="bg-yellow-400 text-black rounded-full p-1">
                      <span className="text-xs font-bold">⚠</span>
                    </div>
                  )}
                  <button
                    onClick={() => onToggleLock(index)}
                    className={`p-1 rounded transition-all ${
                      lockedIndex === index
                        ? 'bg-gray-200 text-gray-600'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                    title={lockedIndex === index ? 'Slot is locked - click to unlock' : 'Click to lock slot'}
                  >
                    {lockedIndex === index ? <Lock size={14} /> : <Unlock size={14} />}
                  </button>
                </div>
              </div>
              
              {piece ? (
                <div className={`bg-white rounded-lg p-3 transition-all ${
                  lockedIndex === index 
                    ? 'ring-2 ring-yellow-400 shadow-lg bg-yellow-50' 
                    : ''
                }`}>
                  <PieceCard
                    piece={piece}
                    onAction={() => onPurchase(piece.id, index)}
                    actionText={`Buy (${piece.cost}g)`}
                    actionDisabled={gold < piece.cost}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onHover={onHover}
                    canAfford={gold >= piece.cost}
                    isSelected={hoveredPiece?.id === piece.id}
                    isDragging={draggedPiece?.id === piece.id}
                    getTypeColors={getTypeColors}
                  />
                </div>
              ) : (
                <div className="bg-white rounded-lg p-8 text-center text-gray-400">
                  <span className="text-sm">Empty Slot</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {lockedIndex !== null && (
        <div className="mt-4 bg-yellow-100 border border-yellow-300 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-yellow-800">
              <span className="text-lg">🔒</span>
              <span className="font-medium">Slot {lockedIndex + 1} locked</span>
            </div>
            <button
              onClick={() => onToggleLock(lockedIndex)}
              className="text-yellow-700 underline hover:no-underline font-medium"
            >
              Unlock
            </button>
          </div>
        </div>
      )}
    </div>
  );
}