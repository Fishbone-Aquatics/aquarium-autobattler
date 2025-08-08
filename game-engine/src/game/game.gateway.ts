import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS } from '@aquarium/shared-types';
import { GameService } from './game.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GameGateway.name);

  constructor(private readonly gameService: GameService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.gameService.removeSession(client.id);
  }

  @SubscribeMessage(SOCKET_EVENTS.SESSION_INIT)
  async handleSessionInit(
    @MessageBody() data: { playerId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const gameState = await this.gameService.createSession(client.id, data.playerId);
      
      client.emit(SOCKET_EVENTS.GAME_STATE_UPDATE, gameState);
      
      this.logger.log(`Session initialized for player: ${data.playerId}`);
    } catch (error) {
      client.emit(SOCKET_EVENTS.ERROR, {
        code: 'SESSION_INIT_FAILED',
        message: 'Failed to initialize game session',
        details: error.message,
      });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.SHOP_BUY)
  async handleShopBuy(
    @MessageBody() data: { pieceId: string; shopIndex: number },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const gameState = await this.gameService.purchasePiece(
        client.id,
        data.pieceId,
        data.shopIndex,
      );
      
      client.emit(SOCKET_EVENTS.GAME_STATE_UPDATE, gameState);
    } catch (error) {
      client.emit(SOCKET_EVENTS.ERROR, {
        code: 'PURCHASE_FAILED',
        message: error.message,
      });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.SHOP_REROLL)
  async handleShopReroll(@ConnectedSocket() client: Socket) {
    try {
      const gameState = await this.gameService.rerollShop(client.id);
      
      client.emit(SOCKET_EVENTS.GAME_STATE_UPDATE, gameState);
    } catch (error) {
      client.emit(SOCKET_EVENTS.ERROR, {
        code: 'REROLL_FAILED',
        message: error.message,
      });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.SHOP_SELL)
  async handleShopSell(
    @MessageBody() data: { pieceId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const gameState = await this.gameService.sellPiece(client.id, data.pieceId);
      
      client.emit(SOCKET_EVENTS.GAME_STATE_UPDATE, gameState);
    } catch (error) {
      client.emit(SOCKET_EVENTS.ERROR, {
        code: 'SELL_FAILED',
        message: error.message,
      });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.SHOP_LOCK)
  async handleShopLock(
    @MessageBody() data: { shopIndex: number },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const gameState = await this.gameService.toggleShopLock(client.id, data.shopIndex);
      
      client.emit(SOCKET_EVENTS.GAME_STATE_UPDATE, gameState);
    } catch (error) {
      client.emit(SOCKET_EVENTS.ERROR, {
        code: 'LOCK_FAILED',
        message: error.message,
      });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.TANK_UPDATE)
  async handleTankUpdate(
    @MessageBody() data: {
      pieceId: string;
      position: { x: number; y: number };
      action: 'place' | 'move' | 'remove';
    },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const gameState = await this.gameService.updateTankPiece(
        client.id,
        data.pieceId,
        data.position,
        data.action,
      );
      
      client.emit(SOCKET_EVENTS.GAME_STATE_UPDATE, gameState);
    } catch (error) {
      client.emit(SOCKET_EVENTS.ERROR, {
        code: 'TANK_UPDATE_FAILED',
        message: error.message,
      });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.BATTLE_START)
  async handleLegacyBattleStart(@ConnectedSocket() client: Socket) {
    try {
      // This is the legacy battle system - only generates events, no rewards
      const result = await this.gameService.simulateBattleEvents(client.id);
      
      // Emit battle events as they happen
      for (const event of result.events) {
        client.emit(SOCKET_EVENTS.BATTLE_STEP, event);
        await new Promise(resolve => setTimeout(resolve, 500)); // Delay for animation
      }
      
      // Emit final result with no rewards
      client.emit(SOCKET_EVENTS.BATTLE_COMPLETE, {
        result: result.winner,
        rewards: { playerGold: 0, playerInterest: 0, opponentGold: 0, opponentInterest: 0 },
      });
    } catch (error) {
      client.emit(SOCKET_EVENTS.ERROR, {
        code: 'LEGACY_BATTLE_FAILED',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('return:shop')
  async handleReturnToShop(@ConnectedSocket() client: Socket) {
    try {
      const gameState = await this.gameService.returnToShopPhase(client.id);
      client.emit(SOCKET_EVENTS.GAME_STATE_UPDATE, gameState);
    } catch (error) {
      client.emit(SOCKET_EVENTS.ERROR, {
        code: 'RETURN_TO_SHOP_FAILED',
        message: error.message,
      });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.GET_CALCULATED_STATS)
  async handleGetCalculatedStats(@ConnectedSocket() client: Socket) {
    try {
      const calculatedStats = await this.gameService.getCalculatedStats(client.id);
      
      client.emit(SOCKET_EVENTS.CALCULATED_STATS_UPDATE, calculatedStats);
    } catch (error) {
      client.emit(SOCKET_EVENTS.ERROR, {
        code: 'STATS_CALCULATION_FAILED',
        message: error.message,
      });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.SAVE_DRAFT_STATE)
  async handleSaveDraftState(
    @MessageBody() data: { draftState: any },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      await this.gameService.saveDraftState(client.id, data.draftState);
      
      client.emit(SOCKET_EVENTS.DRAFT_STATE_SAVED, data.draftState);
    } catch (error) {
      client.emit(SOCKET_EVENTS.ERROR, {
        code: 'DRAFT_SAVE_FAILED',
        message: error.message,
      });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.RESTORE_DRAFT_STATE)
  async handleRestoreDraftState(@ConnectedSocket() client: Socket) {
    try {
      const gameState = await this.gameService.restoreDraftState(client.id);
      
      client.emit(SOCKET_EVENTS.GAME_STATE_UPDATE, gameState);
    } catch (error) {
      client.emit(SOCKET_EVENTS.ERROR, {
        code: 'DRAFT_RESTORE_FAILED',
        message: error.message,
      });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.CONFIRM_PLACEMENT)
  async handleConfirmPlacement(@ConnectedSocket() client: Socket) {
    try {
      const gameState = await this.gameService.confirmPlacement(client.id);
      
      client.emit(SOCKET_EVENTS.GAME_STATE_UPDATE, gameState);
    } catch (error) {
      client.emit(SOCKET_EVENTS.ERROR, {
        code: 'PLACEMENT_CONFIRMATION_FAILED',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('draft:clear')
  async handleClearDraftState(@ConnectedSocket() client: Socket) {
    try {
      const gameState = await this.gameService.clearDraftState(client.id);
      
      client.emit(SOCKET_EVENTS.GAME_STATE_UPDATE, gameState);
    } catch (error) {
      client.emit(SOCKET_EVENTS.ERROR, {
        code: 'DRAFT_CLEAR_FAILED',
        message: error.message,
      });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.ENTER_PLACEMENT_PHASE)
  async handleEnterPlacementPhase(@ConnectedSocket() client: Socket) {
    try {
      const gameState = await this.gameService.enterPlacementPhase(client.id);
      
      client.emit(SOCKET_EVENTS.GAME_STATE_UPDATE, gameState);
      client.emit(SOCKET_EVENTS.PHASE_CHANGED, { phase: 'placement' });
    } catch (error) {
      client.emit(SOCKET_EVENTS.ERROR, {
        code: 'PHASE_TRANSITION_FAILED',
        message: error.message,
      });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.ENTER_BATTLE_PHASE)
  async handleEnterBattlePhase(@ConnectedSocket() client: Socket) {
    try {
      const gameState = await this.gameService.enterBattlePhase(client.id);
      
      client.emit(SOCKET_EVENTS.GAME_STATE_UPDATE, gameState);
      // Don't emit phase change - stay on placement screen
      
      // Start battle simulation with real-time updates
      this.runLiveBattleSimulation(client);
    } catch (error) {
      client.emit(SOCKET_EVENTS.ERROR, {
        code: 'PHASE_TRANSITION_FAILED',
        message: error.message,
      });
    }
  }

  private async runLiveBattleSimulation(client: Socket) {
    try {
      let gameState = await this.gameService.getSession(client.id);
      if (!gameState.battleState || !gameState.battleState.active) {
        return;
      }

      // Run battle simulation with delays for real-time effect
      while (gameState.battleState.active) {
        // Advance one turn
        const { gameState: updatedState, turnEvents } = await this.gameService.advanceBattleTurn(client.id);
        gameState = updatedState; // Update our local reference
        
        // Emit each event with a delay
        for (const event of turnEvents) {
          client.emit(SOCKET_EVENTS.BATTLE_STEP, event);
          await new Promise(resolve => setTimeout(resolve, 800)); // 800ms between events
        }
        
        // Update client with latest state
        client.emit(SOCKET_EVENTS.GAME_STATE_UPDATE, updatedState);
        
        // Check if battle is finished
        if (!updatedState.battleState?.active) {
          try {
            // Capture winner before any async operations to avoid race conditions
            const winner = updatedState.battleState?.winner;
            const events = updatedState.battleState?.events || [];
            
            this.logger.log(`🏁 Battle finished. Winner: ${winner}, Active: ${updatedState.battleState?.active}`);
            
            // Always finalize rewards for any battle outcome (win/loss/draw)
            if (winner) {
              const battleRewards = await this.gameService.finalizeBattleRewards(client.id);
              
              client.emit(SOCKET_EVENTS.BATTLE_COMPLETE, {
                result: winner,
                events: events,
                rewards: battleRewards.rewards,
                isGameComplete: battleRewards.isGameComplete,
              });
              
              // Send final game state - still in battle phase so user can see results
              const finalGameState = await this.gameService.getSession(client.id);
              client.emit(SOCKET_EVENTS.GAME_STATE_UPDATE, finalGameState);
            } else {
              // This should rarely happen - battle ended without determining outcome
              this.logger.warn('Battle ended without winner determination');
              client.emit(SOCKET_EVENTS.BATTLE_COMPLETE, {
                result: 'draw',
                events: events,
                rewards: { playerGold: 0, playerInterest: 0, opponentGold: 0, opponentInterest: 0 },
              });
            }
          } catch (error) {
            this.logger.error('Error finalizing battle rewards:', error.message);
            client.emit(SOCKET_EVENTS.ERROR, {
              code: 'BATTLE_FINALIZATION_FAILED',
              message: 'Failed to finalize battle rewards',
              details: error.message,
            });
          }
          break;
        }
        
        // Wait before next turn
        await new Promise(resolve => setTimeout(resolve, 1200));
      }
    } catch (error) {
      client.emit(SOCKET_EVENTS.ERROR, {
        code: 'BATTLE_SIMULATION_FAILED',
        message: 'Battle simulation encountered an error',
        details: error.message,
      });
    }
  }
}