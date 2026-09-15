import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const paths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../../../.env'),
    path.resolve(__dirname, '../../../../.env')
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      content.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const value = parts.slice(1).join('=').trim();
          if (key && !process.env[key]) {
            process.env[key] = value;
          }
        }
      });
      break;
    }
  }
}
loadEnv();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { Logger } from 'nestjs-pino';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true
  });

  const pinoLogger = app.get(Logger);
  app.useLogger(pinoLogger);

  const configService = app.get(ConfigService);
  
  app.setGlobalPrefix('api', {
    exclude: ['health', 'ready', 'live', 'api/docs']
  });

  app.enableCors();

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalInterceptors(new TransformInterceptor(), new AuditInterceptor());

  // Configure Swagger API Docs
  const config = new DocumentBuilder()
    .setTitle('Cakes & Candles ERP API')
    .setDescription('Enterprise platform — Identity, Auth, User Management, Foundation Services')
    .setVersion('1.0.0')
    .addBearerAuth()
        .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.port;
  await app.listen(port);
  
  pinoLogger.log(`Cakes & Candles ERP API listening on port ${port}`);
}
bootstrap();
