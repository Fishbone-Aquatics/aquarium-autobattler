'use client';

import React from 'react';
import { useGame } from '../../contexts/GameContext';

interface FooterProps {
  phase: string;
  waterQuality: number;
}

export function Footer({ phase, waterQuality }: FooterProps) {
  const { hasDraftState, draftStateAge, clearDraftState, restoreDraftState } = useGame();
  
  return (
    <footer className="bg-white border-t border-gray-200 mt-12">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center gap-4">
            <p>Build your dream aquarium and dominate the competition!</p>
            
            {/* Draft State Controls */}
            {hasDraftState && (
              <div className="flex items-center gap-2 ml-4">
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  💾 Draft saved{draftStateAge !== null ? ` ${draftStateAge}m ago` : ''}
                </span>
                <button
                  onClick={restoreDraftState}
                  className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded hover:bg-green-200 transition-colors"
                >
                  🔄 Restore
                </button>
                <button
                  onClick={clearDraftState}
                  className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded hover:bg-red-200 transition-colors"
                >
                  🗑️ Clear
                </button>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-xs">Phase: <strong className="capitalize">{phase}</strong></span>
            <span className="text-xs">Tank Health: <strong>{waterQuality}/10</strong></span>
          </div>
        </div>
      </div>
    </footer>
  );
}