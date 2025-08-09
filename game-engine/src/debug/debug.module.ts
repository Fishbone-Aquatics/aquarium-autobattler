import { Module } from '@nestjs/common';
import { DebugController } from './debug.controller';
import { DebugService } from './debug.service';
import { WebSocketDocsController } from './websocket-docs.controller';
import { PlayerModule } from '../player/player.module';
import { GameModule } from '../game/game.module';

@Module({
  imports: [PlayerModule, GameModule], // Need both PlayerModule and GameModule
  controllers: [DebugController, WebSocketDocsController],
  providers: [DebugService],
})
export class DebugModule {}