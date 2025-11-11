import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import * as schema from './schema';

export const DATABASE_CONNECTION = 'DATABASE_CONNECTION';
neonConfig.webSocketConstructor = ws;

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CONNECTION,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const connectionString = configService.get<string>('DATABASE_URL');
        
        if (!connectionString) {
          throw new Error('DATABASE_URL is not defined in environment variables');
        }

        // Create Neon serverless pool
        const pool = new Pool({ connectionString });

        // Create drizzle instance with Neon
        const db = drizzle(pool, { schema });

        return db;
      },
    },
  ],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule {}