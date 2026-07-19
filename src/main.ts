import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express'; 

let cachedApp: any;

async function bootstrap() {
  if (!cachedApp) {
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

    if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
      const port = process.env.PORT || 3001;
      await app.listen(port, '0.0.0.0');
      console.log(`Application is running on local port: ${port}`);
    } else {
      await app.init();
    }

    cachedApp = app.getHttpAdapter().getInstance();
  }
  return cachedApp;
}

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  bootstrap();
}

export default async (req: any, res: any) => {
  const server = await bootstrap();
  return server(req, res);
};