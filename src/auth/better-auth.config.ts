import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { twoFactor, phoneNumber } from 'better-auth/plugins';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from '../database/schema';

// Configure Neon for Node.js environment
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  plugins: [
    // Two-Factor Authentication (MFA)
    twoFactor({
      issuer: process.env.OTP_ISSUER || 'NomadConnect',
      otpOptions: {
        period: 30,
        digits: 6,
      },
    }),
    // Phone Number Verification
    phoneNumber({
      // Require phone verification before user can fully access the app
      requireVerification: true,
      
      // SMS sending callback - implement with Twilio
      // Correct signature: (data: { phoneNumber: string; code: string }, request?: Request) => void | Promise<void>
      async sendOTP(data, request) {
        const { phoneNumber, code } = data;
        
        // This is where you integrate Twilio or any SMS provider
        const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
        const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
        const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

        if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
          console.log(`[DEV MODE] OTP for ${phoneNumber}: ${code}`);
          return;
        }

        try {
          const twilio = require('twilio')(twilioAccountSid, twilioAuthToken);
          
          await twilio.messages.create({
            body: `Your NomadConnect verification code is: ${code}. This code expires in 10 minutes.`,
            from: twilioPhoneNumber,
            to: phoneNumber,
          });
          
          console.log(`SMS sent to ${phoneNumber}`);
        } catch (error) {
          console.error('Failed to send SMS:', error);
          throw error;
        }
      },
      otpLength: 6,
      expiresIn: 10 * 60, // 10 minutes
    }),
  ],
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  trustedOrigins: process.env.CORS_ORIGINS?.split(',') || [],
});

export type Auth = typeof auth;