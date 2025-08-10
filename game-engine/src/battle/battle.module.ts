import { Module } from '@nestjs/common';
import { BattleService } from './battle.service';

@Module({
  providers: [BattleService],
  exports: [BattleService],
})
export class BattleModule {}