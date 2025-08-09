'use client';

import React from 'react';
import { Tank } from '@aquarium/shared-types';
import { TankAnalysis } from '../../utils/tankAnalysis';
import { Swords, Heart, Zap, Droplets, Thermometer } from 'lucide-react';

// Helper function to get water quality damage bonus text
const getWaterQualityBonus = (waterQuality: number) => {
  if (waterQuality >= 8) {
    return { text: '+30%', color: 'text-green-500', bgColor: 'bg-green-100' };
  } else if (waterQuality <= 3) {
    return { text: '-30%', color: 'text-red-500', bgColor: 'bg-red-100' };
  }
  return null;
};

interface StatComparisonProps {
  playerAnalysis: TankAnalysis;
  opponentAnalysis: TankAnalysis;
  playerTank: Tank;
  opponentTank: Tank;
}

interface StatRowProps {
  icon: React.ReactNode;
  label: string;
  playerValue: number;
  opponentValue: number;
  playerBonus?: number;
  opponentBonus?: number;
  formatValue?: (value: number) => string;
  playerWaterQuality?: number;
  opponentWaterQuality?: number;
  showWaterQuality?: boolean;
}

function StatRow({ 
  icon, 
  label, 
  playerValue, 
  opponentValue, 
  playerBonus = 0, 
  opponentBonus = 0,
  formatValue = (v) => v.toString(),
  playerWaterQuality,
  opponentWaterQuality,
  showWaterQuality = false
}: StatRowProps) {
  const playerTotal = playerValue + playerBonus;
  const opponentTotal = opponentValue + opponentBonus;
  const advantage = playerTotal > opponentTotal ? 'player' : 
                   opponentTotal > playerTotal ? 'opponent' : 'tie';

  const playerWaterBonus = showWaterQuality && playerWaterQuality ? getWaterQualityBonus(playerWaterQuality) : null;
  const opponentWaterBonus = showWaterQuality && opponentWaterQuality ? getWaterQualityBonus(opponentWaterQuality) : null;

  return (
    <div className="grid grid-cols-7 items-center gap-4 py-3 border-b border-gray-200">
      {/* Player Stats */}
      <div className={`col-span-2 text-right ${advantage === 'player' ? 'font-bold text-green-600' : 'text-gray-700'}`}>
        <div className="text-lg flex items-center justify-end gap-1">
          {formatValue(playerTotal)}
          {playerBonus > 0 && (
            <span className="text-sm text-green-500 ml-1">
              (+{playerBonus})
            </span>
          )}
          {playerWaterBonus && (
            <span className={`text-xs px-1 py-0.5 rounded-full ${playerWaterBonus.bgColor} ${playerWaterBonus.color} font-bold`} title="Water Quality Damage Bonus">
              {playerWaterBonus.text}
            </span>
          )}
        </div>
        {playerBonus > 0 && (
          <div className="text-xs text-gray-500">
            Base: {formatValue(playerValue)}
          </div>
        )}
      </div>

      {/* Progress Bar (Player) */}
      <div className="flex justify-end">
        <div 
          className={`h-6 rounded-l-full ${advantage === 'player' ? 'bg-green-500' : 'bg-blue-400'}`}
          style={{
            width: `${Math.min(100, (playerTotal / Math.max(playerTotal, opponentTotal)) * 80)}px`
          }}
        ></div>
      </div>

      {/* Center Label */}
      <div className="flex flex-col items-center">
        <div className="text-2xl mb-1">{icon}</div>
        <div className="text-xs font-semibold text-gray-600 text-center">{label}</div>
      </div>

      {/* Progress Bar (Opponent) */}
      <div className="flex justify-start">
        <div 
          className={`h-6 rounded-r-full ${advantage === 'opponent' ? 'bg-red-500' : 'bg-red-400'}`}
          style={{
            width: `${Math.min(100, (opponentTotal / Math.max(playerTotal, opponentTotal)) * 80)}px`
          }}
        ></div>
      </div>

      {/* Opponent Stats */}
      <div className={`col-span-2 text-left ${advantage === 'opponent' ? 'font-bold text-red-600' : 'text-gray-700'}`}>
        <div className="text-lg flex items-center gap-1">
          {formatValue(opponentTotal)}
          {opponentBonus > 0 && (
            <span className="text-sm text-green-500 ml-1">
              (+{opponentBonus})
            </span>
          )}
          {opponentWaterBonus && (
            <span className={`text-xs px-1 py-0.5 rounded-full ${opponentWaterBonus.bgColor} ${opponentWaterBonus.color} font-bold`} title="Water Quality Damage Bonus">
              {opponentWaterBonus.text}
            </span>
          )}
        </div>
        {opponentBonus > 0 && (
          <div className="text-xs text-gray-500">
            Base: {formatValue(opponentValue)}
          </div>
        )}
      </div>
    </div>
  );
}

