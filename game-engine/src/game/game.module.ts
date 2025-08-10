import { Module } from '@nestjs/common';
import { GameService } from './game.service';
import { GameGateway } from './game.gateway';
import { PlayerModule } from '../player/player.module';
import { AIModule } from '../ai/ai.module';
import { BattleModule } from '../battle/battle.module';
import { EconomyModule } from '../economy/economy.module';

@Module({
  imports: [PlayerModule, AIModule, BattleModule, EconomyModule], // Import PlayerModule, AIModule, BattleModule, and EconomyModule
  providers: [GameService, GameGateway],
  exports: [GameService],
})
export class GameModule {}