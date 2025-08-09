'use client';

import React from 'react';
import { Fish, Waves, BarChart3 } from 'lucide-react';

interface HeaderProps {
  gold: number;
  opponentGold: number;
  round: number;
  wins: number;
  losses: number;
  lossStreak: number;
  winStreak: number;
  opponentLossStreak: number;
  opponentWinStreak: number;
  onOpenGoldTracker?: () => void;
}

export function Header({
  gold,
  opponentGold,
  round,
  wins,
  losses,
  lossStreak,
  winStreak,
  opponentLossStreak,
  opponentWinStreak,
  onOpenGoldTracker,
}: HeaderProps) {
  const nextInterest = Math.min(Math.floor(gold / 10), 5);
  const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;

  return (
    <header className="bg-white shadow-lg border-b-2 border-cyan-200">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Fish className="text-cyan-600" size={32} />
              <Waves className="absolute -bottom-1 -right-1 text-blue-400" size={16} />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                Aquarium Autobattler
              </h1>
              <p className="text-sm text-gray-600">Build • Battle • Breed</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6 text-sm">
            <button
              onClick={onOpenGoldTracker}
              className="flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-3 py-1 rounded-full font-bold hover:from-yellow-500 hover:to-orange-500 transition-all cursor-pointer group relative"
              title="Click to view gold transaction history"
            >
              <span>💰</span>
              <span>{gold}g</span>
              {nextInterest > 0 && (
                <span className="text-yellow-200 text-xs ml-1" title={`Interest: +${nextInterest}g next round (1g per 10g held, max 5g)`}>
                  (+{nextInterest})
                </span>
              )}
              {lossStreak > 0 && (
                <span className="text-red-200 text-xs ml-1" title={`Loss streak: ${lossStreak} ${lossStreak === 1 ? 'loss' : 'losses'} in a row (${lossStreak === 1 ? '+2g' : lossStreak === 2 ? '+4g' : lossStreak === 3 ? '+6g' : lossStreak === 4 ? '+8g' : lossStreak === 5 ? '+10g' : '+12g'} bonus)`}>
                  (L{lossStreak})
                </span>
              )}
              {winStreak >= 2 && (
                <span className="text-green-200 text-xs ml-1" title={`Win streak: ${winStreak} wins in a row! 🔥 (${winStreak === 2 ? '+1g' : winStreak === 3 ? '+2g' : winStreak === 4 ? '+3g' : '+4g'} bonus)`}>
                  (W{winStreak})
                </span>
              )}
              <BarChart3 className="w-3 h-3 ml-1 opacity-70 group-hover:opacity-100 transition-opacity" />
            </button>
            
            <div className="flex items-center gap-2 bg-gradient-to-r from-red-400 to-pink-400 text-white px-3 py-1 rounded-full font-bold">
              <span>🤖</span>
              <span>{opponentGold}g</span>
              {opponentLossStreak > 0 && (
                <span className="text-red-200 text-xs ml-1" title={`Opponent loss streak: ${opponentLossStreak} ${opponentLossStreak === 1 ? 'loss' : 'losses'} in a row (${opponentLossStreak === 1 ? '+2g' : opponentLossStreak === 2 ? '+4g' : opponentLossStreak === 3 ? '+6g' : opponentLossStreak === 4 ? '+8g' : opponentLossStreak === 5 ? '+10g' : '+12g'} bonus)`}>
                  (L{opponentLossStreak})
                </span>
              )}
              {opponentWinStreak >= 2 && (
                <span className="text-green-200 text-xs ml-1" title={`Opponent win streak: ${opponentWinStreak} wins in a row! 🔥 (${opponentWinStreak === 2 ? '+1g' : opponentWinStreak === 3 ? '+2g' : opponentWinStreak === 4 ? '+3g' : '+4g'} bonus)`}>
                  (W{opponentWinStreak})
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2 bg-gradient-to-r from-green-400 to-emerald-400 text-white px-3 py-1 rounded-full font-bold">
              <span>📊</span>
              <span>{wins}W-{losses}L-0D</span>
              {wins + losses > 0 && (
                <span className="text-green-100 text-xs ml-1">
                  ({winRate}%)
                </span>
              )}
            </div>
            
            <div className={`flex items-center gap-2 text-white px-3 py-1 rounded-full font-bold ${
              round === 15 
                ? 'bg-gradient-to-r from-yellow-400 to-orange-500 animate-pulse' 
                : 'bg-gradient-to-r from-purple-400 to-pink-400'
            }`}>
              <span>{round === 15 ? '👑' : '🏆'}</span>
              <span>{round === 15 ? 'FINAL BATTLE' : `Round ${round}/15`}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}