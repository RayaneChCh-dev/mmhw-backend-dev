import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

/**
 * EmailService handles email notifications via Resend
 * Falls back to console logging when RESEND_API_KEY is not configured
 */
@Injectable()
export class EmailService {
  private resend: Resend | null = null;
  private readonly logger = new Logger(EmailService.name);
  private readonly isConfigured: boolean;
  private readonly fromEmail: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.fromEmail = this.configService.get<string>('EMAIL_FROM') || 'noreply@nomadconnect.com';

    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.isConfigured = true;
      this.logger.log('Email service configured with Resend');
    } else {
      this.isConfigured = false;
      this.logger.warn('RESEND_API_KEY not found - emails will be logged to console');
    }
  }

  /**
   * Send event feedback request email
   * @param toEmail - Recipient email
   * @param userName - User's name
   * @param eventDetails - Event information
   */
  async sendEventFeedbackRequest(
    toEmail: string,
    userName: string,
    eventDetails: {
      activityType: string;
      hubName: string;
      participantName: string;
      eventId: string;
    },
  ) {
    const subject = `How was your ${eventDetails.activityType} with ${eventDetails.participantName}?`;
    const html = this.generateEventFeedbackEmail(userName, eventDetails);
    const text = `Hi ${userName},\n\nWe hope you had a great ${eventDetails.activityType} with ${eventDetails.participantName} at ${eventDetails.hubName}!\n\nYour feedback helps us build a better community. Please take a moment to share your experience.\n\nThank you!\nThe NomadConnect Team`;

    await this.sendEmail(toEmail, subject, html, text);
  }

  /**
   * Send stats completion milestone email
   * @param toEmail - Recipient email
   * @param userName - User's name
   * @param milestone - Achievement details
   */
  async sendStatsCompletionEmail(
    toEmail: string,
    userName: string,
    milestone: {
      type: 'streak' | 'events' | 'points';
      value: number;
      title: string;
      description: string;
    },
  ) {
    const subject = `🎉 ${milestone.title}!`;
    const html = this.generateStatsCompletionEmail(userName, milestone);
    const text = `Hi ${userName},\n\nCongratulations! ${milestone.description}\n\nKeep up the great work!\nThe NomadConnect Team`;

    await this.sendEmail(toEmail, subject, html, text);
  }

  /**
   * Core method to send email
   * @param to - Recipient email
   * @param subject - Email subject
   * @param html - HTML content
   * @param text - Plain text content
   */
  private async sendEmail(
    to: string,
    subject: string,
    html: string,
    text: string,
  ) {
    if (!this.isConfigured || !this.resend) {
      // Log to console when Resend is not configured
      this.logger.log(`
========================================
📧 EMAIL (Console Mode)
========================================
To: ${to}
Subject: ${subject}
----------------------------------------
${text}
========================================
      `);
      return;
    }

    try {
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject,
        html,
        text,
      });

      if (result.data) {
        this.logger.log(`Email sent successfully to ${to}: ${result.data.id}`);
      } else if (result.error) {
        this.logger.error(`Failed to send email to ${to}: ${result.error.message}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error.message}`);
      // Fallback to console logging on error
      this.logger.log(`
========================================
📧 EMAIL (Fallback - Error Mode)
========================================
To: ${to}
Subject: ${subject}
----------------------------------------
${text}
========================================
      `);
    }
  }

  /**
   * Generate HTML for event feedback email
   */
  private generateEventFeedbackEmail(
    userName: string,
    eventDetails: {
      activityType: string;
      hubName: string;
      participantName: string;
      eventId: string;
    },
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Event Feedback</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background-color: #4F46E5; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">How was your meetup?</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 24px; color: #374151;">
                Hi <strong>${userName}</strong>,
              </p>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 24px; color: #374151;">
                We hope you had a great <strong>${eventDetails.activityType}</strong> with <strong>${eventDetails.participantName}</strong> at <strong>${eventDetails.hubName}</strong>!
              </p>

              <p style="margin: 0 0 30px; font-size: 16px; line-height: 24px; color: #374151;">
                Your feedback helps us build a better community. Please take a moment to share your experience.
              </p>

              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${this.configService.get('APP_URL') || 'https://app.nomadconnect.com'}/events/${eventDetails.eventId}/feedback"
                       style="display: inline-block; padding: 14px 32px; background-color: #4F46E5; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">
                      Share Feedback
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 0; font-size: 14px; line-height: 20px; color: #6B7280; text-align: center;">
                Thank you for being part of the NomadConnect community!
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #F9FAFB; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; font-size: 12px; line-height: 18px; color: #9CA3AF;">
                NomadConnect - Connecting digital nomads worldwide
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  /**
   * Generate HTML for stats completion email
   */
  private generateStatsCompletionEmail(
    userName: string,
    milestone: {
      type: 'streak' | 'events' | 'points';
      value: number;
      title: string;
      description: string;
    },
  ): string {
    const emoji = milestone.type === 'streak' ? '🔥' : milestone.type === 'events' ? '🎯' : '⭐';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Achievement Unlocked</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <div style="font-size: 64px; margin-bottom: 16px;">${emoji}</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">${milestone.title}</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 24px; color: #374151;">
                Hi <strong>${userName}</strong>,
              </p>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 24px; color: #374151;">
                Congratulations! 🎉
              </p>

              <div style="margin: 30px 0; padding: 24px; background-color: #F3F4F6; border-radius: 8px; text-align: center;">
                <p style="margin: 0; font-size: 18px; line-height: 28px; color: #1F2937; font-weight: 600;">
                  ${milestone.description}
                </p>
              </div>

              <p style="margin: 30px 0 0; font-size: 16px; line-height: 24px; color: #374151;">
                Keep up the amazing work! Every connection you make helps build our community stronger.
              </p>

              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 30px 0;">
                    <a href="${this.configService.get('APP_URL') || 'https://app.nomadconnect.com'}/profile/stats"
                       style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">
                      View Your Stats
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #F9FAFB; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; font-size: 12px; line-height: 18px; color: #9CA3AF;">
                NomadConnect - Connecting digital nomads worldwide
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }
}
