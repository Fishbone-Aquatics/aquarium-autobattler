import { Injectable } from '@nestjs/common';
import { GameState, GamePiece, Tank, BattleState, BattleEvent, BattlePiece } from '@aquarium/shared-types';
import { v4 as uuidv4 } from 'uuid';

// Game constants
const MAX_ROUNDS = 15;

// Type for battle pieces with team information
interface BattlePieceWithTeam extends BattlePiece {
  team: 'player' | 'opponent';
}

@Injectable()
export class BattleService {

  initializeBattleState(gameState: GameState, calculatePieceStats: (piece: GamePiece, allPieces: GamePiece[]) => any): BattleState {
    const playerPieces = this.convertToBattlePieces(gameState.playerTank.pieces, calculatePieceStats);
    const opponentPieces = this.convertToBattlePieces(gameState.opponentTank.pieces, calculatePieceStats);

    const playerMaxHealth = playerPieces.reduce((sum, p) => sum + p.stats.maxHealth, 0);
    const opponentMaxHealth = opponentPieces.reduce((sum, p) => sum + p.stats.maxHealth, 0);

    return {
      active: true,
      currentRound: 1,
      currentTurn: 1,
      playerHealth: playerMaxHealth,
      opponentHealth: opponentMaxHealth,
      playerMaxHealth,
      opponentMaxHealth,
      winner: null,
      events: [],
      playerPieces,
      opponentPieces,
      isGameComplete: gameState.round >= MAX_ROUNDS,
    };
  }

  convertToBattlePieces(pieces: GamePiece[], calculatePieceStats: (piece: GamePiece, allPieces: GamePiece[]) => any): BattlePiece[] {
    const placedPieces = pieces.filter(p => p.position);
    
    return placedPieces.map(piece => {
      // Calculate buffed stats for battle (same logic as calculatePieceStats)
      const buffedStats = calculatePieceStats(piece, placedPieces);
      
      return {
        ...piece,
        stats: {
          ...buffedStats,
          maxHealth: buffedStats.health // Store calculated health as maxHealth
        },
        currentHealth: buffedStats.health,
        isDead: false,
        statusEffects: [],
        nextActionTime: 0,
      };
    });
  }

  simulateBattle(playerTank: Tank, opponentTank: Tank): any {
    const playerPower = playerTank.pieces.reduce((sum, p) => sum + p.stats.attack + p.stats.health, 0);
    const opponentPower = opponentTank.pieces.reduce((sum, p) => sum + p.stats.attack + p.stats.health, 0);
    
    const winner = playerPower > opponentPower ? 'player' : 
                   opponentPower > playerPower ? 'opponent' : 'draw';
    
    return {
      winner,
      events: [],
    };
  }

