import { Injectable } from '@nestjs/common';
import { GamePiece } from '@aquarium/shared-types';
import { PIECE_LIBRARY } from '../app/data/pieces';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class EconomyService {

  generateShop(existingShop?: (GamePiece | null)[], lockedIndex?: number | null): (GamePiece | null)[] {
    const shopSize = 6;
    const shop: (GamePiece | null)[] = [];
    
    for (let i = 0; i < shopSize; i++) {
      // Preserve locked item if this is the locked index
      if (lockedIndex !== null && lockedIndex === i && existingShop && existingShop[i]) {
        shop.push(existingShop[i]);
        console.log(`🔒 Preserving locked item at index ${i}: ${existingShop[i]?.name}`);
      } else {
        const piece = this.getRandomPiece();
        shop.push(piece ? { ...piece, id: uuidv4() } : null);
      }
    }
    
    return shop;
  }

  private getRandomPiece(): GamePiece | null {
    const pieces = [...PIECE_LIBRARY];
    return pieces[Math.floor(Math.random() * pieces.length)] || null;
  }

  calculateInterest(currentGold: number): number {
    // Interest is 10% of gold (rounded down), capped at 5 gold
    return Math.min(Math.floor(currentGold / 10), 5);
  }

  calculateGoldReward(isWinner: boolean): number {
    // Base reward is 5 gold regardless of win/loss
    return 5;
  }

  calculateLossStreakBonus(lossStreak: number): number {
    // Loss streak bonuses: 2/4/6/8/10/12 gold
    if (lossStreak === 1) return 2;
    if (lossStreak === 2) return 4;
    if (lossStreak === 3) return 6;
    if (lossStreak === 4) return 8;
    if (lossStreak === 5) return 10;
    if (lossStreak >= 6) return 12;
    return 0;
  }

  calculateWinStreakBonus(winStreak: number): number {
    // Win streak bonuses: 1/2/3/4 gold
    if (winStreak === 2) return 1;
    if (winStreak === 3) return 2;
    if (winStreak === 4) return 3;
    if (winStreak >= 5) return 4;
    return 0;
  }

  calculateRerollCost(rerollsThisRound: number): number {
    // Scaled reroll cost: base 2g, +1g per reroll after 5th
    const baseRerollCost = 2;
    const freeRerolls = 5;
    const extraCostPerReroll = 1;
    return baseRerollCost + Math.max(0, (rerollsThisRound - freeRerolls) * extraCostPerReroll);
  }

  formatRerollDescription(rerollNumber: number): string {
    const suffix = rerollNumber === 1 ? 'st' : 
                   rerollNumber === 2 ? 'nd' : 
                   rerollNumber === 3 ? 'rd' : 'th';
    return `Shop reroll (${rerollNumber}${suffix} this round)`;
  }

  calculateSellValue(cost: number): number {
    // Players get 75% of the original cost when selling
    const SELL_PERCENTAGE = 0.75;
    return Math.floor(cost * SELL_PERCENTAGE);
  }

  createGoldTransaction(
    round: number, 
    type: 'round_start' | 'purchase' | 'sell' | 'battle_reward' | 'loss_streak_bonus' | 'win_streak_bonus' | 'interest' | 'reroll',
    amount: number,
    description: string,
    pieceId?: string,
    pieceName?: string
  ) {
    const transaction = {
      id: uuidv4(),
      round,
      type,
      amount,
      description,
      timestamp: Date.now(),
      ...(pieceId && { pieceId }),
      ...(pieceName && { pieceName }),
    };
    
    return transaction;
  }
}