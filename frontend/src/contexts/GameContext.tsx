'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { GameState, GamePiece, Position, BattleResult, DraftState, BattleEvent } from '@aquarium/shared-types';
import { io, Socket } from 'socket.io-client';
import { SOCKET_EVENTS } from '@aquarium/shared-types';
import { DraftStateManager } from '../utils/draftStateManager';

interface GameContextType {
  gameState: GameState | null;
  socket: Socket | null;
  connected: boolean;
  calculatedStats: { [pieceId: string]: { attack: number; health: number; speed: number } } | null;
  hasDraftState: boolean;
  draftStateAge: number | null;
  
  // Actions
  purchasePiece: (pieceId: string, shopIndex: number) => void;
  sellPiece: (pieceId: string) => void;
  placePiece: (piece: GamePiece, position: Position) => void;
  movePiece: (pieceId: string, position: Position) => void;
  rerollShop: () => void;
  startBattle: () => void;
  toggleShopLock: (index: number) => void;
  
  // Phase transitions
  enterPlacementPhase: () => void;
  enterBattlePhase: () => void;
  
  // Draft state management
  saveDraftState: () => void;
  restoreDraftState: () => void;
  clearDraftState: () => void;
  confirmPlacement: () => void;
  getStoredDraftData: () => any;
  requestStatCalculation: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [calculatedStats, setCalculatedStats] = useState<{ [pieceId: string]: { attack: number; health: number; speed: number } } | null>(null);
  const [hasDraftState, setHasDraftState] = useState(false);
  const [draftStateAge, setDraftStateAge] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const hasAttemptedRestore = useRef(false);
  
  // Get or create persistent player ID
  const getOrCreatePlayerId = () => {
    const PLAYER_ID_KEY = 'aquarium-player-id';
    let playerId = localStorage.getItem(PLAYER_ID_KEY);
    if (!playerId) {
      playerId = 'player-' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem(PLAYER_ID_KEY, playerId);
      console.log('🆕 Created new persistent player ID:', playerId);
    } else {
      console.log('♻️ Using existing player ID:', playerId);
    }
    return playerId;
  };

  useEffect(() => {
    // Initialize socket connection
    const socketInstance = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001', {
      transports: ['websocket'],
    });

    socketInstance.on('connect', () => {
      console.log('Connected to game server');
      setConnected(true);
      
      // Initialize session with persistent player ID
      const playerId = getOrCreatePlayerId();
      socketInstance.emit(SOCKET_EVENTS.SESSION_INIT, {
        playerId: playerId,
      });
    });

    socketInstance.on('disconnect', () => {
      console.log('Disconnected from game server');
      setConnected(false);
    });

    socketInstance.on(SOCKET_EVENTS.GAME_STATE_UPDATE, (state: GameState) => {
      console.log('🔄 GAME STATE UPDATE:', {
        gold: state.gold,
        shopItems: state.shop.length,
        tankPieces: state.playerTank.pieces.length,
        lockedIndex: state.lockedShopIndex,
        phase: state.phase
      });
      console.log('🏪 Shop contents:', state.shop.map((piece, i) => piece ? `${i}: ${piece.name}` : `${i}: empty`));
      console.log('🐟 Tank pieces:', state.playerTank.pieces.map(p => `${p.name} at ${p.position ? `(${p.position.x},${p.position.y})` : 'no position'}`));
      setGameState(state);
      
      // Update session ID for draft state management
      if (!sessionId) {
        const newSessionId = state.playerTank.id;
        setSessionId(newSessionId);
        
        // Auto-restore draft state from server on page refresh (only once per component mount)
        if (!hasAttemptedRestore.current) {
          hasAttemptedRestore.current = true;
          setTimeout(() => {
            console.log('🔄 Requesting draft state restore from server');
            socketInstance.emit(SOCKET_EVENTS.RESTORE_DRAFT_STATE);
          }, 1000); // Small delay to ensure connection is stable
        }
      }
      
      // Request updated stats after game state changes
      socketInstance.emit(SOCKET_EVENTS.GET_CALCULATED_STATS);
    });

    socketInstance.on(SOCKET_EVENTS.ERROR, (error: any) => {
      console.error('❌ WEBSOCKET ERROR:', error);
    });