export function StatComparison({ playerAnalysis, opponentAnalysis, playerTank, opponentTank }: StatComparisonProps) {
  // Calculate total advantages
  const totalAdvantages = {
    player: 0,
    opponent: 0,
    ties: 0
  };

  const stats = [
    { 
      player: playerAnalysis.totalAttack, 
      opponent: opponentAnalysis.totalAttack,
      playerBonus: playerAnalysis.bonusAttack,
      opponentBonus: opponentAnalysis.bonusAttack
    },
    { 
      player: playerAnalysis.totalHealth, 
      opponent: opponentAnalysis.totalHealth,
      playerBonus: playerAnalysis.bonusHealth,
      opponentBonus: opponentAnalysis.bonusHealth
    },
    { 
      player: playerAnalysis.averageSpeed, 
      opponent: opponentAnalysis.averageSpeed,
      playerBonus: playerAnalysis.bonusAverageSpeed,
      opponentBonus: opponentAnalysis.bonusAverageSpeed
    },
    { 
      player: playerTank.waterQuality, 
      opponent: opponentTank.waterQuality,
      playerBonus: 0,
      opponentBonus: 0
    },
    { 
      player: playerTank.pieces.filter(p => p.position).length, 
      opponent: opponentTank.pieces.filter(p => p.position).length,
      playerBonus: 0,
      opponentBonus: 0
    }
  ];

  stats.forEach(stat => {
    const playerTotal = stat.player + stat.playerBonus;
    const opponentTotal = stat.opponent + stat.opponentBonus;
    
    if (playerTotal > opponentTotal) totalAdvantages.player++;
    else if (opponentTotal > playerTotal) totalAdvantages.opponent++;
    else totalAdvantages.ties++;
  });

  const overallAdvantage = totalAdvantages.player > totalAdvantages.opponent ? 'player' :
                          totalAdvantages.opponent > totalAdvantages.player ? 'opponent' : 'tie';

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          📊 Tank Comparison
        </h2>
        <div className={`text-lg font-semibold ${
          overallAdvantage === 'player' ? 'text-green-600' :
          overallAdvantage === 'opponent' ? 'text-red-600' :
          'text-gray-600'
        }`}>
          {overallAdvantage === 'player' ? '🎯 You have the advantage!' :
           overallAdvantage === 'opponent' ? '⚠️ Opponent has the advantage!' :
           '⚖️ Evenly matched!'}
        </div>
      </div>

      {/* Tank Names */}
      <div className="grid grid-cols-7 items-center gap-4 mb-4">
        <div className="col-span-2 text-right">
          <h3 className="text-lg font-bold text-green-700">🐠 Your Tank</h3>
        </div>
        <div className="col-span-3"></div>
        <div className="col-span-2 text-left">
          <h3 className="text-lg font-bold text-red-700">🦈 Opponent</h3>
        </div>
      </div>

      {/* Stat Comparisons */}
      <div className="space-y-1">
        <StatRow
          icon={<Swords className="text-red-500" size={20} />}
          label="Attack Power"
          playerValue={playerAnalysis.baseAttack}
          opponentValue={opponentAnalysis.baseAttack}
          playerBonus={playerAnalysis.bonusAttack}
          opponentBonus={opponentAnalysis.bonusAttack}
          playerWaterQuality={playerTank.waterQuality}
          opponentWaterQuality={opponentTank.waterQuality}
          showWaterQuality={true}
        />

        <StatRow
          icon={<Heart className="text-pink-500" size={20} />}
          label="Total Health"
          playerValue={playerAnalysis.baseHealth}
          opponentValue={opponentAnalysis.baseHealth}
          playerBonus={playerAnalysis.bonusHealth}
          opponentBonus={opponentAnalysis.bonusHealth}
        />

        <StatRow
          icon={<Zap className="text-yellow-500" size={20} />}
          label="Speed"
          playerValue={playerAnalysis.baseAverageSpeed}
          opponentValue={opponentAnalysis.baseAverageSpeed}
          playerBonus={playerAnalysis.bonusAverageSpeed}
          opponentBonus={opponentAnalysis.bonusAverageSpeed}
          formatValue={(v) => `${v.toFixed(1)}`}
        />

        <StatRow
          icon={<Droplets className="text-blue-500" size={20} />}
          label="Water Quality"
          playerValue={playerTank.waterQuality}
          opponentValue={opponentTank.waterQuality}
          formatValue={(v) => `${v}/10`}
        />

        <StatRow
          icon={<span className="text-purple-500">🐟</span>}
          label="Active Pieces"
          playerValue={playerTank.pieces.filter(p => p.position).length}
          opponentValue={opponentTank.pieces.filter(p => p.position).length}
        />
      </div>

      {/* Battle Prediction */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-800 mb-3 text-center">
          🔮 Battle Prediction
        </h3>
        
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-green-100 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {totalAdvantages.player}
            </div>
            <div className="text-sm text-green-700">Your Advantages</div>
          </div>
          
          <div className="p-3 bg-gray-100 rounded-lg">
            <div className="text-2xl font-bold text-gray-600">
              {totalAdvantages.ties}
            </div>
            <div className="text-sm text-gray-700">Ties</div>
          </div>
          
          <div className="p-3 bg-red-100 rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {totalAdvantages.opponent}
            </div>
            <div className="text-sm text-red-700">Opponent Advantages</div>
          </div>
        </div>

        {/* Special Bonuses Summary */}
        {(playerAnalysis.synergies.length > 0 || opponentAnalysis.synergies.length > 0) && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="text-md font-semibold text-gray-700 mb-2 text-center">
              Special Synergies
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Player Synergies */}
              <div>
                <div className="text-sm font-semibold text-green-700 mb-1">Your Synergies:</div>
                {playerAnalysis.synergies.length > 0 ? (
                  <div className="space-y-1">
                    {playerAnalysis.synergies.slice(0, 3).map((synergy, index) => (
                      <div key={index} className="text-xs bg-green-50 text-green-800 px-2 py-1 rounded">
                        {synergy}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">No active synergies</div>
                )}
              </div>

              {/* Opponent Synergies */}
              <div>
                <div className="text-sm font-semibold text-red-700 mb-1">Opponent Synergies:</div>
                {opponentAnalysis.synergies.length > 0 ? (
                  <div className="space-y-1">
                    {opponentAnalysis.synergies.slice(0, 3).map((synergy, index) => (
                      <div key={index} className="text-xs bg-red-50 text-red-800 px-2 py-1 rounded">
                        {synergy}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">No active synergies</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}