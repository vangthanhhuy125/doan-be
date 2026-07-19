import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express'; 

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

  await app.listen(process.env.PORT || 3001, '0.0.0.0');
  
  return app.getHttpServer();
}

export const handler = async (req: any, res: any) => {
  const server = await bootstrap();
  return server(req, res);
};

if (process.env.NODE_ENV !== 'production') {
  bootstrap().then(async () => {
    console.log(`Application is running on local port: ${process.env.PORT || 3001}`);
  });
}