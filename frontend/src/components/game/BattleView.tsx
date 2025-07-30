'use client';

import React, { useState, useEffect } from 'react';
import { useGame } from '../../contexts/GameContext';
import { Header } from '../ui/Header';
import { Footer } from '../ui/Footer';
import { TankGrid } from './TankGrid';
import { StatComparison } from './StatComparison';
import { BattleLog } from './BattleLog';
import { GameState, BattleState, BattleEvent } from '@aquarium/shared-types';
import { analyzeTank } from '../../utils/tankAnalysis';
import { Swords, Play, RotateCcw } from 'lucide-react';

interface BattleViewProps {
  gameState: GameState;
}

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

export function BattleView({ gameState }: BattleViewProps) {
  const { returnToShop, enterPlacementPhase, enterBattlePhase } = useGame();
  const [battleState, setBattleState] = useState<BattleState | null>(gameState.battleState || null);
  const [battleEvents, setBattleEvents] = useState<BattleEvent[]>([]);

  // Calculate tank analyses
  const playerAnalysis = analyzeTank(gameState.playerTank.pieces);
  const opponentAnalysis = analyzeTank(gameState.opponentTank.pieces);

  useEffect(() => {
    if (gameState.battleState) {
      setBattleState(gameState.battleState);
      setBattleEvents(gameState.battleState.events || []);
    }
  }, [gameState.battleState]);

  // Auto-scroll battle log to bottom when new events arrive
  useEffect(() => {
    if (battleEvents.length > 0) {
      const logElement = document.getElementById('battle-log-container');
      if (logElement) {
        logElement.scrollTop = logElement.scrollHeight;
      }
    }
  }, [battleEvents]);

  const handleStartBattle = () => {
    // Start battle simulation but stay on placement screen
    enterBattlePhase();
  };

  const handleBackToPlacement = () => {
    enterPlacementPhase();
  };

  if (gameState.phase === 'placement' || gameState.phase === 'battle') {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-blue-100">
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
          {/* Battle Result Banner */}
          {battleState?.winner && (
            <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4 rounded-lg mb-6 text-center">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-2">
                    {battleState.winner === 'player' ? '🎉 Victory!' : battleState.winner === 'opponent' ? '💀 Defeat!' : '🤝 Draw!'}
                  </h2>
                  <p className="text-orange-100">
                    {battleState.winner === 'player'
                      ? 'Your aquarium proved superior in battle!'
                      : battleState.winner === 'opponent' 
                      ? 'Better luck next time, trainer!'
                      : 'An evenly matched battle!'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    // Return to shop phase for next round
                    returnToShop();
                  }}
                  className="px-6 py-3 bg-white text-orange-600 font-bold rounded-lg hover:bg-gray-100 transition-all ml-4"
                >
                  Continue to Next Round
                </button>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-blue-900 mb-2">
              {gameState.phase === 'battle' && battleState?.active ? '⚔️ Battle in Progress' : '🛡️ Prepare for Battle'}
            </h1>
            <p className="text-blue-700">
              {gameState.phase === 'battle' && battleState?.active 
                ? `Round ${battleState.currentRound} • Turn ${battleState.currentTurn}`
                : 'Review your setup and compare stats before battle begins'
              }
            </p>
          </div>

          {/* Health Bars - Show during battle */}
          {gameState.phase === 'battle' && battleState && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {/* Player Health */}
              <div className="bg-white bg-opacity-90 rounded-lg p-4 shadow-lg">
                <div className="text-center text-gray-800 mb-2 font-bold">Your Tank</div>
                <div className="w-full bg-red-200 rounded-full h-6">
                  <div
                    className="bg-gradient-to-r from-green-400 to-green-600 h-6 rounded-full transition-all duration-500"
                    style={{
                      width: `${(battleState.playerHealth / battleState.playerMaxHealth) * 100}%`,
                    }}
                  ></div>
                </div>
                <div className="text-center text-gray-800 mt-1 font-semibold">
                  {battleState.playerHealth} / {battleState.playerMaxHealth} HP
                </div>
              </div>

              {/* Opponent Health */}
              <div className="bg-white bg-opacity-90 rounded-lg p-4 shadow-lg">
                <div className="text-center text-gray-800 mb-2 font-bold">Opponent Tank</div>
                <div className="w-full bg-red-200 rounded-full h-6">
                  <div
                    className="bg-gradient-to-r from-red-400 to-red-600 h-6 rounded-full transition-all duration-500"
                    style={{
                      width: `${(battleState.opponentHealth / battleState.opponentMaxHealth) * 100}%`,
                    }}
                  ></div>
                </div>
                <div className="text-center text-gray-800 mt-1 font-semibold">
                  {battleState.opponentHealth} / {battleState.opponentMaxHealth} HP
                </div>
              </div>
            </div>
          )}

          {/* Battle Grids Side by Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Player Tank */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-green-700 mb-4 text-center">
                🐠 Your Tank
              </h2>
              <TankGrid
                grid={gameState.playerTank.grid}
                pieces={gameState.playerTank.pieces}
                waterQuality={gameState.playerTank.waterQuality}
                interactive={false}
                getTypeColors={getTypeColors}
              />
            </div>

            {/* Opponent Tank */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-red-700 mb-4 text-center">
                🦈 Opponent Tank
              </h2>
              <TankGrid
                grid={gameState.opponentTank.grid}
                pieces={gameState.opponentTank.pieces}
                waterQuality={gameState.opponentTank.waterQuality}
                interactive={false}
                getTypeColors={getTypeColors}
              />
            </div>
          </div>

          {/* Stat Comparison */}
          <div className="mb-8">
            <StatComparison
              playerAnalysis={playerAnalysis}
              opponentAnalysis={opponentAnalysis}
              playerTank={gameState.playerTank}
              opponentTank={gameState.opponentTank}
            />
          </div>

          {/* Battle Log - Show during battle */}
          {gameState.phase === 'battle' && battleEvents.length > 0 && (
            <div className="bg-white bg-opacity-95 rounded-lg p-6 mb-8 shadow-lg">
              <div id="battle-log-container" className="max-h-64 overflow-y-auto">
                <BattleLog events={battleEvents} maxHeight="240px" />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-center gap-4">
            {gameState.phase === 'placement' && (
              <>
                <button
                  onClick={handleBackToPlacement}
                  className="flex items-center gap-2 px-6 py-3 bg-gray-500 text-white font-bold rounded-lg hover:bg-gray-600 transition-all"
                >
                  <RotateCcw size={20} />
                  Back to Shop
                </button>
                <button
                  onClick={handleStartBattle}
                  className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold rounded-lg hover:shadow-lg transition-all"
                >
                  <Swords size={20} />
                  Start Battle!
                </button>
              </>
            )}
            {gameState.phase === 'battle' && battleState?.active && (
              <div className="text-center">
                <div className="text-blue-700 font-semibold mb-2">Battle in progress...</div>
                <div className="text-sm text-blue-600">Watch your tanks battle it out!</div>
              </div>
            )}
          </div>
        </main>
        
        <Footer phase={gameState.phase} waterQuality={gameState.playerTank.waterQuality} />
      </div>
    );
  }

  // Remove the separate battle phase view - now handled in placement view

  return null;
}