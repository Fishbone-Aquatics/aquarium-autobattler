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
  async handleBattleStart(@ConnectedSocket() client: Socket) {
    try {
      const result = await this.gameService.startBattle(client.id);
      
      // Emit battle events as they happen
      for (const event of result.events) {
        client.emit(SOCKET_EVENTS.BATTLE_STEP, event);
        await new Promise(resolve => setTimeout(resolve, 500)); // Delay for animation
      }
      
      // Emit final result
      client.emit(SOCKET_EVENTS.BATTLE_COMPLETE, {
        result: result.winner,
        rewards: result.rewards,
      });
      
      // Update game state after battle
      const gameState = await this.gameService.getSession(client.id);
      client.emit(SOCKET_EVENTS.GAME_STATE_UPDATE, gameState);
    } catch (error) {
      client.emit(SOCKET_EVENTS.ERROR, {
        code: 'BATTLE_FAILED',
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
  async handleSaveDraftState(@ConnectedSocket() client: Socket) {
    try {
      const draftState = await this.gameService.saveDraftState(client.id);
      
      client.emit(SOCKET_EVENTS.DRAFT_STATE_SAVED, draftState);
    } catch (error) {
      client.emit(SOCKET_EVENTS.ERROR, {
        code: 'DRAFT_SAVE_FAILED',
        message: error.message,
      });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.RESTORE_DRAFT_STATE)
  async handleRestoreDraftState(
    @MessageBody() data: { draftState: any },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const gameState = await this.gameService.restoreDraftState(client.id, data.draftState);
      
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
}