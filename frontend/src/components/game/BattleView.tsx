'use client';

import React, { useState, useEffect } from 'react';
import { useGame } from '../../contexts/GameContext';
import { Header } from '../ui/Header';
import { Footer } from '../ui/Footer';
import { TankGrid } from './TankGrid';
import { StatComparison } from './StatComparison';
import { BattleLog } from './BattleLog';
import { GameState, GamePiece, BattleState, BattleEvent } from '@aquarium/shared-types';
import { GoldTrackerModal } from '../ui/GoldTrackerModal';
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
  const { returnToShop, enterPlacementPhase, enterBattlePhase, calculatedStats } = useGame();
  const [battleState, setBattleState] = useState<BattleState | null>(gameState.battleState || null);
  const [battleEvents, setBattleEvents] = useState<BattleEvent[]>([]);
  const [showStats, setShowStats] = useState(false);
  const [hoveredPiece, setHoveredPiece] = useState<GamePiece | null>(null);
  const [highlightedPieceId, setHighlightedPieceId] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState<{x: number, y: number}>({x: 0, y: 0});
  const [isGoldTrackerOpen, setIsGoldTrackerOpen] = useState(false);

  // Calculate tank analyses
  const playerAnalysis = analyzeTank(gameState.playerTank.pieces);
  const opponentAnalysis = analyzeTank(gameState.opponentTank.pieces);

  // Handle piece hover for tooltips
  const handleTankPieceHover = (piece: GamePiece | null) => {
    setHoveredPiece(piece);
    // If the piece is placed on the grid, highlight it
    if (piece && piece.position) {
      setHighlightedPieceId(piece.id);
    } else {
      setHighlightedPieceId(null);
    }
  };

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
          winStreak={gameState.winStreak}
          opponentLossStreak={gameState.opponentLossStreak}
          opponentWinStreak={gameState.opponentWinStreak}
          onOpenGoldTracker={() => setIsGoldTrackerOpen(true)}
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
                  {(() => {
                    const pieceStats = calculatedStats?.[hoveredPiece.id];
                    const baseStats = hoveredPiece.stats;
                    
                    if (pieceStats && hoveredPiece.position) {
                      // Show calculated stats with bonuses indicated
                      return (
                        <>
                          <span className={pieceStats.attack > baseStats.attack ? 'text-green-400' : ''}>
                            ⚔️ {pieceStats.attack}
                            {pieceStats.attack > baseStats.attack && (
                              <span className="text-green-300 text-xs"> (+{pieceStats.attack - baseStats.attack})</span>
                            )}
                          </span>
                          <span className={pieceStats.health > baseStats.health ? 'text-green-400' : ''}>
                            ❤️ {pieceStats.health}
                            {pieceStats.health > baseStats.health && (
                              <span className="text-green-300 text-xs"> (+{pieceStats.health - baseStats.health})</span>
                            )}
                          </span>
                          <span className={pieceStats.speed > baseStats.speed ? 'text-green-400' : ''}>
                            ⚡ {pieceStats.speed}
                            {pieceStats.speed > baseStats.speed && (
                              <span className="text-green-300 text-xs"> (+{pieceStats.speed - baseStats.speed})</span>
                            )}
                          </span>
                        </>
                      );
                    } else {
                      // Show base stats
                      return (
                        <>
                          <span>⚔️ {baseStats.attack}</span>
                          <span>❤️ {baseStats.health}</span>
                          <span>⚡ {baseStats.speed}</span>
                        </>
                      );
                    }
                  })()}
                </div>
                {hoveredPiece.permanentBonuses && hoveredPiece.permanentBonuses.sources.length > 0 && (
                  <div className="mt-2 border-t border-gray-600 pt-2">
                    <div className="text-yellow-300 font-semibold mb-1 text-xs">Permanent Bonuses:</div>
                    {hoveredPiece.permanentBonuses.sources.map((source, index) => (
                      <div key={index} className="text-green-300 text-xs">
                        {source.count > 1 ? `${source.count}x ` : ''}{source.name}: 
                        {source.attackBonus > 0 && ` +${source.attackBonus * source.count} ATK`}
                        {source.healthBonus > 0 && ` +${source.healthBonus * source.count} HP`}
                        {source.speedBonus > 0 && ` +${source.speedBonus * source.count} SPD`}
                      </div>
                    ))}
                  </div>
                )}
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
                {hoveredPiece.tags && hoveredPiece.tags.length > 0 && (
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
          {/* Single Status Area - handles all battle states */}
          <div className="bg-white bg-opacity-95 rounded-lg p-6 mb-6 shadow-lg">
            {/* Battle completed state */}
            {battleState?.winner ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold mb-2 text-blue-900">
                      {battleState.isGameComplete ? (
                        '👑 Campaign Complete!'
                      ) : (
                        battleState.winner === 'player' ? '🎉 Victory!' : battleState.winner === 'opponent' ? '💀 Defeat!' : '🤝 Draw!'
                      )}
                    </h2>
                    <p className="text-blue-700">
                      {battleState.isGameComplete ? (
                        `You've conquered all 15 rounds! Final record: ${gameState.wins}W-${gameState.losses}L`
                      ) : (
                        battleState.winner === 'player'
                          ? 'Your aquarium proved superior in battle!'
                          : battleState.winner === 'opponent' 
                          ? 'Better luck next time, trainer!'
                          : 'An evenly matched battle!'
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      returnToShop();
                    }}
                    className={`px-6 py-3 text-white font-bold rounded-lg hover:shadow-lg transition-all ml-4 ${
                      battleState.isGameComplete 
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 animate-pulse'
                        : 'bg-gradient-to-r from-orange-500 to-red-500'
                    }`}
                  >
                    {battleState.isGameComplete ? '🎉 Start New Campaign' : 'Continue to Next Round'}
                  </button>
                </div>
                
                {/* Health bars after battle completion */}
                {battleState && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Player Health */}
                    <div className="bg-white bg-opacity-90 rounded-lg p-4 shadow">
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
                    <div className="bg-white bg-opacity-90 rounded-lg p-4 shadow">
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
              </>
            ) : (
              <>
                {/* Battle status header */}
                <div className="text-center mb-4">
                  <h1 className="text-2xl font-bold text-blue-900 mb-2">
                    {gameState.phase === 'battle' && battleState?.active ? '⚔️ Battle in Progress' : '🛡️ Prepare for Battle'}
                  </h1>
                  <p className="text-blue-700 mb-4">
                    {gameState.phase === 'battle' && battleState?.active 
                      ? `Round ${battleState.currentRound} • Turn ${battleState.currentTurn}`
                      : 'Review your setup and compare stats before battle begins'
                    }
                  </p>
                  
                  {/* Start Battle button - only shown in placement phase */}
                  {gameState.phase === 'placement' && (
                    <button
                      onClick={handleStartBattle}
                      className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold rounded-lg hover:shadow-lg transition-all mx-auto"
                    >
                      <Swords size={20} />
                      Start Battle!
                    </button>
                  )}
                </div>

                {/* Health bars during active battle */}
                {gameState.phase === 'battle' && battleState && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Player Health */}
                    <div className="bg-white bg-opacity-90 rounded-lg p-4 shadow">
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
                    <div className="bg-white bg-opacity-90 rounded-lg p-4 shadow">
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
              </>
            )}
          </div>

          {/* Collapsible Stat Comparison */}
          <div className="mb-6">
            <div 
              className="bg-white rounded-lg shadow-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => setShowStats(!showStats)}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-800">Tank Statistics Comparison</h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {showStats ? 'Hide' : 'Show'} detailed stats
                  </span>
                  <div className={`transform transition-transform ${showStats ? 'rotate-180' : ''}`}>
                    ▼
                  </div>
                </div>
              </div>
            </div>
            
            {showStats && (
              <div className="mt-2">
                <StatComparison
                  playerAnalysis={playerAnalysis}
                  opponentAnalysis={opponentAnalysis}
                  playerTank={gameState.playerTank}
                  opponentTank={gameState.opponentTank}
                />
              </div>
            )}
          </div>

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
                onPieceHover={handleTankPieceHover}
                highlightedPieceId={highlightedPieceId}
                gamePhase={gameState.phase}
                battlePieces={battleState?.playerPieces}
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
                onPieceHover={handleTankPieceHover}
                highlightedPieceId={highlightedPieceId}
                gamePhase={gameState.phase}
                battlePieces={battleState?.opponentPieces}
              />
            </div>
          </div>

          {/* Battle Log - Show during battle */}
          {gameState.phase === 'battle' && battleEvents.length > 0 && (
            <div className="bg-white bg-opacity-95 rounded-lg shadow-xl border border-gray-200 mb-8">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 rounded-t-lg">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  ⚔️ Battle Log
                  <span className="text-sm font-normal bg-white/20 px-2 py-1 rounded">
                    {battleEvents.length} events
                  </span>
                </h3>
              </div>
              <div id="battle-log-container" className="max-h-[700px] min-h-[500px] overflow-y-auto p-6 bg-gray-50">
                <BattleLog events={battleEvents} maxHeight="384px" />
              </div>
            </div>
          )}

        </main>
        
        <Footer phase={gameState.phase} waterQuality={gameState.playerTank.waterQuality} />
        
        {/* Gold Tracker Modal */}
        <GoldTrackerModal
          goldHistory={gameState.goldHistory}
          currentGold={gameState.gold}
          isOpen={isGoldTrackerOpen}
          onClose={() => setIsGoldTrackerOpen(false)}
        />
      </div>
    );
  }

  // Remove the separate battle phase view - now handled in placement view

  return null;
}