import { WinstonModule } from 'nest-winston';
import { MiddlewareConsumer, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WinstonConfigService } from './config/winston.config';
import { ServerModule } from './excalidraw-backend/server.module';
import configuration from './config/configuration';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ServerModule,
    ConfigModule.forRoot({
      envFilePath: ['.env'],
      isGlobal: true,
      load: [configuration],
    }),
    WinstonModule.forRootAsync({
      useClass: WinstonConfigService,
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply().forRoutes('/');
  }
}
