import { Module } from '@nestjs/common';
import { DebugController } from './debug.controller';
import { DebugService } from './debug.service';
import { PlayerModule } from '../player/player.module';

@Module({
  imports: [PlayerModule], // Need PlayerModule to access player sessions
  controllers: [DebugController],
  providers: [DebugService],
})
export class DebugModule {}