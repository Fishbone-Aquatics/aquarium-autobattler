import { Module } from '@nestjs/common';
import { PlayerService } from './player.service';

@Module({
  providers: [PlayerService],
  exports: [PlayerService], // Export so other modules can use it
})
export class PlayerModule {}