  processBattleTurn(
    battleState: BattleState,
    playerWaterQuality: number,
    opponentWaterQuality: number,
    gameState: GameState
  ): BattleEvent[] {
    const turnEvents = [];

    // Add round start event
    const roundEvent: BattleEvent = {
      id: uuidv4(),
      type: 'round_start',
      source: 'system',
      value: 0,
      round: battleState.currentRound,
      turn: battleState.currentTurn,
      timestamp: Date.now(),
      description: `--- Turn ${battleState.currentTurn} ---`,
    };
    
    battleState.events.push(roundEvent);
    turnEvents.push(roundEvent);

    // Apply poison damage for dirty water at start of turn (quality 1-3)
    if (playerWaterQuality <= 3) {
      const poisonedFish = battleState.playerPieces.filter(p => !p.isDead && p.type === 'fish');
      for (const fish of poisonedFish) {
        const poisonDamage = 1; // Fixed poison damage
        fish.currentHealth = Math.max(0, fish.currentHealth - poisonDamage);
        const fishDied = fish.currentHealth === 0;
        if (fishDied) {
          fish.isDead = true;
        }

        const poisonEvent: BattleEvent = {
          id: uuidv4(),
          type: 'damage',
          source: 'poison',
          targetName: fish.name,
          value: poisonDamage,
          round: battleState.currentRound,
          turn: battleState.currentTurn,
          timestamp: Date.now(),
          description: `☠️ ${fish.name} takes ${poisonDamage} poison damage from dirty water (Quality ${playerWaterQuality})${fishDied ? ' and dies!' : ` → ${fish.currentHealth}/${fish.stats.maxHealth} HP left`}`,
        };

        battleState.events.push(poisonEvent);
        turnEvents.push(poisonEvent);
      }
    }

    if (opponentWaterQuality <= 3) {
      const poisonedFish = battleState.opponentPieces.filter(p => !p.isDead && p.type === 'fish');
      for (const fish of poisonedFish) {
        const poisonDamage = 1; // Fixed poison damage
        fish.currentHealth = Math.max(0, fish.currentHealth - poisonDamage);
        const fishDied = fish.currentHealth === 0;
        if (fishDied) {
          fish.isDead = true;
        }

        const poisonEvent: BattleEvent = {
          id: uuidv4(),
          type: 'damage',
          source: 'poison',
          targetName: fish.name,
          value: poisonDamage,
          round: battleState.currentRound,
          turn: battleState.currentTurn,
          timestamp: Date.now(),
          description: `☠️ ${fish.name} takes ${poisonDamage} poison damage from dirty water (Quality ${opponentWaterQuality})${fishDied ? ' and dies!' : ` → ${fish.currentHealth}/${fish.stats.maxHealth} HP left`}`,
        };

        battleState.events.push(poisonEvent);
        turnEvents.push(poisonEvent);
      }
    }

    // Get all alive pieces from both sides (only fish can attack - plants and equipment are passive)
    const alivePieces: BattlePieceWithTeam[] = [
      ...battleState.playerPieces.filter(p => !p.isDead && p.type === 'fish').map(p => ({ ...p, team: 'player' as const })),
      ...battleState.opponentPieces.filter(p => !p.isDead && p.type === 'fish').map(p => ({ ...p, team: 'opponent' as const }))
    ];

    // Check if no attacking pieces left on either side - this is a DOUBLE LOSS
    if (alivePieces.length === 0) {
      // Double loss scenario - neither player can attack
      const doubleLossEvent: BattleEvent = {
        id: uuidv4(),
        type: 'round_start',
        source: 'system',
        value: 0,
        round: battleState.currentRound,
        turn: battleState.currentTurn,
        timestamp: Date.now(),
        description: `⚠️ No attacking units remain! Both players lose!`,
        healthStates: {
          playerHealth: 0,
          opponentHealth: 0,
        },
      };
      
      battleState.events.push(doubleLossEvent);
      turnEvents.push(doubleLossEvent);
      
      // Set both HP to 0 to indicate double loss
      battleState.playerHealth = 0;
      battleState.opponentHealth = 0;
      
      // Double loss is technically a draw (both lose)
      battleState.winner = 'draw';
      battleState.active = false;
      
      return turnEvents;
    }

    // Sort by speed (highest first), then by random for ties
    alivePieces.sort((a, b) => {
      if (b.stats.speed !== a.stats.speed) {
        return b.stats.speed - a.stats.speed;
      }
      return Math.random() - 0.5; // Random tiebreaker
    });

    // Each piece attacks in speed order
    for (const attacker of alivePieces) {
      // Skip if this attacker died earlier in this turn
      const attackerBattlePieces = attacker.team === 'player' 
        ? battleState.playerPieces 
        : battleState.opponentPieces;
      
      const currentAttacker = attackerBattlePieces.find(p => p.id === attacker.id);
      if (!currentAttacker || currentAttacker.isDead) {
        continue; // This attacker died earlier in this turn, skip
      }
      
      // Get current alive enemies with team information
      const enemies: BattlePieceWithTeam[] = attacker.team === 'player' 
        ? battleState.opponentPieces.filter(p => !p.isDead).map(p => ({ ...p, team: 'opponent' as const }))
        : battleState.playerPieces.filter(p => !p.isDead).map(p => ({ ...p, team: 'player' as const }));

      if (enemies.length === 0) {
        break; // No enemies left, battle is over
      }

      // Select target (random for now, could be strategic later)
      const target = enemies[Math.floor(Math.random() * enemies.length)];

      // Calculate detailed damage with proper base/bonus breakdown
      const originalPiece = attacker.team === 'player' 
        ? gameState.playerTank.pieces.find(p => p.id === attacker.id)
        : gameState.opponentTank.pieces.find(p => p.id === attacker.id);
      
      const baseDamage = originalPiece?.stats.attack || attacker.stats.attack;
      const attackBonus = attacker.stats.attack - baseDamage; // Calculate bonus from adjacency/schooling
      const waterQuality = attacker.team === 'player' ? playerWaterQuality : opponentWaterQuality;
      
      // Water quality damage modifiers
      let waterMultiplier = 1.0; // Default no bonus/penalty
      if (waterQuality >= 8) {
        waterMultiplier = 1.3; // +30% damage for excellent water (8-10)
      } else if (waterQuality <= 3) {
        waterMultiplier = 0.7; // -30% damage for poor water (1-3)
      }
      
      const baseAttackDamage = attacker.stats.attack;
      const waterModifiedDamage = Math.floor(baseAttackDamage * waterMultiplier);
      const waterBonus = waterModifiedDamage - baseAttackDamage; // Show the actual bonus/penalty
      const finalDamage = waterModifiedDamage;

      // Find the actual battleState piece to update (not the local copy)
      const battleStatePieces = target.team === 'player' 
        ? battleState.playerPieces 
        : battleState.opponentPieces;
      
      const battlePiece = battleStatePieces.find(p => p.id === target.id);
      if (!battlePiece) {
        console.error(`Could not find battle piece with id ${target.id}`);
        continue;
      }

      // Apply damage to the actual battleState piece
      const damageDealt = Math.min(finalDamage, battlePiece.currentHealth);
      battlePiece.currentHealth = Math.max(0, battlePiece.currentHealth - finalDamage);
      
      // Check if target died
      const targetDied = battlePiece.currentHealth <= 0;
      if (targetDied) {
        battlePiece.isDead = true;
        
        // Also mark the original tank piece as dead for visual display
        const originalTankPieces = target.team === 'player' 
          ? gameState.playerTank.pieces 
          : gameState.opponentTank.pieces;
        
        const originalPiece = originalTankPieces.find(p => p.id === target.id);
        if (originalPiece) {
          (originalPiece as any).isDead = true;
        }
      }

      // UPDATE: Recalculate tank health immediately after each attack
      const currentPlayerHealth = battleState.playerPieces
        .filter(p => !p.isDead)
        .reduce((sum, p) => sum + p.currentHealth, 0);
      
      const currentOpponentHealth = battleState.opponentPieces
        .filter(p => !p.isDead)
        .reduce((sum, p) => sum + p.currentHealth, 0);

      // Update battleState health values immediately
      battleState.playerHealth = currentPlayerHealth;
      battleState.opponentHealth = currentOpponentHealth;

      // Create detailed attack event with health states
      const attackEvent: BattleEvent = {
        id: uuidv4(),
        type: 'attack',
        source: attacker.team === 'player' ? 'player-piece' : 'opponent-piece',
        sourceName: attacker.name,
        target: attacker.team === 'player' ? 'opponent-piece' : 'player-piece',
        targetName: target.name,
        value: damageDealt,
        round: battleState.currentRound,
        turn: battleState.currentTurn,
        timestamp: Date.now(),
        description: `${attacker.team === 'player' ? '🟢' : '🔴'} ${attacker.name} (Speed ${attacker.stats.speed}) attacks ${target.team === 'player' ? '🟢' : '🔴'} ${target.name}! ${baseDamage} base attack${attackBonus > 0 ? ` + ${attackBonus} bonuses` : ''}${waterBonus !== 0 ? (waterBonus > 0 ? ` + ${waterBonus} water quality` : ` - ${Math.abs(waterBonus)} water quality`) : ''} = ${finalDamage} damage → ${target.name} ${targetDied ? 'is KO\'d!' : `has ${battlePiece.currentHealth}/${battlePiece.stats.maxHealth} HP left`}`,
        // Include real-time health states for frontend updates (using immediately calculated values)
        healthStates: {
          playerHealth: currentPlayerHealth,
          opponentHealth: currentOpponentHealth,
          targetPieceId: target.id,
          targetCurrentHealth: battlePiece.currentHealth,
          targetMaxHealth: battlePiece.stats.maxHealth,
          targetDied: targetDied
        }
      };
      
      battleState.events.push(attackEvent);
      turnEvents.push(attackEvent);

      // Add death event if target died
      if (targetDied) {
        const deathEvent: BattleEvent = {
          id: uuidv4(),
          type: 'death',
          source: 'system',
          sourceName: target.name,
          target: attacker.team === 'player' ? 'opponent-team' : 'player-team',
          targetName: attacker.team === 'player' ? 'Opponent' : 'You',
          value: 0,
          round: battleState.currentRound,
          turn: battleState.currentTurn,
          timestamp: Date.now(),
          description: `💀 ${target.team === 'player' ? '🟢' : '🔴'} ${target.name} has been defeated!`,
        };
        
        battleState.events.push(deathEvent);
        turnEvents.push(deathEvent);
      }
    }

    // Update tank health based on remaining pieces
    battleState.playerHealth = battleState.playerPieces
      .filter(p => !p.isDead)
      .reduce((sum, p) => sum + p.currentHealth, 0);
    
    battleState.opponentHealth = battleState.opponentPieces
      .filter(p => !p.isDead)
      .reduce((sum, p) => sum + p.currentHealth, 0);

    // Check for winner
    if (battleState.playerHealth <= 0) {
      battleState.winner = 'opponent';
      battleState.active = false;
    } else if (battleState.opponentHealth <= 0) {
      battleState.winner = 'player';
      battleState.active = false;
    } else if (battleState.currentTurn >= 20) {
      battleState.winner = 'draw';
      battleState.active = false;
    }

    battleState.currentTurn++;

    return turnEvents;
  }
}