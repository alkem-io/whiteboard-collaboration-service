import { MiddlewareConsumer, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import configuration from './config/configuration';
import { WinstonConfigService } from './config/winston.config';
import { ServerModule } from './excalidraw-backend/server.module';
import { HealthModule } from './services/health/health.module';

@Module({
  imports: [
    ServerModule,
    HealthModule,
    ConfigModule.forRoot({
      envFilePath: ['.env'],
      isGlobal: true,
      load: [configuration],
    }),
    WinstonModule.forRootAsync({
      useClass: WinstonConfigService,
    }),
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply().forRoutes('/');
  }
}
