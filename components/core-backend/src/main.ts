import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { DataCollectorModule } from './data-collector/data-collector.module';
import * as express from 'express';
import { join } from 'path';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
   app.use(cookieParser());
   app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  await app.listen(process.env.PORT ?? 3000);

    const dataCollectorApp = await NestFactory.create(DataCollectorModule);
  await dataCollectorApp.listen(4000);
  console.log('Data Collector running on http://localhost:4000');
}
bootstrap();
