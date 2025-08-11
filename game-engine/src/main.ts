/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: (origin, callback) => {
        // Allow requests from localhost, network IPs, and configured frontend URL
        const allowedOrigins = [
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          process.env.FRONTEND_URL,
        ];
        
        // Allow any origin from local network (192.168.x.x, 10.x.x.x, etc)
        if (!origin || 
            allowedOrigins.includes(origin) || 
            origin.match(/^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.).*:3000$/)) {
          callback(null, true);
        } else {
          callback(null, true); // For development, allow all origins
        }
      },
      credentials: true,
    },
  });
  
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  
  // Setup Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Aquarium Autobattler API')
    .setDescription('Game engine REST API endpoints and WebSocket documentation')
    .setVersion('1.0')
    .addTag('debug', 'Debug and session management endpoints')
    .addTag('websocket', 'WebSocket event documentation')
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Aquarium Autobattler API Docs',
    customCss: '.swagger-ui .topbar { display: none }',
  });
  
  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  
  Logger.log(
    `🚀 Game Engine is running on: http://localhost:${port}/${globalPrefix}`
  );
  Logger.log(
    `📚 API Documentation available at: http://localhost:${port}/${globalPrefix}/docs`
  );
  Logger.log(
    `🔌 WebSocket server ready on: ws://localhost:${port}`
  );
}

bootstrap();
