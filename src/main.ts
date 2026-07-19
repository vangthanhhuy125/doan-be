import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';

let server: any;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.setGlobalPrefix('api');

  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  app.enableCors({
    origin: [
      'http://localhost:3000', 
      process.env.FRONTEND_URL
    ].filter(Boolean), 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  await app.init();
  
  return app.getHttpServer().getInstance();
}

export default async (req: any, res: any) => {
  if (!server) {
    server = await bootstrap();
  }
  return server(req, res);
};