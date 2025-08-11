'use client';

import React from 'react';
import { useGame } from '../../contexts/GameContext';

interface FooterProps {
  phase: string;
  waterQuality: number;
}

export function Footer({ phase, waterQuality }: FooterProps) {
  const { hasDraftState, draftStateAge, clearDraftState, restoreDraftState, getStoredDraftData, gameState } = useGame();
  const [showDetails, setShowDetails] = React.useState(false);
  
  const storedData = getStoredDraftData();
  
  // Get player ID from localStorage
  const playerId = typeof window !== 'undefined' ? localStorage.getItem('aquarium-player-id') : null;
  
  // Get API URL based on current host
  const apiUrl = typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
    ? `http://${window.location.hostname}:3001`
    : 'http://localhost:3001';
  
  return (
    <footer className="bg-white border-t border-gray-200 mt-12">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center gap-4">
            <p>Build your dream aquarium and dominate the competition!</p>
            
            {/* Stored Draft State Info */}
            {storedData && (
              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                >
                  💾 Saved: Round {storedData.round} | {storedData.gold}g | {storedData.pieceCount} pieces
                </button>
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
          
          <div className="flex items-center gap-3">
            <span className="text-xs">Phase: <strong className="capitalize">{phase}</strong></span>
            <span className="text-xs">Tank Health: <strong>{waterQuality}/10</strong></span>
            
            {/* Player Session Info */}
            {playerId && (
              <div className="relative group">
                <a
                  href={`${apiUrl}/api/debug/session/${playerId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded cursor-pointer hover:bg-gray-200 transition-colors inline-block"
                  title={`Click to view session details`}
                >
                  👤 {playerId}
                </a>
                
                {/* Hover tooltip */}
                <div className="absolute bottom-full right-0 mb-2 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  <div className="font-semibold mb-1">Current Session</div>
                  <div>Gold: {gameState?.gold || 0}</div>
                  <div>Round: {gameState?.round || 1}</div>
                  <div>Pieces: {gameState?.playerTank?.pieces?.length || 0}</div>
                  <div className="mt-1 text-gray-400 text-xs">Click to view full session data</div>
                </div>
              </div>
            )}
            
            {/* Session Management Buttons */}
            <div className="flex items-center gap-2">
              {/* Reset current session */}
              <button
                onClick={async () => {
                  if (confirm('Reset your current game? This will start a new game but keep your player ID.')) {
                    try {
                      const response = await fetch(`${apiUrl}/api/debug/player/${playerId}`, {
                        method: 'POST',
                      });
                      if (response.ok) {
                        window.location.reload();
                      }
                    } catch (error) {
                      console.error('Failed to reset session:', error);
                    }
                  }
                }}
                className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded hover:bg-orange-200 transition-colors"
                title="Reset your current game (keeps player ID)"
              >
                🔄 Reset Game
              </button>
              
              {/* Get new player ID */}
              <button
                onClick={() => {
                  if (confirm('Get a new player ID? This will create a completely new account.')) {
                    localStorage.removeItem('aquarium-player-id');
                    window.location.reload();
                  }
                }}
                className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded hover:bg-purple-200 transition-colors"
                title="Get a new player ID (new account)"
              >
                👤 New ID
              </button>
            </div>
          </div>
        </div>
        
        {/* Detailed View */}
        {showDetails && storedData && (
          <div className="border-t border-gray-200 mt-4 pt-4">
            <div className="text-xs text-gray-500">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <strong>Last Modified:</strong> {storedData.lastModified}
                </div>
                <div>
                  <strong>Pieces:</strong> {storedData.pieceCount} total, {storedData.placedPieces} placed
                </div>
              </div>
              <div className="mt-2">
                <strong>Gold:</strong> {storedData.gold} | <strong>Round:</strong> {storedData.round}
              </div>
              <div className="mt-1">
                <strong>Piece Names:</strong> {storedData.gameState.playerTank?.pieces?.map((p: any) => p.name).join(', ') || 'None'}
              </div>
            </div>
          </div>
        )}
      </div>
    </footer>
  );
}