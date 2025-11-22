import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { EventsService } from './event.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateEventDto,
  CreateEventRequestDto,
  RespondToEventRequestDto,
  SendEventMessageDto,
  SubmitEventFeedbackDto,
  GetNearbyEventsDto,
  GetEventsAtHubDto,
  ReportUserDto,
  BlockUserDto,
} from './dto/event.dto';

@ApiTags('Events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // ============================================
  // CREATE EVENT
  // ============================================

  @Post()
  @ApiOperation({ summary: 'Create a new event at a hub' })
  @ApiResponse({ status: 201, description: 'Event created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - User already has active event' })
  @ApiResponse({ status: 403, description: 'Forbidden - User is suspended' })
  async createEvent(
    @Request() req,
    @Body() dto: CreateEventDto,
  ) {
    return this.eventsService.createEvent(req.user.userId, dto);
  }

  // ============================================
  // GET NEARBY EVENTS
  // ============================================

  @Get('nearby')
  @ApiOperation({ summary: 'Get events nearby a location' })
  @ApiResponse({ status: 200, description: 'Returns list of nearby events' })
  async getNearbyEvents(
    @Request() req,
    @Query() dto: GetNearbyEventsDto,
  ) {
    return this.eventsService.getNearbyEvents(req.user.userId, dto);
  }

  // ============================================
  // GET EVENTS AT HUB
  // ============================================

  @Get('hub')
  @ApiOperation({ summary: 'Get all active events at a specific hub' })
  @ApiResponse({ status: 200, description: 'Returns list of events at hub' })
  async getEventsAtHub(
    @Request() req,
    @Query() dto: GetEventsAtHubDto,
  ) {
    return this.eventsService.getEventsAtHub(req.user.userId, dto);
  }

  // ============================================
  // GET MY EVENTS
  // ============================================

  @Get('my-events')
  @ApiOperation({ summary: 'Get all my events (created or joined)' })
  @ApiResponse({ status: 200, description: 'Returns user events' })
  async getMyEvents(@Request() req) {
    return this.eventsService.getMyEvents(req.user.userId);
  }

  // ============================================
  // GET EVENT DETAILS
  // ============================================

  @Get(':eventId')
  @ApiOperation({ summary: 'Get event details with chat' })
  @ApiResponse({ status: 200, description: 'Returns event with chat messages' })
  @ApiResponse({ status: 403, description: 'Not part of this event' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  async getEventChat(
    @Request() req,
    @Param('eventId') eventId: string,
  ) {
    return this.eventsService.getEventChat(req.user.userId, eventId);
  }

  // ============================================
  // REQUEST TO JOIN EVENT
  // ============================================

  @Post('requests')
  @ApiOperation({ summary: 'Request to join an event' })
  @ApiResponse({ status: 201, description: 'Request sent' })
  @ApiResponse({ status: 400, description: 'Cannot join event' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async requestToJoinEvent(
    @Request() req,
    @Body() dto: CreateEventRequestDto,
  ) {
    return this.eventsService.requestToJoinEvent(req.user.userId, dto);
  }

  // ============================================
  // RESPOND TO EVENT REQUEST
  // ============================================

  @Patch('requests/:requestId')
  @ApiOperation({ summary: 'Accept or decline an event request' })
  @ApiResponse({ status: 200, description: 'Request responded to' })
  @ApiResponse({ status: 403, description: 'Not your event' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  @ApiParam({ name: 'requestId', description: 'Request ID' })
  async respondToEventRequest(
    @Request() req,
    @Param('requestId') requestId: string,
    @Body() dto: RespondToEventRequestDto,
  ) {
    return this.eventsService.respondToEventRequest(req.user.userId, requestId, dto);
  }

  // ============================================
  // SEND MESSAGE
  // ============================================

  @Post(':eventId/messages')
  @ApiOperation({ summary: 'Send a message in event chat' })
  @ApiResponse({ status: 201, description: 'Message sent' })
  @ApiResponse({ status: 400, description: 'Chat locked or limit reached' })
  @ApiResponse({ status: 403, description: 'Not part of this event' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  async sendMessage(
    @Request() req,
    @Param('eventId') eventId: string,
    @Body() dto: SendEventMessageDto,
  ) {
    return this.eventsService.sendMessage(req.user.userId, eventId, dto);
  }

  // ============================================
  // CANCEL EVENT
  // ============================================

  @Delete(':eventId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an event' })
  @ApiResponse({ status: 200, description: 'Event cancelled' })
  @ApiResponse({ status: 403, description: 'Not your event' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  async cancelEvent(
    @Request() req,
    @Param('eventId') eventId: string,
  ) {
    return this.eventsService.cancelEvent(req.user.userId, eventId);
  }

  // ============================================
  // SUBMIT FEEDBACK
  // ============================================

  @Post(':eventId/feedback')
  @ApiOperation({ summary: 'Submit feedback after an event' })
  @ApiResponse({ status: 201, description: 'Feedback submitted' })
  @ApiResponse({ status: 400, description: 'Already submitted or event not matched' })
  @ApiResponse({ status: 403, description: 'Not part of this event' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  async submitFeedback(
    @Request() req,
    @Param('eventId') eventId: string,
    @Body() dto: SubmitEventFeedbackDto,
  ) {
    return this.eventsService.submitFeedback(req.user.userId, eventId, dto);
  }

  // ============================================
  // BLOCK USER
  // ============================================

  @Post('users/block')
  @ApiOperation({ summary: 'Block a user' })
  @ApiResponse({ status: 201, description: 'User blocked' })
  @ApiResponse({ status: 400, description: 'Already blocked' })
  async blockUser(
    @Request() req,
    @Body() dto: BlockUserDto,
  ) {
    return this.eventsService.blockUser(req.user.userId, dto);
  }

  // ============================================
  // REPORT USER
  // ============================================

  @Post('users/report')
  @ApiOperation({ summary: 'Report a user for inappropriate behavior' })
  @ApiResponse({ status: 201, description: 'Report submitted' })
  async reportUser(
    @Request() req,
    @Body() dto: ReportUserDto,
  ) {
    return this.eventsService.reportUser(req.user.userId, dto);
  }

  // ============================================
  // GET USER STATS
  // ============================================

  @Get('users/stats')
  @ApiOperation({ summary: 'Get current user stats and achievements' })
  @ApiResponse({ status: 200, description: 'Returns user stats' })
  async getUserStats(@Request() req) {
    return this.eventsService.getUserStats(req.user.userId);
  }
}