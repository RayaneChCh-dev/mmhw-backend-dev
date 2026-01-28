import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BugReportsService } from './bug-reports.service';
import { CreateBugReportDto } from './dto/create-bug-report.dto';

@ApiTags('Bug Reports')
@Controller('bug-reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BugReportsController {
  constructor(private readonly bugReportsService: BugReportsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a bug report' })
  @ApiResponse({
    status: 201,
    description: 'Bug report submitted successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async create(
    @Request() req,
    @Body() createBugReportDto: CreateBugReportDto,
  ) {
    const userId = req.user.userId;
    const bugReport = await this.bugReportsService.create(
      userId,
      createBugReportDto,
    );

    return {
      success: true,
      message: 'Bug report submitted successfully. Thank you for your feedback!',
      data: bugReport,
    };
  }

  @Get('my-reports')
  @ApiOperation({ summary: 'Get my bug reports' })
  @ApiResponse({
    status: 200,
    description: 'Returns user bug reports',
  })
  async getMyReports(@Request() req) {
    const userId = req.user.userId;
    const reports = await this.bugReportsService.findByUser(userId);

    return {
      success: true,
      data: reports,
    };
  }
}