    // Handle calculated stats updates
    socketInstance.on(SOCKET_EVENTS.CALCULATED_STATS_UPDATE, (stats: { [pieceId: string]: { attack: number; health: number; speed: number } }) => {
      console.log('📊 CALCULATED STATS UPDATE:', stats);
      setCalculatedStats(stats);
    });

    // Handle draft state events
    socketInstance.on(SOCKET_EVENTS.DRAFT_STATE_SAVED, (draftState: DraftState) => {
      console.log('💾 DRAFT STATE SAVED:', draftState);
      
      // Update the current game state to include the saved draft state
      setGameState(prevState => {
        if (!prevState) return prevState;
        return {
          ...prevState,
          draftState: draftState
        };
      });
      
      if (sessionId) {
        DraftStateManager.saveDraftState(sessionId, draftState);
        updateDraftStateStatus();
      }
    });

    // Handle battle events
    socketInstance.on(SOCKET_EVENTS.BATTLE_STEP, (event: any) => {
      console.log('⚔️ BATTLE STEP:', {
        type: event.type,
        description: event.description,
        round: event.round,
        turn: event.turn,
        value: event.value,
        source: event.sourceName,
        target: event.targetName
      });
      
      // Update game state to reflect the battle event
      setGameState(prevState => {
        if (!prevState || !prevState.battleState) return prevState;
        
        const updatedBattleState = {
          ...prevState.battleState,
          events: [...prevState.battleState.events, event],
        };
        
        return {
          ...prevState,
          battleState: updatedBattleState,
        };
      });
    });

    socketInstance.on(SOCKET_EVENTS.BATTLE_COMPLETE, (result: any) => {
      console.log('🏁 BATTLE COMPLETE:', {
        winner: result.result,
        playerRewards: result.rewards?.playerGold,
        opponentRewards: result.rewards?.opponentGold,
        playerInterest: result.rewards?.playerInterest,
        opponentInterest: result.rewards?.opponentInterest
      });
      
      // Update game state with final battle result
      setGameState(prevState => {
        if (!prevState || !prevState.battleState) return prevState;
        
        const updatedBattleState = {
          ...prevState.battleState,
          active: false,
          winner: result.result,
        };
        
        return {
          ...prevState,
          battleState: updatedBattleState,
        };
      });
    });

