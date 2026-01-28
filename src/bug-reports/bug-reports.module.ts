import { Module } from '@nestjs/common';
import { BugReportsController } from './bug-reports.controller';
import { BugReportsService } from './bug-reports.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [BugReportsController],
  providers: [BugReportsService],
  exports: [BugReportsService],
})
export class BugReportsModule {}
