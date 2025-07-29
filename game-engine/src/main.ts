/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    },
  });
  
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  
  const port = process.env.PORT || 3001;
  await app.listen(port);
  
  Logger.log(
    `🚀 Game Engine is running on: http://localhost:${port}/${globalPrefix}`
  );
  Logger.log(
    `🔌 WebSocket server ready on: ws://localhost:${port}`
  );
}

bootstrap();