    socketInstance.on(SOCKET_EVENTS.PHASE_CHANGED, (data: { phase: string }) => {
      console.log('🔄 PHASE CHANGED:', data.phase);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // Helper function to update draft state status
  const updateDraftStateStatus = () => {
    if (sessionId) {
      setHasDraftState(DraftStateManager.hasDraftState(sessionId));
      setDraftStateAge(DraftStateManager.getDraftStateAge(sessionId));
    }
  };

  // Update draft state status when sessionId changes
  useEffect(() => {
    updateDraftStateStatus();
  }, [sessionId]);

  const purchasePiece = (pieceId: string, shopIndex: number) => {
    if (!socket || !connected || !gameState) return;
    
    const purchaseData = {
      sessionId: gameState.playerTank.id,
      playerId: gameState.playerTank.id,
      pieceId,
      shopIndex,
    };
    
    console.log('🛒 PURCHASE REQUEST:', purchaseData);
    console.log('💰 Current Gold:', gameState.gold);
    console.log('🏪 Shop Item:', gameState.shop[shopIndex]);
    
    socket.emit(SOCKET_EVENTS.SHOP_BUY, purchaseData);
  };

  const sellPiece = (pieceId: string) => {
    if (!socket || !connected || !gameState) return;
    
    socket.emit(SOCKET_EVENTS.SHOP_SELL, {
      sessionId: gameState.playerTank.id,
      playerId: gameState.playerTank.id,
      pieceId,
    });
  };

  const placePiece = (piece: GamePiece, position: Position) => {
    if (!socket || !connected || !gameState) return;
    
    const placeData = {
      sessionId: gameState.playerTank.id,
      playerId: gameState.playerTank.id,
      pieceId: piece.id,
      position,
      action: 'place' as const,
    };
    
    console.log('🎯 PLACE REQUEST:', placeData);
    console.log('🐠 Piece to place:', piece);
    console.log('📍 Position:', position);
    console.log('🔷 Piece shape:', piece.shape);
    
    socket.emit(SOCKET_EVENTS.TANK_UPDATE, placeData);
  };

  const movePiece = (pieceId: string, position: Position) => {
    if (!socket || !connected || !gameState) return;
    
    socket.emit(SOCKET_EVENTS.TANK_UPDATE, {
      sessionId: gameState.playerTank.id,
      playerId: gameState.playerTank.id,
      pieceId,
      position,
      action: 'move',
    });
  };

  const rerollShop = () => {
    if (!socket || !connected || !gameState) return;
    
    socket.emit(SOCKET_EVENTS.SHOP_REROLL, {
      sessionId: gameState.playerTank.id,
      playerId: gameState.playerTank.id,
    });
  };

  const startBattle = () => {
    if (!socket || !connected || !gameState) return;
    
    socket.emit(SOCKET_EVENTS.BATTLE_START, {
      sessionId: gameState.playerTank.id,
      playerId: gameState.playerTank.id,
    });
  };

  const toggleShopLock = (index: number) => {
    if (!socket || !connected || !gameState) return;
    
    socket.emit(SOCKET_EVENTS.SHOP_LOCK, {
      sessionId: gameState.playerTank.id,
      playerId: gameState.playerTank.id,
      shopIndex: index,
    });
  };

  // Draft state management functions
  const saveDraftState = () => {
    if (!socket || !connected) return;
    socket.emit(SOCKET_EVENTS.SAVE_DRAFT_STATE);
  };

  const restoreDraftState = () => {
    if (!socket || !connected) return;
    
    console.log('🔄 Manually requesting draft state restore from server');
    socket.emit(SOCKET_EVENTS.RESTORE_DRAFT_STATE);
  };

  const clearDraftState = () => {
    if (!socket || !connected) return;
    
    // Clear on server side
    socket.emit('draft:clear');
    console.log('🗑️ Clearing draft state on server');
  };

  const getStoredDraftData = () => {
    if (!gameState?.draftState) return null;
    return {
      gameState: gameState.draftState,
      lastModified: new Date(gameState.draftState.lastModified).toLocaleString(),
      pieceCount: gameState.draftState.playerTank?.pieces?.length || 0,
      placedPieces: gameState.draftState.playerTank?.pieces?.filter(p => p.position)?.length || 0,
      gold: gameState.draftState.gold || 0,
      round: gameState.draftState.round || 1
    };
  };

  const confirmPlacement = () => {
    if (!socket || !connected || !gameState) return;
    
    // Save entire game state snapshot to server (excluding nested draftState)
    const { draftState: _, ...gameStateWithoutDraft } = gameState;
    const draftState = {
      ...gameStateWithoutDraft,
      lastModified: Date.now()
    };
    
    socket.emit(SOCKET_EVENTS.SAVE_DRAFT_STATE, { draftState });
    console.log('✅ Complete game state saved to server');
  };

  const requestStatCalculation = () => {
    if (!socket || !connected) return;
    socket.emit(SOCKET_EVENTS.GET_CALCULATED_STATS);
  };

  // Phase transition functions
  const enterPlacementPhase = () => {
    if (!socket || !connected || !gameState) return;
    
    socket.emit(SOCKET_EVENTS.ENTER_PLACEMENT_PHASE, {
      sessionId: gameState.playerTank.id,
      playerId: gameState.playerTank.id,
    });
  };

  const enterBattlePhase = () => {
    if (!socket || !connected || !gameState) return;
    
    socket.emit(SOCKET_EVENTS.ENTER_BATTLE_PHASE, {
      sessionId: gameState.playerTank.id,
      playerId: gameState.playerTank.id,
    });
  };

  return (
    <GameContext.Provider value={{
      gameState,
      socket,
      connected,
      calculatedStats,
      hasDraftState,
      draftStateAge,
      purchasePiece,
      sellPiece,
      placePiece,
      movePiece,
      rerollShop,
      startBattle,
      toggleShopLock,
      enterPlacementPhase,
      enterBattlePhase,
      saveDraftState,
      restoreDraftState,
      clearDraftState,
      confirmPlacement,
      getStoredDraftData,
      requestStatCalculation,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}