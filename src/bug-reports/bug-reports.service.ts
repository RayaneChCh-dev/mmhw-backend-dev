import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, desc } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../database/database.module';
import * as schema from '../database/schema';
import { CreateBugReportDto } from './dto/create-bug-report.dto';

@Injectable()
export class BugReportsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Create a new bug report
   */
  async create(userId: string, createBugReportDto: CreateBugReportDto) {
    const [bugReport] = await this.db
      .insert(schema.bugReports)
      .values({
        userId,
        title: createBugReportDto.title,
        description: createBugReportDto.description,
        deviceInfo: createBugReportDto.deviceInfo,
        status: 'pending',
        priority: 'medium',
      })
      .returning();

    return bugReport;
  }

  /**
   * Get all bug reports for a user
   */
  async findByUser(userId: string) {
    return await this.db
      .select()
      .from(schema.bugReports)
      .where(eq(schema.bugReports.userId, userId))
      .orderBy(desc(schema.bugReports.createdAt));
  }

  /**
   * Get a single bug report by ID
   */
  async findOne(id: string) {
    const [bugReport] = await this.db
      .select()
      .from(schema.bugReports)
      .where(eq(schema.bugReports.id, id));

    return bugReport;
  }

  /**
   * Get all bug reports (admin only)
   */
  async findAll() {
    return await this.db
      .select()
      .from(schema.bugReports)
      .orderBy(desc(schema.bugReports.createdAt));
  }

  /**
   * Update bug report status (admin only)
   */
  async updateStatus(
    id: string,
    status: 'pending' | 'in_progress' | 'resolved' | 'closed',
    adminNotes?: string,
    resolvedBy?: string,
  ) {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (adminNotes) {
      updateData.adminNotes = adminNotes;
    }

    if (status === 'resolved' && resolvedBy) {
      updateData.resolvedBy = resolvedBy;
      updateData.resolvedAt = new Date();
    }

    const [bugReport] = await this.db
      .update(schema.bugReports)
      .set(updateData)
      .where(eq(schema.bugReports.id, id))
      .returning();

    return bugReport;
  }
}
