'use client';

import React, { useState } from 'react';
import { GamePiece } from '@aquarium/shared-types';

interface PieceCardProps {
  piece: GamePiece;
  onAction?: () => void;
  actionText?: string;
  actionDisabled?: boolean;
  compact?: boolean;
  onDragStart?: (piece: GamePiece) => void;
  onDragEnd?: () => void;
  onHover?: (piece: GamePiece | null) => void;
  canAfford?: boolean;
  isSelected?: boolean;
  isDragging?: boolean;
  getTypeColors?: (type: string) => { grid: string; border: string; tag: string; tagActive: string };
}

const rarityColors = {
  common: 'bg-gray-100 border-gray-300',
  uncommon: 'bg-green-100 border-green-400',
  rare: 'bg-blue-100 border-blue-400',
  epic: 'bg-purple-100 border-purple-400',
  legendary: 'bg-orange-100 border-orange-400',
};

const typeIcons = {
  fish: '🐠',
  plant: '🌿',
  equipment: '⚙️',
  consumable: '🧪',
};

export function PieceCard({ 
  piece, 
  onAction, 
  actionText, 
  actionDisabled, 
  compact,
  onDragStart,
  onDragEnd,
  onHover,
  canAfford = true,
  isSelected = false,
  isDragging = false,
  getTypeColors
}: PieceCardProps) {
  const [isViewAbilitiesHovered, setIsViewAbilitiesHovered] = useState(false);
  if (compact) {
    return (
      <div className="flex items-center gap-2 p-2">
        <span className="text-lg">{typeIcons[piece.type]}</span>
        <div className="flex-1">
          <p className="text-sm font-semibold">{piece.name}</p>
          <div className="flex gap-2 text-xs text-gray-600">
            <span>⚔️ {piece.stats.attack}</span>
            <span>❤️ {piece.stats.health}</span>
            <span>⚡ {piece.stats.speed}</span>
          </div>
        </div>
      </div>
    );
  }

  const handleDragStart = (e: React.DragEvent) => {
    if (onDragStart) {
      e.dataTransfer.setData('application/json', JSON.stringify(piece));
      onDragStart(piece);
    }
  };

  const handleDragEnd = () => {
    if (onDragEnd) {
      onDragEnd();
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger card click if clicking on the View Abilities button
    if ((e.target as HTMLElement).closest('.view-abilities-button')) {
      return;
    }
    if (onAction) {
      onAction();
    }
  };

  const handleViewAbilitiesEnter = () => {
    setIsViewAbilitiesHovered(true);
    if (onHover) {
      onHover(piece);
    }
  };

  const handleViewAbilitiesLeave = () => {
    setIsViewAbilitiesHovered(false);
    if (onHover) {
      onHover(null);
    }
  };

  return (
    <div 
      className={`rounded-lg border-2 p-2 transition-all cursor-pointer bg-white ${
        rarityColors[piece.rarity]
      } ${
        isSelected ? 'ring-2 ring-blue-400 scale-105' : ''
      } ${
        isDragging ? 'opacity-50 rotate-3' : ''
      } ${
        !canAfford ? 'opacity-60' : 'hover:scale-105 hover:shadow-lg'
      }`}
      draggable={!!onDragStart}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleCardClick}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-bold text-sm text-gray-800 leading-tight">{piece.name}</h3>
          <div className="text-xs text-gray-600 capitalize">
            {piece.type} • {piece.rarity}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Piece Shape Visualization - moved to top right */}
          {piece.shape && (
            <div className="grid grid-cols-3 gap-px w-8 h-8">
              {Array.from({ length: 9 }, (_, i) => {
                const x = i % 3;
                const y = Math.floor(i / 3);
                const isPartOfShape = piece.shape.some(offset => 
                  offset.x === x - 1 && offset.y === y - 1
                );
                return (
                  <div
                    key={i}
                    className={`aspect-square rounded-sm ${
                      isPartOfShape 
                        ? 'bg-blue-500 opacity-70' 
                        : 'bg-gray-200 opacity-30'
                    }`}
                  />
                );
              })}
            </div>
          )}
          {/* Info icon */}
          <div 
            className="text-blue-500 text-sm cursor-pointer hover:text-blue-600" 
            onMouseEnter={handleViewAbilitiesEnter}
            onMouseLeave={handleViewAbilitiesLeave}
          >
            ℹ️
          </div>
        </div>
      </div>
      
      {/* Stats moved to where shape was - horizontal layout */}
      <div className="flex justify-center gap-3 text-sm mb-2">
        <span title="Attack" className="flex items-center gap-1">
          <span className="text-red-500">⚔️</span>
          <span className="font-semibold text-gray-800">{piece.stats.attack}</span>
        </span>
        <span title="Health" className="flex items-center gap-1">
          <span className="text-green-500">❤️</span>
          <span className="font-semibold text-gray-800">{piece.stats.health}</span>
        </span>
        <span title="Speed" className="flex items-center gap-1">
          <span className="text-blue-500">⚡</span>
          <span className="font-semibold text-gray-800">{piece.stats.speed}</span>
        </span>
      </div>
      
      {onAction && (
        <button
          className="view-abilities-button w-full py-1.5 px-3 rounded-md text-xs font-semibold transition-all bg-green-500 text-white hover:bg-green-600"
          onClick={onAction}
        >
          {actionText || 'Info'}
        </button>
      )}
    </div>
  );
}