import { Module } from '@nestjs/common';
import { GameService } from './game.service';
import { GameGateway } from './game.gateway';
import { PlayerModule } from '../player/player.module';

@Module({
  imports: [PlayerModule], // Import PlayerModule to use PlayerService
  providers: [GameService, GameGateway],
  exports: [GameService],
})
export class GameModule {}