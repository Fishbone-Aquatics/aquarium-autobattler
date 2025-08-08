'use client';

import React from 'react';
import { Fish, Waves } from 'lucide-react';

interface HeaderProps {
  gold: number;
  opponentGold: number;
  round: number;
  wins: number;
  losses: number;
  lossStreak: number;
  opponentLossStreak: number;
}

export function Header({
  gold,
  opponentGold,
  round,
  wins,
  losses,
  lossStreak,
  opponentLossStreak,
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
            <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-3 py-1 rounded-full font-bold">
              <span>💰</span>
              <span>{gold}g</span>
              {nextInterest > 0 && (
                <span className="text-yellow-200 text-xs ml-1" title={`Interest: +${nextInterest}g next round (1g per 10g held, max 5g)`}>
                  (+{nextInterest})
                </span>
              )}
              {lossStreak > 0 && (
                <span className="text-red-200 text-xs ml-1">
                  (L{lossStreak})
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2 bg-gradient-to-r from-red-400 to-pink-400 text-white px-3 py-1 rounded-full font-bold">
              <span>🤖</span>
              <span>{opponentGold}g</span>
              {opponentLossStreak > 0 && (
                <span className="text-red-200 text-xs ml-1">
                  (L{opponentLossStreak})
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