import { Module } from '@nestjs/common';
import { DebugController } from './debug.controller';
import { DebugService } from './debug.service';
import { WebSocketDocsController } from './websocket-docs.controller';
import { PlayerModule } from '../player/player.module';

@Module({
  imports: [PlayerModule], // Need PlayerModule to access player sessions
  controllers: [DebugController, WebSocketDocsController],
  providers: [DebugService],
})
export class DebugModule {}