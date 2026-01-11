import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import * as express from 'express';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { useContainer } from 'class-validator';
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
   app.use(cookieParser());


// app.use('/uploads', express.static(join(process.cwd(), 'uploads')));
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
  prefix: '/uploads/',
});

app.enableCors({origin:true,credentials:true})

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');

}


bootstrap();
