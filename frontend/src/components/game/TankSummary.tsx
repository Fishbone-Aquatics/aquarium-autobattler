'use client';

import React from 'react';
import { TankAnalysis } from '../../utils/tankAnalysis';

// Helper function to get water quality damage bonus text
const getWaterQualityBonus = (waterQuality: number) => {
  if (waterQuality >= 8) {
    return { text: '+30%', color: 'text-green-500', bgColor: 'bg-green-100' };
  } else if (waterQuality <= 3) {
    return { text: '-30%', color: 'text-red-500', bgColor: 'bg-red-100' };
  }
  return null;
};

interface TankSummaryProps {
  analysis: TankAnalysis;
  waterQuality: number;
  showDetailed?: boolean;
  className?: string;
}

export const TankSummary: React.FC<TankSummaryProps> = ({
  analysis,
  waterQuality,
  showDetailed = true,
  className = ""
}) => {
  const waterBonus = getWaterQualityBonus(waterQuality);
  
  return (
    <div className={`p-2 bg-gradient-to-r from-blue-50 to-teal-50 rounded-lg border border-blue-200 relative group ${className}`}>
      <h3 className="font-bold text-gray-900 mb-2 text-sm">Tank Summary</h3>
      <div className="grid grid-cols-3 gap-2 text-sm relative">
        <div className="text-center">
          <div className="text-lg font-bold text-red-600 cursor-help flex items-center justify-center gap-1">
            <span>{analysis.baseAttack}</span>
            {analysis.bonusAttack > 0 && <span className="text-green-500">(+{analysis.bonusAttack})</span>}
            {waterBonus && (
              <span className={`text-xs px-1 py-0.5 rounded-full ${waterBonus.bgColor} ${waterBonus.color} font-bold`} title="Water Quality Damage Bonus">
                {waterBonus.text}
              </span>
            )}
          </div>
          <div className="text-gray-600 text-xs">Total Attack</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-green-600 cursor-help flex items-center justify-center gap-1">
            <span>{analysis.baseHealth}</span>
            {analysis.bonusHealth > 0 && <span className="text-green-500">(+{analysis.bonusHealth})</span>}
          </div>
          <div className="text-gray-600 text-xs">Tank Health</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-blue-600 cursor-help flex items-center justify-center gap-1">
            <span>{analysis.baseAverageSpeed.toFixed(1)}</span>
            {analysis.bonusAverageSpeed > 0 && <span className="text-green-500">(+{analysis.bonusAverageSpeed.toFixed(1)})</span>}
          </div>
          <div className="text-gray-600 text-xs">Avg Speed</div>
        </div>
        
        {showDetailed && (
          <>
            {/* Detailed breakdown tooltip on hover */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-10">
              <div className="absolute -top-2 left-0 right-0 bg-gray-900 text-white p-3 rounded-lg shadow-xl text-xs max-h-64 overflow-y-auto">
                <div className="font-bold mb-2">Detailed Breakdown:</div>
                {analysis.pieceBreakdown.map((breakdown, index) => (
                  <div key={index} className="mb-2 pb-2 border-b border-gray-700 last:border-b-0">
                    <div className="font-semibold text-yellow-300">{breakdown.piece.name}</div>
                    <div className="flex gap-3 mt-1">
                      <span className="text-red-400">⚔️ {breakdown.originalStats.attack}{breakdown.bonuses.attack > 0 && ` (+${breakdown.bonuses.attack})`}</span>
                      <span className="text-green-400">❤️ {breakdown.originalStats.health}{breakdown.bonuses.health > 0 && ` (+${breakdown.bonuses.health})`}</span>
                      <span className="text-blue-400">⚡ {breakdown.originalStats.speed}{breakdown.bonuses.speed > 0 && ` (+${breakdown.bonuses.speed})`}</span>
                    </div>
                    {breakdown.activeBonuses.length > 0 && (
                      <div className="mt-1">
                        {breakdown.activeBonuses.map((bonus, bIndex) => (
                          <div key={bIndex} className={`text-xs ${bonus.color}`}>
                            {bonus.source}: {bonus.effect}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="col-span-3 mt-2 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Total Pieces: {analysis.totalPieces} | Fish: {analysis.fishCount}</span>
                <span>Water Quality: {waterQuality}/10</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};