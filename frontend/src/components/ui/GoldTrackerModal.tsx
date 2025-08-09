'use client';

import React from 'react';
import { GoldTransaction } from '@aquarium/shared-types';
import { X, TrendingUp, TrendingDown, Clock } from 'lucide-react';

interface GoldTrackerModalProps {
  goldHistory: GoldTransaction[];
  currentGold: number;
  isOpen: boolean;
  onClose: () => void;
}

const getTransactionIcon = (type: string, amount: number) => {
  const isPositive = amount > 0;
  
  switch (type) {
    case 'purchase':
      return '🛒';
    case 'sell':
      return '💰';
    case 'reroll':
      return '🎲';
    case 'battle_reward':
      return isPositive ? '🏆' : '💀';
    case 'loss_streak_bonus':
      return '📈';
    case 'interest':
      return '🏪';
    case 'round_start':
      return '🌅';
    default:
      return isPositive ? '➕' : '➖';
  }
};

const getTransactionColor = (type: string, amount: number) => {
  if (amount > 0) {
    return 'text-green-600';
  } else if (amount < 0) {
    return 'text-red-600';
  }
  return 'text-gray-600';
};

const getTransactionBg = (type: string, amount: number) => {
  if (amount > 0) {
    return 'bg-green-50 hover:bg-green-100';
  } else if (amount < 0) {
    return 'bg-red-50 hover:bg-red-100';
  }
  return 'bg-gray-50 hover:bg-gray-100';
};

export function GoldTrackerModal({ goldHistory, currentGold, isOpen, onClose }: GoldTrackerModalProps) {
  if (!isOpen) return null;

  // Sort transactions by timestamp (most recent first)
  const sortedHistory = [...goldHistory].sort((a, b) => b.timestamp - a.timestamp);
  
  // Calculate summary stats
  const totalGained = goldHistory.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
  const totalSpent = Math.abs(goldHistory.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0));
  
  // Group by round for better organization
  const roundGroups = sortedHistory.reduce((groups: { [key: number]: GoldTransaction[] }, transaction) => {
    const round = transaction.round;
    if (!groups[round]) {
      groups[round] = [];
    }
    groups[round].push(transaction);
    return groups;
  }, {});

  const rounds = Object.keys(roundGroups).map(Number).sort((a, b) => b - a);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-yellow-50 to-amber-50">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💰</span>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Gold Transaction History</h2>
              <p className="text-sm text-gray-600">Current Balance: <span className="font-semibold text-yellow-700">{currentGold}g</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/50 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Summary Stats */}
        <div className="p-6 border-b bg-gray-50 grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="font-semibold">Total Gained</span>
            </div>
            <div className="text-xl font-bold text-green-700">+{totalGained}g</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-red-600 mb-1">
              <TrendingDown className="w-4 h-4" />
              <span className="font-semibold">Total Spent</span>
            </div>
            <div className="text-xl font-bold text-red-700">-{totalSpent}g</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
              <Clock className="w-4 h-4" />
              <span className="font-semibold">Net Change</span>
            </div>
            <div className={`text-xl font-bold ${totalGained - totalSpent >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {totalGained - totalSpent >= 0 ? '+' : ''}{totalGained - totalSpent}g
            </div>
          </div>
        </div>

        {/* Transaction List */}
        <div className="flex-1 overflow-y-auto p-6">
          {sortedHistory.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <span className="text-4xl mb-4 block">🏪</span>
              <p className="text-lg font-medium">No transactions yet</p>
              <p className="text-sm">Start buying, selling, or battling to see your gold history!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {rounds.map(round => (
                <div key={round}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                      Round {round}
                    </div>
                    <div className="flex-1 border-t border-gray-200"></div>
                    <div className="text-xs text-gray-500">
                      {roundGroups[round].length} transaction{roundGroups[round].length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  
                  <div className="space-y-2 ml-4">
                    {roundGroups[round].map((transaction) => {
                      const isPositive = transaction.amount > 0;
                      const icon = getTransactionIcon(transaction.type, transaction.amount);
                      const textColor = getTransactionColor(transaction.type, transaction.amount);
                      const bgColor = getTransactionBg(transaction.type, transaction.amount);
                      
                      return (
                        <div
                          key={transaction.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border ${bgColor} transition-all`}
                        >
                          <span className="text-lg flex-shrink-0">{icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-gray-800 truncate">
                                {transaction.description}
                              </span>
                              <span className={`font-bold text-lg ${textColor} flex-shrink-0 ml-3`}>
                                {isPositive ? '+' : ''}{transaction.amount}g
                              </span>
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(transaction.timestamp).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 text-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}