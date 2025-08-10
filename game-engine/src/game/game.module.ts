import { Module } from '@nestjs/common';
import { GameService } from './game.service';
import { GameGateway } from './game.gateway';
import { PlayerModule } from '../player/player.module';
import { AIModule } from '../ai/ai.module';
import { BattleModule } from '../battle/battle.module';
import { EconomyModule } from '../economy/economy.module';
import { TankModule } from '../tank/tank.module';

@Module({
  imports: [PlayerModule, AIModule, BattleModule, EconomyModule, TankModule], // Import all service modules
  providers: [GameService, GameGateway],
  exports: [GameService],
})
export class GameModule {}