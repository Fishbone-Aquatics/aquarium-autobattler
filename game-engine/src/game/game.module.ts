import { Module } from '@nestjs/common';
import { GameService } from './game.service';
import { GameGateway } from './game.gateway';
import { PlayerModule } from '../player/player.module';
import { AIModule } from '../ai/ai.module';
import { BattleModule } from '../battle/battle.module';

@Module({
  imports: [PlayerModule, AIModule, BattleModule], // Import PlayerModule, AIModule, and BattleModule
  providers: [GameService, GameGateway],
  exports: [GameService],
})
export class GameModule {}